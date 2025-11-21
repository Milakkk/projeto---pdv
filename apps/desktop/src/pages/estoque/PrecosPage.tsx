import { useEffect, useState } from 'react'
import Input from '@/components/base/Input'
import Button from '@/components/base/Button'
import * as inventory from '@/offline/services/inventoryService'

export default function EstoquePrecosPage() {
  const [ingredients, setIngredients] = useState<any[]>([])
  const [prices, setPrices] = useState<any[]>([])
  const [form, setForm] = useState<{ unit: string; price: string }>({ unit: 'g', price: '' })
  const [formIngredientName, setFormIngredientName] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string>('')
  const [editing, setEditing] = useState<{ unit: string; price: string }>({ unit: 'g', price: '' })

  useEffect(() => {
    ;(async () => {
      const ing = await inventory.listIngredients()
      setIngredients(ing)
      const pr = await inventory.listPrices()
      setPrices(pr)
    })()
  }, [])

  const save = async () => {
    const name = formIngredientName.trim()
    if (!name || !form.unit || !form.price) return
    const normalized = form.price.replace(',', '.')
    const cents = Math.max(0, Math.round(parseFloat(normalized) * 100))
    const existing = ingredients.find(i => String(i.name).toLowerCase() === name.toLowerCase())
    const ingredientId = existing ? String(existing.id) : await inventory.upsertIngredient({ name })
    await inventory.upsertPrice({ ingredientId, unit: form.unit, pricePerUnitCents: cents })
    const [ing, pr] = await Promise.all([inventory.listIngredients(), inventory.listPrices()])
    setIngredients(ing)
    setPrices(pr)
    setForm({ unit: 'g', price: '' })
    setFormIngredientName('')
  }

  const ingredientExists = (formIngredientName || '').trim() && ingredients.some(i => String(i.name).toLowerCase() === formIngredientName.trim().toLowerCase())

  const startEdit = (p: any) => {
    setEditingId(String(p.id))
    setEditing({ unit: String(p.unit), price: String(((p.price_per_unit_cents ?? 0)/100).toFixed(2)) })
  }
  const cancelEdit = () => { setEditingId(''); setEditing({ unit: 'g', price: '' }) }
  const confirmEdit = async () => {
    if (!editingId) return
    const normalized = editing.price.replace(',', '.')
    const cents = Math.max(0, Math.round(parseFloat(normalized) * 100))
    const target = prices.find((x:any)=> String(x.id)===String(editingId))
    if (!target) return
    await inventory.upsertPrice({ id: editingId, ingredientId: String(target.ingredient_id), unit: editing.unit, pricePerUnitCents: cents })
    const pr = await inventory.listPrices()
    setPrices(pr)
    cancelEdit()
  }
  const removePrice = async (id: string) => {
    await inventory.deletePrice(id)
    const pr = await inventory.listPrices()
    setPrices(pr)
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Insumos</h1>

      

      <div className="bg-white border rounded p-4 mb-6">
        <h2 className="font-medium mb-3">Cadastrar insumo e preço</h2>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">Nome do insumo</label>
            <Input className="h-9" value={formIngredientName} onChange={e=>setFormIngredientName(e.target.value)} placeholder="Nome do insumo" />
            {ingredientExists && (
              <div className="text-xs text-red-600 mt-1">Este insumo já existe</div>
            )}
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">Unidade</label>
              <select className="border rounded px-2 h-9 w-28" value={form.unit} onChange={e=>setForm({ ...form, unit: e.target.value })}>
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="l">L</option>
                <option value="un">un</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Preço</label>
              <div className="flex items-center w-32">
                <span className="px-3 h-9 flex items-center border rounded-l bg-gray-50">R$</span>
                <Input className="h-9 rounded-l-none w-full" value={form.price} onChange={e=>setForm({ ...form, price: e.target.value })} placeholder="Preço" />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Button onClick={save} disabled={!formIngredientName.trim() || !form.price}>Salvar</Button>
        </div>
      </div>

      <div className="bg-white border rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Tabela de preços dos insumos</h2>
        </div>
        <div className="mb-3">
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar insumo na tabela" />
        </div>
        <div className="grid grid-cols-6 gap-2 text-sm font-medium text-gray-700 mb-2 bg-gray-100 rounded px-2 py-2">
          <div>Insumo</div>
          <div>Unidade</div>
          <div>Preço</div>
          <div>Atualizado</div>
          <div>Usuário</div>
          <div>Ações</div>
        </div>
        {prices.length === 0 ? (
          <div className="text-sm text-gray-500">Nenhum preço cadastrado</div>
        ) : (
          <div className="divide-y">
            {prices.filter((p:any)=>{
              const name = ingredients.find(i=>String(i.id)===String(p.ingredient_id))?.name || ''
              return name.toLowerCase().includes(search.toLowerCase())
            }).map((p:any)=> (
              <div key={p.id} className="py-2 grid grid-cols-6 gap-2 items-center">
                <div className="text-sm">{ingredients.find(i=>String(i.id)===String(p.ingredient_id))?.name || p.ingredient_id}</div>
                <div className="text-sm">{editingId===String(p.id) ? (
                  <select className="border rounded px-2 py-1" value={editing.unit} onChange={e=>setEditing({...editing, unit: e.target.value})}>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="l">L</option>
                    <option value="un">un</option>
                  </select>
                ) : p.unit}</div>
                <div className="text-sm font-medium">{editingId===String(p.id) ? (
                  <Input value={editing.price} onChange={e=>setEditing({...editing, price: e.target.value})} />
                ) : (
                  <>R$ {((p.price_per_unit_cents ?? 0)/100).toFixed(2)}</>
                )}</div>
                <div className="text-xs text-gray-500">{String(p.updated_at || '').replace('T',' ').slice(0,19)}</div>
                <div className="text-xs text-gray-500">{String((p.updated_by ?? '') || '').trim() || '—'}</div>
                <div className="flex gap-2">
                  {editingId===String(p.id) ? (
                    <>
                      <Button size="sm" onClick={confirmEdit}>Salvar</Button>
                      <Button size="sm" variant="secondary" onClick={cancelEdit}>Cancelar</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="secondary" onClick={()=>startEdit(p)}><i className="ri-pencil-line"></i></Button>
                      <Button size="sm" variant="secondary" onClick={()=>removePrice(String(p.id))}><i className="ri-delete-bin-line"></i></Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
