import inject from 'seacreature/lib/inject'
import express from 'express'
import mutunga from 'http-mutunga'
import pjson from '../package.json'

inject('ctx', async () => {
  const app = express()
  const httpServer = mutunga(app)
  httpServer.setTimeout(5 * 60 * 1000)
  return { app, httpServer }
})

inject('pod', async ({ httpServer, app, hub, log, startup }) => {
  const release = startup.retain()
  const port = process.env.EXPRESS_PORT || 8081
  httpServer.listen(port, async () => {
    // json 404
    app.use((req, res) => res.status(404).send({ message: 'Not Found' }))
    release()
    const { address, port } = httpServer.address()
    hub.on('shutdown', () => httpServer.terminate())
    await log(`${pjson.name}@${pjson.version} ${address}:${port}`)
  })
})
