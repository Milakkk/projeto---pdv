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
  const res = await query('SELECT * FROM device_profile LIMIT 1', [])
  const row = (res?.rows ?? [])[0]
  return row ? mapRow(row) : null
}

export async function saveDeviceProfile(payload: DeviceProfile): Promise<void> {
  const now = new Date().toISOString()
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
