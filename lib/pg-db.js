import inject from 'seacreature/lib/inject'
import path from 'path'
import pg from 'pg'
const { Pool } = pg

inject('command.sql', async ({ args, log, db }) => {
  if (!args.length > 1) return
  else if (args[0] == 'select')
    await Promise.all(
      (await db.query(args.join(' '))).rows.map(r => log(r)))
  else await log(await db.query(args.join(' ')))
})

inject('ctx', async () => {
  const db = new Pool({
    host: process.env.BOSS_PG_HOST,
    user: process.env.BOSS_PG_USER,
    database: process.env.BOSS_PG_DATABASE,
    password: process.env.BOSS_PG_PASSWORD,
    port: process.env.BOSS_PG_PORT,
    max: process.env.BOSS_PG_MAX || 10
  })
  db.on('error', e => console.error('db-pg', e))
  return { db }
})
