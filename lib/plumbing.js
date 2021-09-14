import inject from 'seacreature/lib/inject'

;(async () => {
const ctx = { }
for (let c of inject.many('ctx')) Object.assign(ctx, await c(ctx))
for (let pod of inject.many('pod')) Object.assign(ctx, await pod(ctx))
await ctx.hub.emit('ready')
})()