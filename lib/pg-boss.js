import inject from 'seacreature/lib/inject'
import Boss from 'pg-boss'

inject('ctx', async ({ db, startup }) => {
  const release = startup.retain()
  const boss = await new Boss({
      db: { executeSql: (...args) => db.query(...args) },
      monitorStateIntervalSeconds: 10,
      retryLimit: Math.pow(2, 31) - 1,
      retryDelay: 5, // 5s
      retryBackoff: true,
      expireInSeconds: 5,
      application_name: process.env.BOSS_APPLICATION_NAME,
      schema: process.env.BOSS_PG_SCHEMA
    })
    .on('error', e => console.error(e))
    .start()
  release()

  return { boss }
})

