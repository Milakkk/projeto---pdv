import { useMemo, useState } from 'react'
import Button from '../../../components/base/Button'
import Input from '../../../components/base/Input'
import { useLocalStorage } from '../../../hooks/useLocalStorage'

type Person = {
  id: string
  name: string
  scheduleType: string
}

type PeopleManagerProps = {
  storeId: string
  scheduleTypes: string[]
}

export default function PeopleManager({ storeId, scheduleTypes }: PeopleManagerProps) {
  const storageKey = `rh_people:${storeId}`
  const [people, setPeople] = useLocalStorage<Person[]>(storageKey, [])
  const [name, setName] = useState('')
  const [type, setType] = useState('')

  const canAdd = useMemo(() => name.trim().length > 1 && type.trim().length > 0, [name, type])

  const addPerson = () => {
    if (!canAdd) return
    const p: Person = { id: crypto.randomUUID(), name: name.trim(), scheduleType: type }
    setPeople([...people, p])
    setName('')
    setType('')
  }

  const removePerson = (id: string) => {
    setPeople(people.filter(p => p.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input label="Nome" value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: João Silva" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de escala</label>
          <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={type} onChange={e => setType(e.target.value)}>
            <option value="">Selecione...</option>
            {scheduleTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={addPerson} disabled={!canAdd} className="w-full">
            <i className="ri-user-add-line mr-2"></i>
            Adicionar pessoa
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-2 border-b border-gray-200 text-sm font-semibold">Pessoas cadastradas</div>
        {people.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-600">Nenhuma pessoa cadastrada para esta loja.</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {people.map(p => (
              <li key={p.id} className="px-4 py-2 flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-gray-600">· {p.scheduleType}</span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => removePerson(p.id)}>
                  <i className="ri-delete-bin-6-line mr-2"></i>
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

