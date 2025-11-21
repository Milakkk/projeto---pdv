import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import * as ReactDOM from 'react-dom/client'
import Modal from '../../components/base/Modal'
import Button from '../../components/base/Button'
import Input from '../../components/base/Input'

type Props = { role: 'pos' | 'kds' | 'admin'; onClose: () => void; onComplete: (dp: any) => void }

const uuid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

export default function ProvisioningWizard({ role, onClose, onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [unitId, setUnitId] = useState('')
  const [deviceId, setDeviceId] = useState(uuid())
  const [station, setStation] = useState('')
  const [units, setUnits] = useState<any[]>([])
  const [stations, setStations] = useState<any[]>([])

  // Renderer: usar IPC seguro exposto pelo preload
  const query = async (sql: string, params?: any[]) => {
    // @ts-expect-error preload inject
    return (window?.api?.db?.query?.(sql, params)) as Promise<{ rows?: any[]; meta?: any; error?: any }>
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const resU = await query('SELECT * FROM units WHERE is_active = 1 ORDER BY name ASC', [])
      const uu = resU?.rows ?? []
      if (!mounted) return
      setUnits(uu)
      if (uu.length === 1) {
        setUnitId(String(uu[0].id))
        setStep(2)
        const resS = await query('SELECT * FROM stations WHERE unit_id = ? AND is_active = 1 ORDER BY name ASC', [uu[0].id])
        setStations(resS?.rows ?? [])
      }
    })()
    return () => { mounted = false }
  }, [])

  const canNext1 = useMemo(() => !!unitId, [unitId])
  const canNext2 = useMemo(() => !!deviceId && deviceId.trim().length > 0, [deviceId])

  async function handleNext() {
    if (step === 1 && canNext1) {
      setStep(2)
      const resS = await query('SELECT * FROM stations WHERE unit_id = ? AND is_active = 1 ORDER BY name ASC', [unitId])
      setStations(resS?.rows ?? [])
      return
    }
    if (step === 2 && canNext2) {
      if (role === 'kds') setStep(3)
      else await finish()
      return
    }
    if (step === 3) {
      await finish()
    }
  }

  async function finish() {
    const payload = { unitId, deviceId, role, station: role === 'kds' ? (station || null) : null }
    onComplete(payload)
  }

  return (
    <Modal isOpen onClose={onClose} title="Provisionamento do Dispositivo">
      {step === 1 && (
        <div>
          <div className="mb-2">Selecione a Loja (Unit)</div>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-full border p-2 rounded">
            <option value="">Selecione...</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <div className="mt-4 flex gap-2">
            <Button onClick={onClose} variant="secondary">Cancelar</Button>
            <Button onClick={handleNext} disabled={!canNext1}>Avançar</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="mb-2">Identidade do Dispositivo</div>
          <Input label="Device ID" value={deviceId} onChange={(e: any) => setDeviceId(e.target.value)} />
          <div className="mt-4 flex gap-2">
            <Button onClick={() => setStep(1)} variant="secondary">Voltar</Button>
            <Button onClick={handleNext} disabled={!canNext2}>{role === 'kds' ? 'Avançar' : 'Concluir'}</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="mb-2">Estação (somente KDS)</div>
          <select value={station} onChange={(e) => setStation(e.target.value)} className="w-full border p-2 rounded">
            <option value="">Geral</option>
            {stations.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => setStep(2)} variant="secondary">Voltar</Button>
            <Button onClick={handleNext}>Concluir</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// Expor função global para o serviço abrir o wizard
;(window as any).ui = (window as any).ui || {}
;(window as any).ui.openProvisioningWizard = async ({ role }: { role: 'pos' | 'kds' | 'admin' }) => {
  return new Promise<any>((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const onClose = () => {
      document.body.removeChild(container)
    }
    const onComplete = (dp: any) => {
      resolve(dp)
      onClose()
    }
    // Usar ReactDOM.createRoot para montar o modal isolado
    const root = ReactDOM.createRoot(container)
    root.render(React.createElement(ProvisioningWizard, { role, onClose, onComplete }))
  })
}
