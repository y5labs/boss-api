import inject from 'seacreature/lib/inject'
import ws, { WebSocketServer } from 'ws'

inject('ctx', async ({ hub }) => {
  const wsServer = new WebSocketServer({ noServer: true })
  wsServer.on('connection', socket => {
    socket.is_alive = true
    socket.sendMessage = (e, p) => socket.send(JSON.stringify({ e, p }))
    hub.emit('socket connected', socket)
    socket.on('pong', () => socket.is_alive = true)
    // socket.on('message', data => {
    //   const { e: event, p: payload } = JSON.parse(data)
    //   hub.emit(event, payload, socket)
    // })
    socket.on('close', () => hub.emit('socket disconnected', socket))
  })

  const interval = setInterval(() => {
    for (const socket of wsServer.clients) {
      if (socket.is_alive === false)
        return socket.terminate()
      socket.is_alive = false
      socket.ping(() => {})
    }
  }, 30000)

  hub.on('socket broadcast', (e, p) => {
    for (const socket of wsServer.clients) {
      if (socket.readyState !== ws.OPEN) continue
      socket.sendMessage(e, p)
    }
  })

  wsServer.on('close', () => clearInterval(interval))

  return { wsServer }
})

inject('pod', async ({ httpServer, wsServer }) => {
  httpServer.on('upgrade', (req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head, socket => {
      wsServer.emit('connection', socket, req)
    })
  })
})