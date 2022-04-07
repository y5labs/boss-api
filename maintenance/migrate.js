import pg from 'pg'
const { Pool } = pg

const bossConnectionString1 = process.argv[2]
const bossConnectionString2 = process.argv[3]
const jobName = process.argv[4]

const pool1 = new Pool({
  bossConnectionString1
})
const pool2 = new Pool({
  bossConnectionString2
})
console.log(bossConnectionString1)
console.log(bossConnectionString2)
const result = await pool1.query(`SELECT * FROM job WHERE name = ${jobName}`)
console.log('result :>> ', result)

// Execution:
// e.g.
// npm run migrate postgresql://whites_postgres_boss:HwyJWIPCFbG96iyDzhhMC99eWkkadJ5Z@localhost:5433/boss \
// postgresql://whites_postgres_boss:HwyJWIPCFbG96iyDzhhMC99eWkkadJ5Z@localhost:8091/boss \
// whites-platform-api.queue_new_orders
