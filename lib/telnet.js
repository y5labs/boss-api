import telnet from 'telnet2'
import blessed from 'neo-blessed'
import inject from 'seacreature/lib/inject'
import pjson from '../package.json'
import util from 'util'

// TODO: Tab completion?
// TODO: Cursor movement - requires subclassing blessed.textbox

inject('command.exit', ({ screen }) => screen.destroy())
inject('command.clear', ({ list }) => list.clearItems())
inject('command.help', ({ list, screen }) => {
  const msgs = `
# Commands available

${Array.from(inject.bindings().keys())
  .filter(k => k.startsWith('command.'))
  .map(k => k.slice('command.'.length))
  .join('\n')}

Help for commands is often available by typing "command help"
`.split('\n')
  msgs.forEach(msg => list.addItem(msg))
  list.setScrollPerc(100)
  screen.render()
})

inject('ctx', () => ({ terminals: new Set() }))

inject('pod', async ctx => {
  const { hub, terminals, log, startup } = ctx
  const release = startup.retain()
  hub.on('shutdown', () => {
    Array.from(terminals.values(), ({ screen }) => screen.destroy())
  })
  const append_log = (...args) => {
    const msgs = args
      .map(s => typeof s == 'string' ? s : util.inspect(s))
      .join(' ')
      .split('\n')
    Array.from(terminals.values(), ({ screen, list }) => {
      msgs.forEach(msg => list.addItem(msg))
      list.setScrollPerc(100)
      screen.render()
    })
  }
  hub.on('log', append_log)
  hub.on('error', append_log)

  const history = []

  const port = process.env.TELNET_PORT || 23
  const telnetServer = telnet({ tty: true }, client => {
    client.write(`${pjson.name}@${pjson.version}\n`)

    const screen = blessed.screen({
      smartCSR: true,
      input: client,
      output: client,
      terminal: 'xterm-256color',
      fullUnicode: true
    })

    const list = blessed.list({
      height: '100%-2',
      scrollable: true,
      top: 0,
      left: 0,
      items: []
    })

    const input = blessed.textbox({
      bottom: 0,
      left: 2,
      height: 1,
      inputOnFocus: true,
      keys: true,
      cursor: {
        shape: 'block'
      }
    })

    const connection = { client, screen, list, input }
    let history_index = null
    terminals.add(connection)

    input.key('enter', async () => {
      const cmd = input.getValue()
      input.clearValue()
      history_index = null
      const args = cmd.replace(/\s\s+/g, ' ').trim().split(' ')
      const command = args[0]
      if (command == '') {
        input.clearValue()
        input.focus()
        screen.render()
        return
      }
      list.addItem(cmd)
      history.push(cmd)
      list.setScrollPerc(100)
      screen.render()
      args.splice(0, 1)
      const fn = inject.oneornone(`command.${command}`)
      if (fn == null) list.addItem('Command not found')
      else {
        try {
          await fn({ ...connection, args, ...ctx })
        }
        catch (e) {
          await log.error(e)
        }
      }
      list.setScrollPerc(100)
      input.focus()
      screen.render()
    })
    input.on('keypress', (ch, key) => {
      if (key.name == 'up' || key.name == 'down') return
      history_index = null
    })
    input.key('up', () => {
      if (history.length == 0) return
      if (history_index == null) {
        if (input.getValue() != '') return
        history_index = history.length - 1
      }
      else history_index = Math.max(history_index - 1, 0)
      input.setValue(history[history_index])
      screen.render()
    })
    input.key('down', () => {
      if (history_index == null) return
      if (history_index == history.length - 1) {
        history_index = null
        input.clearValue()
        screen.render()
        return
      }
      history_index++
      input.setValue(history[history_index])
      screen.render()
    })

    input.key(['C-d'], () => screen.destroy())

    input.key(['C-c'], () => {
      input.clearValue()
      history_index = null
      input.focus()
      screen.render()
    })

    screen.key(['C-d'], (ch, key) => {
      screen.destroy()
    })

    screen.on('destroy', () => {
      if (client.writable) {
        client.write('E noho rā!\n')
        client.destroy()
      }
    })

    client.on('term', terminal => {
      screen.terminal = terminal
      screen.render()
    })

    client.on('size', (width, height) => {
      client.columns = width
      client.rows = height
      client.emit('resize')
    })

    client.on('close', () => {
      terminals.delete(connection)
      if (!screen.destroyed) screen.destroy()
    })

    screen.append(list)
    screen.append(blessed.box({
      bottom: 0,
      left: 0,
      width: 1,
      height: 1,
      content: '>'
    }))
    screen.append(input)
    screen.render()

    setTimeout(() => {
      input.clearValue()
      input.focus()
      screen.render()
    }, 100)

  })
  telnetServer.on('listening', async () => {
    release()
    await log(`${pjson.name}@${pjson.version} :${port}`)
  })
  telnetServer.listen(port)
})