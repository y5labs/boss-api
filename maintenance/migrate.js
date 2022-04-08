import pg from 'pg'
const { Pool } = pg

import { insert as pg_insert } from 'pg-promise/lib/helpers/methods/insert'

const [, , bossConnectionString1, bossConnectionString2, jobName] = process.argv

const [pool1, pool2] = [bossConnectionString1, bossConnectionString2].map((str, i) => {
  console.log(`Connection string ${i + 1}: `, str)
  return new Pool({
    connectionString: str
  })
})

const { rows: jobs } = await pool1.query(
  jobName.endsWith('%')
    ? `select * from job where name LIKE '${jobName}'`
    : `select * from job where name = '${jobName}'`
)

if (!jobs.length) throw 'No records in source table'

const chunk = (a, size) =>
  Array(Math.ceil(a.length / size))
    .fill(0)
    .map((_, i) => i)
    .reduce((res, i) => {
      const end = Math.min(a.length, size * (i + 1))
      res.push({
        index: end,
        values: a.slice(size * i, end)
      })
      return res
    }, [])

for (const { index, values: chunked_jobs } of chunk(jobs, 100)) {
  await pool2.query(
    `${pg_insert(chunked_jobs, Object.keys(chunked_jobs[0]), 'job')}
          on conflict (id) do nothing`
  )
  console.log('Batch ', Math.ceil(index / 100), ' inserted :>> ')
}
