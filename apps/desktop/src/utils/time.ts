export function formatDurationSeconds(
  seconds: number,
  opts?: { minSeconds?: number },
) {
  const raw = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const minSeconds = Number.isFinite(opts?.minSeconds)
    ? Math.max(0, Math.floor(opts!.minSeconds!))
    : 0
  const safeSeconds = raw === 0 && minSeconds > 0 ? minSeconds : raw

  const mins = Math.floor(safeSeconds / 60)
  const secs = Math.floor(safeSeconds % 60)

  if (mins === 0 && secs === 0) {
    return minSeconds > 0 ? `${minSeconds}s` : '0s'
  }

  const parts: string[] = []
  if (mins > 0) parts.push(`${mins.toString().padStart(2, '0')}m`)
  if (secs > 0) parts.push(`${secs.toString().padStart(2, '0')}s`)
  return parts.join(' ')
}

export function normalizeSlaMinutes(raw: unknown, fallback = 15) {
  const asNumber =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw)
        : Number.NaN
  const base = Number.isFinite(asNumber) ? Math.floor(asNumber) : 0
  const safeFallback = Number.isFinite(fallback) ? Math.max(1, Math.floor(fallback)) : 15
  return base >= 1 ? base : safeFallback
}

