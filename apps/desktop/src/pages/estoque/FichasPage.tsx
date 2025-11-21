import { useEffect, useMemo, useState } from 'react'
import Input from '@/components/base/Input'
import Button from '@/components/base/Button'
import Modal from '@/components/base/Modal'
import * as inventory from '@/offline/services/inventoryService'
import * as productsService from '@/offline/services/productsService'

export default function EstoqueFichasPage() {
  const [products, setProducts] = useState<any[]>([])
  const [ingredients, setIngredients] = useState<any[]>([])
  const [ingredientPrices, setIngredientPrices] = useState<any[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [recipe, setRecipe] = useState<any[]>([])
  const [recipesByProduct, setRecipesByProduct] = useState<Record<string, any[]>>({})

  const [activeTab, setActiveTab] = useState<'list' | 'edit'>('list')
  const [categories, setCategories] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set())
  const [editingLineId, setEditingLineId] = useState<string>('')
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)

  const [newLine, setNewLine] = useState<{ ingredientId: string; quantity: string; unit: string }>({ ingredientId: '', quantity: '', unit: 'g' })

  useEffect(() => {
    ;(async () => {
      try {
        const prods = await productsService.listProducts()
        setProducts(Array.isArray(prods) ? prods : [])
      } catch { setProducts([]) }
      try {
        const ing = await inventory.listIngredients()
        setIngredients(Array.isArray(ing) ? ing : [])
      } catch { setIngredients([]) }
      try {
        const cats = await productsService.listCategories()
        setCategories(Array.isArray(cats) ? cats : [])
      } catch { setCategories([]) }
      try {
        const pr = await inventory.listPrices()
        setIngredientPrices(Array.isArray(pr) ? pr : [])
      } catch { setIngredientPrices([]) }
      try {
        const map: Record<string, any[]> = {}
        for (const p of (products || [])) {
          const pid = String((p as any).id)
          try { map[pid] = await inventory.listRecipeByProduct(pid) } catch { map[pid] = [] }
        }
        setRecipesByProduct(map)
      } catch { setRecipesByProduct({}) }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        if (!selectedProductId) { setRecipe([]); return }
        const lines = await inventory.listRecipeByProduct(selectedProductId)
        setRecipe(Array.isArray(lines) ? lines : [])
      } catch { setRecipe([]) }
    })()
  }, [selectedProductId])

  const selectedProduct = useMemo(() => products.find(p => String(p.id) === String(selectedProductId)) || null, [products, selectedProductId])
  const selectedCategoryName = useMemo(() => {
    const catId = selectedProduct ? (selectedProduct.categoryId ?? selectedProduct.category_id) : ''
    const cat = categories.find((c:any)=> String(c.id) === String(catId))
    return cat ? String(cat.name) : ''
  }, [selectedProduct, categories])

  const getUnitsFor = (ingredientId: string) => {
    const base = Array.from(new Set((ingredientPrices || [])
      .filter((p:any)=> String(p.ingredient_id) === String(ingredientId))
      .map((p:any)=> String(p.unit).toLowerCase())))
    const set = new Set(base)
    if (set.has('g')) set.add('kg')
    if (set.has('kg')) set.add('g')
    if (set.has('ml')) set.add('l')
    if (set.has('l')) set.add('ml')
    return Array.from(set)
  }

  const addLine = async () => {
    if (!selectedProductId || !newLine.ingredientId || !newLine.unit) return
    const qty = parseFloat(newLine.quantity || '0')
    if (qty <= 0) return
    await inventory.upsertRecipeLine({ productId: selectedProductId, ingredientId: newLine.ingredientId, quantity: qty, unit: newLine.unit })
    const lines = await inventory.listRecipeByProduct(selectedProductId)
    setRecipe(lines)
    setNewLine({ ingredientId: '', quantity: '', unit: 'g' })
  }

  const removeLine = async (id: string) => {
    await inventory.deleteRecipeLine(id)
    const lines = await inventory.listRecipeByProduct(selectedProductId)
    setRecipe(lines)
  }

  const allowedUnitsForIngredient = useMemo(() => {
    if (!newLine.ingredientId) return ['g', 'kg', 'ml', 'l', 'un']
    const base = Array.from(new Set((ingredientPrices || [])
      .filter((p:any)=> String(p.ingredient_id) === String(newLine.ingredientId))
      .map((p:any)=> String(p.unit).toLowerCase())))
    const set = new Set(base)
    if (set.has('g')) set.add('kg')
    if (set.has('kg')) set.add('g')
    if (set.has('ml')) set.add('l')
    if (set.has('l')) set.add('ml')
    return Array.from(set)
  }, [ingredientPrices, newLine.ingredientId])

  useEffect(() => {
    if (!newLine.ingredientId) return
    if (!allowedUnitsForIngredient.includes(newLine.unit)) {
      setNewLine((nl)=> ({ ...nl, unit: allowedUnitsForIngredient[0] || 'g' }))
    }
  }, [newLine.ingredientId, allowedUnitsForIngredient])

  const getUnitPriceCentsFor = (ingredientId: string, unit: string) => {
    const pricesFor = (ingredientPrices || []).filter((pr:any)=> String(pr.ingredient_id) === String(ingredientId))
    for (const pr of pricesFor) {
      if (String(pr.unit).toLowerCase() === String(unit).toLowerCase()) return pr.price_per_unit_cents || 0
    }
    if (pricesFor.length > 0) {
      const pr0 = pricesFor[0]
      const conv = inventory.convert(unit, pr0.unit, 1)
      return Math.round(conv * Math.max(0, pr0.price_per_unit_cents||0))
    }
    return 0
  }

  const newLinePreview = useMemo(() => {
    if (!newLine.ingredientId || !newLine.unit) return { unitCents: 0, totalCents: 0 }
    const unitCents = getUnitPriceCentsFor(newLine.ingredientId, newLine.unit)
    const qty = parseFloat(newLine.quantity||'0')
    const totalCents = Math.round(Math.max(0, qty) * Math.max(0, unitCents))
    return { unitCents, totalCents }
  }, [newLine.ingredientId, newLine.unit, newLine.quantity, ingredientPrices])

  const editTotalCents = useMemo(() => {
    return (recipe || []).reduce((s:number, r:any)=>{
      const unitCents = getUnitPriceCentsFor(String(r.ingredient_id), String(r.unit))
      return s + Math.round(Math.max(0, Number(r.quantity||0)) * Math.max(0, unitCents))
    }, 0)
  }, [recipe, ingredientPrices])

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Fichas Técnicas</h1>
        <div className="flex gap-2">
          <Button variant={activeTab==='list'?'primary':'secondary'} onClick={()=>setActiveTab('list')}>Listar</Button>
          <Button variant={activeTab==='edit'?'primary':'secondary'} onClick={()=>setActiveTab('edit')}>Criar/Editar</Button>
        </div>
      </div>
      {activeTab === 'edit' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded p-4">
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Item do Cardápio</label>
            <select className="w-full border rounded px-3 py-2" value={selectedProductId} onChange={e=>setSelectedProductId(e.target.value)}>
              <option value="">Selecione</option>
              {products.map(p=> {
                const catName = categories.find((c:any)=> String(c.id) === String(p.categoryId ?? p.category_id))?.name || ''
                return (
                  <option key={String(p.id)} value={String(p.id)}>{catName ? `${catName} • ` : ''}{p.name}</option>
                )
              })}
            </select>
          </div>

          {selectedProduct && (
            <div className="text-sm text-gray-600 mb-4">Categoria: {selectedCategoryName}</div>
          )}

          <div className="border-t pt-3 mt-3">
            <h2 className="font-medium mb-2">Insumos da ficha</h2>
            {recipe.length === 0 ? (
              <div className="text-sm text-gray-500">Nenhum insumo cadastrado</div>
            ) : (
              <div>
                <div className="grid gap-2 text-sm font-medium text-gray-700 mb-2 bg-gray-100 rounded px-2 py-2" style={{ gridTemplateColumns: '5fr 1fr 1fr 2fr 2fr 1fr' }}>
                  <div>Insumo</div>
                  <div className="flex items-center justify-center">Qtd</div>
                  <div className="flex items-center justify-center">Unidade</div>
                  <div className="flex items-center justify-center">Unitário</div>
                  <div className="flex items-center justify-center">Total</div>
                  <div className="flex items-center justify-center">Ações</div>
                </div>
                {recipe.map((r:any)=> {
                  const unitCents = getUnitPriceCentsFor(String(r.ingredient_id), String(r.unit))
                  const totalCents = Math.round(Math.max(0, Number(r.quantity||0)) * Math.max(0, unitCents))
                  const ingName = (ingredients.find(i=>String(i.id)===String(r.ingredient_id))?.name)|| r.ingredient_id
                  const isEditing = editingLineId === String(r.id)
                  return (
                    <div key={r.id} className="py-2 grid gap-2 items-center" style={{ gridTemplateColumns: '5fr 1fr 1fr 2fr 2fr 1fr' }}>
                      <div className="text-sm">{ingName}</div>
                      <div className="text-sm text-center">
                        {!isEditing ? (
                          <span>{r.quantity}</span>
                        ) : (
                          <Input className="w-20 h-9" value={String(r.quantity)} onChange={async e=>{
                            const qty = parseFloat(e.target.value||'0')
                            if (qty>0) {
                              await inventory.upsertRecipeLine({ id: r.id, productId: selectedProductId, ingredientId: r.ingredient_id, quantity: qty, unit: r.unit })
                              const lines = await inventory.listRecipeByProduct(selectedProductId)
                              setRecipe(lines)
                            }
                          }} />
                        )}
                      </div>
                      <div className="text-sm text-center">
                        {!isEditing ? (
                          <span>{r.unit}</span>
                        ) : (
                          <select className="border rounded px-2 h-9" value={r.unit} onChange={async e=>{
                            const nu = e.target.value
                            await inventory.upsertRecipeLine({ id: r.id, productId: selectedProductId, ingredientId: r.ingredient_id, quantity: r.quantity, unit: nu })
                            const lines = await inventory.listRecipeByProduct(selectedProductId)
                            setRecipe(lines)
                          }}>
                            {getUnitsFor(String(r.ingredient_id)).map(u => (
                              <option key={u} value={u}>{u === 'l' ? 'L' : u}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div className="text-sm text-center">R$ {(unitCents/100).toFixed(2)}</div>
                      <div className="text-sm font-medium text-center">R$ {(totalCents/100).toFixed(2)}</div>
                      <div className="flex items-center justify-center gap-2">
                        {isEditing ? (
                          <Button size="sm" onClick={()=>setEditingLineId('')}>Concluir</Button>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={()=>setEditingLineId(String(r.id))}><i className="ri-pencil-line"></i></Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={()=>removeLine(String(r.id))}><i className="ri-delete-bin-line"></i></Button>
                      </div>
                    </div>
                  )
                })}
                <div className="mt-2 grid gap-2 px-2" style={{ gridTemplateColumns: '5fr 1fr 1fr 2fr 2fr 1fr' }}>
                  <div></div>
                  <div></div>
                  <div></div>
                  <div></div>
                  <div className="text-sm font-medium text-center">R$ {(editTotalCents/100).toFixed(2)}</div>
                  <div></div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border rounded p-4">
          <h2 className="font-medium mb-3">Adicionar insumo à ficha</h2>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">Insumo</label>
              <select className="border rounded px-2 h-9 w-full" value={newLine.ingredientId} onChange={e=>setNewLine({...newLine, ingredientId: e.target.value})}>
                <option value="">Selecione</option>
                {[...ingredients].sort((a:any,b:any)=> String(a.name||'').localeCompare(String(b.name||''), 'pt-BR', { sensitivity: 'base' })).map(i=> (
                  <option key={String(i.id)} value={String(i.id)}>{i.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Quantidade</label>
              <Input className="w-24 h-9" value={newLine.quantity} onChange={e=>setNewLine({...newLine, quantity: e.target.value})} placeholder="Qtd" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Unidade</label>
              <select className="border rounded px-2 h-9 w-24" value={newLine.unit} onChange={e=>setNewLine({...newLine, unit: e.target.value})}>
                {allowedUnitsForIngredient.map(u => (
                  <option key={u} value={u}>{u === 'l' ? 'L' : u}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {newLine.ingredientId && newLine.quantity ? (
              <>Preço unitário: R$ {(newLinePreview.unitCents/100).toFixed(2)} • Total: R$ {(newLinePreview.totalCents/100).toFixed(2)}</>
            ) : null}
          </div>
          <div className="mt-3">
            <Button onClick={async ()=>{
              const exists = recipe.some((r:any)=> String(r.ingredient_id)===String(newLine.ingredientId))
              if (exists) { setShowDuplicateModal(true); return }
              await addLine()
            }} disabled={!selectedProductId || !newLine.ingredientId || !newLine.quantity}>Adicionar</Button>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'list' && (
        <div className="bg-white border rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <Input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Buscar por nome do lanche" />
          </div>
          <div className="divide-y">
            {products.filter(p=> p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(p=> {
              const lines = recipesByProduct[String(p.id)] || []
              const totalCents = lines.reduce((s:number, r:any)=>{
                const pricesFor = ingredientPrices.filter((pr:any)=> String(pr.ingredient_id) === String(r.ingredient_id))
                let unitPrice = 0
                for (const pr of pricesFor) {
                  if (String(pr.unit).toLowerCase() === String(r.unit).toLowerCase()) { unitPrice = pr.price_per_unit_cents; break }
                }
                if (unitPrice === 0 && pricesFor.length > 0) {
                  const pr0 = pricesFor[0]
                  const convertedQty = inventory.convert(r.unit, pr0.unit, Number(r.quantity||0))
                  return s + Math.round(convertedQty * Math.max(0, pr0.price_per_unit_cents||0))
                }
                return s + Math.round(Number(r.quantity||0) * Math.max(0, unitPrice||0))
              }, 0)
              const catName = categories.find((c:any)=> String(c.id) === String(p.categoryId ?? p.category_id))?.name || ''
              const isExpanded = expandedProductIds.has(String(p.id))
              return (
                <div key={String(p.id)} className="py-2">
                  <div className="flex items-center justify-between cursor-pointer" onClick={()=>{
                    setExpandedProductIds(prev=>{
                      const next = new Set(Array.from(prev))
                      const pid = String(p.id)
                      if (next.has(pid)) next.delete(pid); else next.add(pid)
                      return next
                    })
                  }}>
                    <div>
                      <div className="text-sm font-medium">{catName ? `${catName} • ` : ''}{p.name}</div>
                      <div className="text-xs text-gray-500">Custo: R$ {(totalCents/100).toFixed(2)}</div>
                    </div>
                    <i className={isExpanded ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 space-y-2 max-w-xl">
                      {lines.length === 0 ? (
                        <div className="text-sm text-gray-500">Nenhum insumo cadastrado</div>
                      ) : (
                        <div>
                          <div className="grid gap-2 text-sm font-medium text-gray-700 mb-2 bg-gray-100 rounded px-2 py-2" style={{ gridTemplateColumns: '6fr 2fr 2fr 2fr' }}>
                            <div>Insumo</div>
                            <div className="flex items-center justify-center">Qtd</div>
                            <div className="flex items-center justify-center">Unitário</div>
                            <div className="flex items-center justify-center">Total</div>
                          </div>
                          {lines.map((r:any)=>{
                            const unitCents = getUnitPriceCentsFor(String(r.ingredient_id), String(r.unit))
                            const totalLineCents = Math.round(Math.max(0, Number(r.quantity||0)) * Math.max(0, unitCents))
                            const ingName = ingredients.find(i=>String(i.id)===String(r.ingredient_id))?.name || r.ingredient_id
                            return (
                              <div key={String(r.id)} className="py-1 grid gap-2 items-center bg-gray-50 rounded px-2" style={{ gridTemplateColumns: '6fr 2fr 2fr 2fr' }}>
                                <div className="text-sm">{ingName}</div>
                                <div className="text-sm text-center">{r.quantity} {r.unit}</div>
                                <div className="text-sm text-center">R$ {(unitCents/100).toFixed(2)}</div>
                                <div className="text-sm font-medium text-center">R$ {(totalLineCents/100).toFixed(2)}</div>
                              </div>
                            )
                          })}
                          <div className="grid gap-2 mt-2 px-2" style={{ gridTemplateColumns: '6fr 2fr 2fr 2fr' }}>
                            <div></div>
                            <div></div>
                            <div></div>
                            <div className="text-sm font-medium text-center">R$ {(totalCents/100).toFixed(2)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showDuplicateModal && (
        <Modal
          isOpen={showDuplicateModal}
          onClose={()=>setShowDuplicateModal(false)}
          title="Adicionar insumo duplicado"
          size="sm"
        >
          <div className="space-y-3">
            <div className="text-sm text-gray-700">Este insumo já existe na ficha técnica. Deseja adicionar novamente?</div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={()=>setShowDuplicateModal(false)}>Cancelar</Button>
              <Button onClick={async ()=>{ setShowDuplicateModal(false); await addLine() }}>Adicionar</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
