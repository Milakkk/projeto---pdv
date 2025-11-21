import { startLanHub } from '../../packages/lan-sync/server'

const port = Number(process.env.LAN_HUB_PORT ?? 4000)
startLanHub({ port, secret: process.env.LAN_SYNC_SECRET })

