import { useMemo } from 'react'
import { useLocalStorage } from '../../../hooks/useLocalStorage'
import Button from '../../../components/base/Button'
import { mockStores } from '../../../mocks/auth'

const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export default function StoreOperatingDays() {
  const [selectedStoreId, setSelectedStoreId] = useLocalStorage<string>('master_operating_selected_store_id', mockStores[0].id)
  const [operatingDays, setOperatingDays] = useLocalStorage<Record<string, number[]>>('master_store_operating_days', {})
  const openDays = useMemo(() => operatingDays[selectedStoreId] ?? [0,1,2,3,4,5,6], [operatingDays, selectedStoreId])

  const toggleDay = (d: number) => {
    const setForStore = new Set(openDays)
    if (setForStore.has(d)) setForStore.delete(d)
    else setForStore.add(d)
    const next = { ...operatingDays, [selectedStoreId]: Array.from(setForStore).sort((a,b)=>a-b) }
    setOperatingDays(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <select className="border border-gray-300 rounded-md px-3 py-2 text-sm" value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}>
          {mockStores.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <Button variant="secondary" size="sm">
          <i className="ri-information-line mr-2"></i>
          Dias de funcionamento por loja
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {dayNames.map((label, idx) => {
          const checked = openDays.includes(idx)
          return (
            <label key={label} className={`flex items-center justify-between border rounded-lg px-3 py-2 text-sm ${checked ? 'border-amber-500 bg-amber-50' : 'border-gray-300 bg-white'}`}>
              <span>{label}</span>
              <input type="checkbox" checked={checked} onChange={() => toggleDay(idx)} />
            </label>
          )
        })}
      </div>
    </div>
  )
}

