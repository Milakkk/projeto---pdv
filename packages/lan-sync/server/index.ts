import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { parse as parseUrl } from 'url'
import { promises as fs } from 'fs'
import path from 'path'

type LanHubOptions = {
  port?: number
  secret?: string
  storeDir?: string
}

type LanEvent = {
  table: string
  rows?: any[]
  row?: any
  unit_id?: string
  created_at?: string
  updated_at?: string
}

const DEFAULT_STORE_DIR = path.resolve(process.cwd(), 'lan-sync-store')

function authBearerOk(req: http.IncomingMessage, expected?: string): boolean {
  if (!expected) return true
  const h = req.headers['authorization'] || req.headers['Authorization' as any]
  if (!h || Array.isArray(h)) return false
  const token = h.startsWith('Bearer ') ? h.slice(7) : h
  return token === expected
}

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch {}
}

async function appendEvents(storeDir: string, unitId: string, events: LanEvent[]) {
  const file = path.join(storeDir, `${unitId}.jsonl`)
  const lines = events.map((e) => JSON.stringify({ ...e, created_at: e.created_at ?? new Date().toISOString() }))
  await ensureDir(storeDir)
  await fs.appendFile(file, lines.join('\n') + '\n', 'utf8')
}

async function readEventsSince(storeDir: string, unitId: string, sinceIso?: string): Promise<LanEvent[]> {
  const file = path.join(storeDir, `${unitId}.jsonl`)
  try {
    const buf = await fs.readFile(file, 'utf8')
    const lines = buf.split('\n').filter(Boolean)
    const all = lines.map((l) => JSON.parse(l) as LanEvent)
    if (!sinceIso) return all
    const sinceMs = new Date(sinceIso).getTime()
    return all.filter((e) => {
      const ts = new Date(e.updated_at || e.created_at || 0).getTime()
      return ts > sinceMs
    })
  } catch {
    return []
  }
}

export function startLanHub(opts: LanHubOptions = {}) {
  const port = opts.port ?? 4000
  const secret = opts.secret ?? process.env.LAN_SYNC_SECRET
  const storeDir = opts.storeDir ?? DEFAULT_STORE_DIR

  const clientsByUnit = new Map<string, Set<WebSocket>>()

  const server = http.createServer(async (req, res) => {
    const url = parseUrl(req.url || '', true)

    // Basic CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    if (req.method === 'OPTIONS') {
      res.statusCode = 200
      res.end('OK')
      return
    }

    if (url.pathname === '/push' && req.method === 'POST') {
      if (!authBearerOk(req, secret)) {
        res.statusCode = 401
        res.end('unauthorized')
        return
      }
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}') as { events?: LanEvent[] }
          const events = (payload.events || []).map((e) => ({ ...e, created_at: e.created_at ?? new Date().toISOString() }))
          if (!events.length) {
            res.statusCode = 200
            res.end(JSON.stringify({ ok: true, count: 0 }))
            return
          }
          // group by unit_id
          const groups = new Map<string, LanEvent[]>()
          for (const e of events) {
            const u = e.unit_id || 'unknown'
            if (!groups.has(u)) groups.set(u, [])
            groups.get(u)!.push(e)
          }
          for (const [unitId, evs] of groups) {
            await appendEvents(storeDir, unitId, evs)
            const set = clientsByUnit.get(unitId)
            if (set && set.size) {
              const msg = JSON.stringify({ type: 'events', unit_id: unitId, events: evs })
              for (const ws of set) {
                try { ws.send(msg) } catch {}
              }
            }
          }
          res.statusCode = 200
          res.end(JSON.stringify({ ok: true, count: events.length }))
        } catch (err) {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false, error: (err as any)?.message || String(err) }))
        }
      })
      return
    }

    if (url.pathname === '/pull' && req.method === 'GET') {
      if (!authBearerOk(req, secret)) {
        res.statusCode = 401
        res.end('unauthorized')
        return
      }
      const unitId = (url.query['unit_id'] as string) || ''
      const since = (url.query['since'] as string) || ''
      if (!unitId) {
        res.statusCode = 400
        res.end('unit_id required')
        return
      }
      const events = await readEventsSince(storeDir, unitId, since)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true, unit_id: unitId, events }))
      return
    }

    res.statusCode = 404
    res.end('not found')
  })

  const wss = new WebSocketServer({ server, path: '/realtime' })
  const allClients = new Set<WebSocket>() // Todos os clientes para sync_storage
  
  wss.on('connection', (ws, req) => {
    const url = parseUrl(req.url || '', true)
    const token = (url.query['token'] as string) || ''
    if (secret && token !== secret) {
      ws.close(1008, 'unauthorized')
      return
    }
    let unitId = ''
    let deviceId = ''
    
    // Adiciona a lista de todos os clientes
    allClients.add(ws)
    
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { 
          unit_id?: string
          device_id?: string
          type?: string
          event?: any
        }
        
        // Eventos de sync_storage são propagados para todos os clientes
        if (msg.type === 'sync_event' && msg.event) {
          // Propaga para todos os outros clientes
          const broadcastMsg = JSON.stringify({ type: 'sync_event', event: msg.event })
          for (const client of allClients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              try {
                client.send(broadcastMsg)
              } catch {}
            }
          }
          return
        }
        
        // Lógica original para unit_id
        if (msg.unit_id && !unitId) {
          unitId = msg.unit_id
          deviceId = msg.device_id || ''
          if (!clientsByUnit.has(unitId)) clientsByUnit.set(unitId, new Set())
          clientsByUnit.get(unitId)!.add(ws)
          ws.send(JSON.stringify({ type: 'hello', unit_id: unitId }))
        }
      } catch {}
    })
    
    ws.on('close', () => {
      allClients.delete(ws)
      if (unitId && clientsByUnit.has(unitId)) {
        clientsByUnit.get(unitId)!.delete(ws)
      }
    })
  })

  server.listen(port, () => {
    console.log(`[LAN Hub] listening on http://localhost:${port} (store: ${storeDir})`)
  })

  return { close: () => server.close() }
}

