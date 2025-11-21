import { useEffect, useMemo, useRef, useState } from 'react'
import { getOperationInfo } from '../offline/services/syncInfoService'
import { useNavigate } from 'react-router-dom'

type BadgeProps = {
  compact?: boolean
}

export default function OperationModeBadge({ compact }: BadgeProps) {
  const [mode, setMode] = useState<'Online' | 'Offline' | 'Híbrido'>('Online')
  const [queue, setQueue] = useState<number>(0)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [ip, setIp] = useState<string | null>(null)
  const [unitName, setUnitName] = useState<string | null>(null)
  const navigate = useNavigate()
  const timerRef = useRef<number | null>(null)

  const colors = useMemo(() => {
    switch (mode) {
      case 'Offline':
        return 'bg-amber-100 text-amber-700 border border-amber-200'
      case 'Híbrido':
        return 'bg-sky-100 text-sky-700 border border-sky-200'
      default:
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    }
  }, [mode])

  const icon = useMemo(() => {
    switch (mode) {
      case 'Offline':
        return 'ri-wifi-off-line'
      case 'Híbrido':
        return 'ri-cloud-line'
      default:
        return 'ri-wifi-line'
    }
  }, [mode])

  async function refresh() {
    const info = await getOperationInfo()
    setMode(info.mode)
    setQueue(info.queueSize)
    setLastSync(info.lastSyncAt)
    setIp(info.localIp || null)
    setUnitName(info.unitName || null)
  }

  useEffect(() => {
    refresh()
    timerRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 10_000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const label = `Modo de operação: ${mode} (fila ${queue}, última sync ${lastSync ? new Date(lastSync).toLocaleTimeString() : '—'})`
  const tooltipText = `Modo: ${mode} | Última sync: ${lastSync ? new Date(lastSync).toLocaleString() : '—'} | IP: ${ip ?? '—'} | unidade: ${unitName ?? '—'}`

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => navigate('/caixa/configuracoes?tab=device')}
      className={`group inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ${colors}`}
      title={tooltipText}
    >
      <i className={`${icon} text-base`} aria-hidden="true" />
      {!compact && (
        <span className="font-medium">{mode}</span>
      )}
      <span className="ml-1 text-xs text-gray-600">fila: {queue}</span>
      {/* Accessible tooltip hook */}
      <span role="tooltip" className="sr-only">{tooltipText}</span>
    </button>
  )
}
