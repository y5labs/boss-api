import inject from 'seacreature/lib/inject'
import { states as boss_states } from 'pg-boss'
import shortid from 'shortid'

const schema = process.env.BOSS_PG_SCHEMA
const boss_prefix = '__pgboss__'

inject('pod', async ({ app, hub, db, log, startup, boss }) => {
  const release = startup.retain()
  await db.query(`
    create extension if not exists pgcrypto;
    create table if not exists ${schema}.api_key (
      api_key varchar(255) primary key,
      api_secret varchar(255) not null
    );
  `)
  release()

  const upsert = async ({ api_key, api_secret }) =>
    await db.query(
      `
      insert into ${schema}.api_key (api_key, api_secret)
      values ($1, $2)
      on conflict (api_key) do update
      set api_secret = excluded.api_secret;
    `,
      [api_key, api_secret]
    )

  const verify = async ({ api_key, api_secret }) => {
    const { rows } = await db.query(
      `
      select * from ${schema}.api_key
      where api_key = $1 and api_secret = $2;
    `,
      [api_key, api_secret]
    )
    return rows.length == 1
  }

  const remove = async ({ api_key }) =>
    await db.query(
      `
      delete from ${schema}.api_key
      where api_key = $1;
    `,
      [api_key]
    )

  inject('command.api_key_new', async () => {
    const api_key = shortid.generate()
    const api_secret = shortid.generate()
    await upsert({ api_key, api_secret })
    if (process.env.BOSS_CONTROL_HOST)
      await log(
        `${process.env.BOSS_CONTROL_HOST}/connect?server_address=${encodeURIComponent(
          process.env.BOSS_API_HOST
        )}&api_key=${encodeURIComponent(api_key)}&api_secret=${encodeURIComponent(api_secret)}`
      )
    else await log(`Added api_key: ${api_key}, api_secret: ${api_secret}`)
  })

  inject('command.api_key_delete', async api_key => {
    await remove({ api_key })
    await log(`Removed ${api_key}`)
  })

  const load_jobs = async ({ queue, statuses, currentpage, itemsperpage = 25, search_term = null }) => {
    statuses = statuses.filter(s => boss_states[s])
    if (statuses.length == 0)
      return {
        queue,
        statuses,
        currentpage: 1,
        itemsperpage,
        totalitems: 0,
        jobs: []
      }
    const res =
      search_term && search_term.length > 2
        ? await db.query(
            `
        select
          id,
          data,
          state,
          greatest(startedon, createdon, completedon, startafter) as activity_at,
          count(*) OVER() AS full_count
        from ${schema}.job
        where
          name = $1
          and state = ANY($2::${schema}.job_state[])
          and data::text like $3
        order by greatest(startedon, createdon, completedon, startafter) desc
        offset $4
        limit $5;`,
            [queue, statuses, `%${search_term}%`, (currentpage - 1) * itemsperpage, itemsperpage]
          )
        : await db.query(
            `
        select
          id,
          data,
          state,
          greatest(startedon, createdon, completedon, startafter) as activity_at,
          count(*) OVER() AS full_count
        from ${schema}.job
        where
          name = $1
          and state = ANY($2::${schema}.job_state[])
        order by greatest(startedon, createdon, completedon, startafter) desc
        offset $3
        limit $4;`,
            [queue, statuses, (currentpage - 1) * itemsperpage, itemsperpage]
          )
    const totalitems = parseInt(res.rows?.[0]?.full_count ?? 0)
    for (const row of res.rows) delete row.full_count
    return {
      queue,
      statuses,
      currentpage,
      itemsperpage,
      totalitems,
      jobs: res.rows
    }
  }

  await startup.released()

  const sockets = new Set()
  let last = null

  hub.on('socket connected', socket => {
    socket.addEventListener('message', async e => {
      const { e: event, p: payload } = JSON.parse(e.data)
      if (sockets.has(socket)) {
        if (event == 'load jobs') {
          socket.sendMessage('loaded jobs', await load_jobs(payload))
        }
      } else if (event == 'login') {
        const { apiKey, apiSecret } = payload
        // if (!(await verify({ api_key: apiKey, api_secret: apiSecret }))) return
        socket.sendMessage('queue state update', last)
        sockets.add(socket)
      }
    })
  })
  hub.on('socket disconnected', socket => {
    sockets.delete(socket)
  })

  const handle = setInterval(async () => {
    const { rows: summary } = await db.query(`
      select name, state, count(*) size
      from ${schema}.job
      group by rollup(name), rollup(state)`)
    const { rows: archive_summary } = await db.query(`
      select name, state, count(*) size
      from ${schema}.archive
      group by rollup(name), rollup(state)`)

    const states_map = Object.entries(
      summary.reduce((map, i) => {
        const name = i.name ?? `${boss_prefix}total_all`
        const state = i.state ?? 'total'
        if (!map[name]) map[name] = Object.fromEntries(Object.keys(boss_states).map(q => [q, 0]))
        map[name][state] = parseInt(i.size)
        return map
      }, {})
    )
    archive_summary
      .filter(ln => ln.state)
      .forEach(({ name, state, size }) => {
        const entry = states_map.find(e => e[0] == name)
        if (entry) entry[1][`archived_${state}`] = size
      })
    last = {
      special: states_map
        .filter(([name]) => name.startsWith(boss_prefix))
        .map(([name, states]) => [name.slice(boss_prefix.length), states]),
      queues: states_map.filter(([name]) => !name.startsWith(boss_prefix))
    }
    last.special.push([
      'total',
      last.queues.reduce((obj, [_, q]) => {
        for (const [key, value] of Object.entries(q)) obj[key] = (obj[key] ?? 0) + value
        return obj
      }, {})
    ])
    for (const socket of sockets.values()) {
      // console.log('Sending:', last.queues)
      socket.sendMessage('queue state update', last)
    }
  }, 500)

  hub.on('shutdown', () => {
    clearTimeout(handle)
  })
})
