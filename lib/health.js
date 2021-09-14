import inject from 'seacreature/lib/inject'
import ref from 'seacreature/lib/ref'

inject('ctx', () => ({
  startup: ref(),
  sensitive: ref()
}))

inject('pod', ({ app, hub, log, startup, sensitive }) => {
  let isstartingup = true
  let isshuttingdown = false

  // watch -n 1 curl -s http://localhost:8080/health
  app.get('/lib/health', (req, res) => {
    if (isshuttingdown) res.status(500).send('SERVER_IS_SHUTTING_DOWN')
    else if (!isstartingup) res.send('SERVER_IS_READY')
    else res.status(500).send('SERVER_IS_NOT_READY')
  })

  app.get('/lib/live', (req, res) => {
    if (isshuttingdown) res.status(500).send('SERVER_IS_SHUTTING_DOWN')
    else res.send('SERVER_IS_NOT_SHUTTING_DOWN')
  })

  app.get('/lib/ready', (req, res) => {
    if (!isstartingup) res.send('SERVER_IS_READY')
    else res.status(500).send('SERVER_IS_NOT_READY')
  })

  hub.on('terminate', async method => {
    try {
      if (isshuttingdown) {
        if (method == 'SIGTERM') {
          await log('SIGTERM – E noho rā!')
          process.exit(0)
        }
        return
      }
      isshuttingdown = true
      await sensitive.released()
      await log(`${method} – Ohākī...`)
      await hub.emit('shutdown')
      await log('E noho rā!')
      process.exit(0)
    }
    catch (e) {
      await log.error(e)
      process.exit(0)
    }
  })

  hub.on('ready', () => {
    (async () => {
      await startup.released()
      isstartingup = false
    })()
  })

  inject('command.health', () => log(
    isshuttingdown
    ? 'SERVER_IS_SHUTTING_DOWN'
    : isstartingup
    ? 'SERVER_IS_NOT_READY'
    : 'SERVER_IS_READY'))
  inject('command.halt', () => hub.emit('terminate', 'USER'))
  process.on('SIGTERM', () => hub.emit('terminate', 'SIGTERM'))
  process.on('SIGINT', () => hub.emit('terminate', 'SIGINT'))
})
