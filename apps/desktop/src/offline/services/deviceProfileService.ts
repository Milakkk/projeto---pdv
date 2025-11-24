// Renderer: usar IPC seguro exposto pelo preload
const query = async (sql: string, params?: any[]) => {
  const fn = (window as any)?.api?.db?.query
  if (typeof fn !== 'function') throw new Error('Canal de DB indisponível')
  try {
    const res = await fn(sql, params)
    if (res?.error) throw new Error(String(res.error))
    return res as { rows?: any[]; meta?: any; error?: any }
  } catch (e) {
    await new Promise(r => setTimeout(r, 200))
    const res2 = await fn(sql, params)
    if (res2?.error) throw new Error(String(res2.error))
    return res2 as { rows?: any[]; meta?: any; error?: any }
  }
}

export type DeviceProfile = {
  id?: number
  unitId: string
  deviceId: string
  role: 'pos' | 'kds' | 'admin'
  station?: string | null
  updatedAt?: string
}

export async function getDeviceProfile(): Promise<DeviceProfile | null> {
  try {
    const res = await query('SELECT * FROM device_profile LIMIT 1', [])
    const row = (res?.rows ?? [])[0]
    return row ? mapRow(row) : readDeviceProfileLS()
  } catch {
    return readDeviceProfileLS()
  }
}

export async function saveDeviceProfile(payload: DeviceProfile): Promise<void> {
  const now = new Date().toISOString()
  try {
    const current = await getDeviceProfile()
    if (!current) {
      await query(
        'INSERT INTO device_profile (unit_id, device_id, role, station, updated_at) VALUES (?, ?, ?, ?, ?)',
        [payload.unitId, payload.deviceId, payload.role, payload.station ?? null, now],
      )
    } else {
      await query(
        'UPDATE device_profile SET unit_id = ?, device_id = ?, role = ?, station = ?, updated_at = ? WHERE id = ?',
        [payload.unitId, payload.deviceId, payload.role, payload.station ?? null, now, current.id],
      )
    }
  } catch {
    writeDeviceProfileLS({ ...payload, updatedAt: now })
  }
}

function mapRow(r: any): DeviceProfile {
  return {
    id: Number(r.id),
    unitId: String(r.unitId ?? r.unit_id ?? ''),
    deviceId: String(r.deviceId ?? r.device_id ?? ''),
    role: (String(r.role) as any) ?? 'pos',
    station: r.station ? String(r.station) : null,
    updatedAt: String(r.updatedAt ?? r.updated_at ?? ''),
  }
}

// Wizard orchestrator
export async function ensureDeviceProfile(opts: { role: 'pos' | 'kds' | 'admin' }): Promise<DeviceProfile> {
  const existing = await getDeviceProfile()
  if (existing && existing.role === opts.role && existing.unitId) return existing

  // @ts-expect-error injected by app layer
  const openWizard = window?.ui?.openProvisioningWizard
  if (typeof openWizard === 'function') {
    const dp = await openWizard({ role: opts.role })
    await saveDeviceProfile(dp)
    return dp
  }
  // Fallback silencioso: cria/atualiza perfil sem prompts
  const unitId = existing?.unitId ?? null
  const deviceId = existing?.deviceId ?? crypto.randomUUID()
  const station: string | null = existing?.station ?? null
  const payload: DeviceProfile = { unitId, deviceId, role: opts.role, station }
  await saveDeviceProfile(payload)
  return payload
}

export async function getCurrentUnitId(): Promise<string | null> {
  const dp = await getDeviceProfile()
  return dp?.unitId ?? null
}

function readDeviceProfileLS(): DeviceProfile | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('deviceProfile') : null
    if (raw) {
      const obj = JSON.parse(raw)
      const unitId = typeof obj.unitId === 'string' ? obj.unitId : ''
      const deviceId = typeof obj.deviceId === 'string' ? obj.deviceId : crypto.randomUUID()
      const role = (obj.role || 'pos') as any
      const station = obj.station ? String(obj.station) : null
      const updatedAt = obj.updatedAt ? String(obj.updatedAt) : new Date().toISOString()
      return { unitId, deviceId, role, station, updatedAt }
    }
    const unitIdLS = typeof localStorage !== 'undefined' ? localStorage.getItem('unitId') : null
    const deviceIdLS = typeof localStorage !== 'undefined' ? localStorage.getItem('deviceId') : null
    if (unitIdLS || deviceIdLS) {
      return { unitId: unitIdLS || '', deviceId: deviceIdLS || crypto.randomUUID(), role: 'pos', station: null, updatedAt: new Date().toISOString() }
    }
  } catch {}
  return null
}

function writeDeviceProfileLS(payload: DeviceProfile): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('deviceProfile', JSON.stringify(payload))
      if (payload.unitId) localStorage.setItem('unitId', String(payload.unitId))
      if (payload.deviceId) localStorage.setItem('deviceId', String(payload.deviceId))
    }
  } catch {}
}
