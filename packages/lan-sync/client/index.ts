type LanClientOptions = {
  hubUrl: string
  secret?: string
}

type LanEvent = {
  table: string
  rows?: any[]
  row?: any
  unit_id?: string
  created_at?: string
  updated_at?: string
}

export class LanClient {
  private hubUrl: string
  private secret?: string
  private ws?: WebSocket
  private unitId?: string
  private deviceId?: string
  private onEventCb?: (events: LanEvent[]) => void

  constructor(opts: LanClientOptions) {
    this.hubUrl = opts.hubUrl.replace(/\/$/, '')
    this.secret = opts.secret
  }

  connect(unit_id: string, device_id: string) {
    this.unitId = unit_id
    this.deviceId = device_id
    const wsUrl = this.hubUrl.replace(/^http/, 'ws') + `/realtime?token=${encodeURIComponent(this.secret || '')}`
    const ws = new WebSocket(wsUrl)
    this.ws = ws
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ unit_id, device_id }))
    })
    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(String(ev.data))
        if (msg?.type === 'events' && Array.isArray(msg.events)) {
          this.onEventCb?.(msg.events as LanEvent[])
        }
      } catch {}
    })
    ws.addEventListener('close', () => {
      // auto-reconnect
      setTimeout(() => {
        if (this.unitId && this.deviceId) this.connect(this.unitId, this.deviceId)
      }, 1000)
    })
  }

  onEvent(cb: (events: LanEvent[]) => void) { this.onEventCb = cb }

  async push(events: LanEvent[]): Promise<{ ok: boolean; count?: number }> {
    const url = `${this.hubUrl}/push`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.secret ? { Authorization: `Bearer ${this.secret}` } : {}),
      },
      body: JSON.stringify({ events }),
    })
    if (!res.ok) return { ok: false }
    try { return await res.json() } catch { return { ok: true } }
  }

  async pull(unit_id: string, sinceIso?: string): Promise<LanEvent[]> {
    const qp = new URLSearchParams({ unit_id })
    if (sinceIso) qp.set('since', sinceIso)
    const url = `${this.hubUrl}/pull?${qp.toString()}`
    const res = await fetch(url, {
      headers: {
        ...(this.secret ? { Authorization: `Bearer ${this.secret}` } : {}),
      },
    })
    if (!res.ok) return []
    try {
      const json = await res.json()
      return Array.isArray(json?.events) ? (json.events as LanEvent[]) : []
    } catch { return [] }
  }
}

