import { useEffect, useMemo, useState } from 'react'
import * as inventory from '@/offline/services/inventoryService'
import * as productsService from '@/offline/services/productsService'

export default function EstoqueGerenciamentoPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [recipesByProduct, setRecipesByProduct] = useState<Record<string, any[]>>({})
  const [ingredients, setIngredients] = useState<any[]>([])
  const [prices, setPrices] = useState<any[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('orders')
      const arr = raw ? JSON.parse(raw) : []
      setOrders(Array.isArray(arr) ? arr : [])
    } catch { setOrders([]) }
    ;(async () => {
      const ing = await inventory.listIngredients()
      setIngredients(ing)
      const pr = await inventory.listPrices()
      setPrices(pr)
      const prods = await productsService.listProducts()
      const map: Record<string, any[]> = {}
      for (const p of prods) {
        const lines = await inventory.listRecipeByProduct(String(p.id))
        map[String(p.id)] = lines
      }
      setRecipesByProduct(map)
    })()
  }, [])

  const deliveredOrders = useMemo(() => (orders || []).filter((o:any)=>o.status==='DELIVERED'), [orders])

  const outflow = useMemo(() => {
    const totals: Record<string, { qty: number; unit: string; valueCents: number }> = {}
    const priceIndex: Record<string, any[]> = {}
    for (const p of prices) {
      const key = String(p.ingredient_id)
      if (!priceIndex[key]) priceIndex[key] = []
      priceIndex[key].push(p)
    }
    for (const order of deliveredOrders) {
      for (const it of (order.items || [])) {
        const pid = String((it.menuItem?.id) || '')
        const lines = recipesByProduct[pid] || []
        for (const line of lines) {
          const ingId = String(line.ingredient_id)
          const qty = Number(line.quantity || 0) * Number(it.quantity || 1)
          const unit = String(line.unit)
          if (!totals[ingId]) totals[ingId] = { qty: 0, unit, valueCents: 0 }
          totals[ingId].qty += qty
        }
      }
    }
    for (const ingId of Object.keys(totals)) {
      const t = totals[ingId]
      const pricesFor = priceIndex[ingId] || []
      let unitPriceCents = 0
      for (const pr of pricesFor) {
        if (String(pr.unit).toLowerCase() === String(t.unit).toLowerCase()) { unitPriceCents = pr.price_per_unit_cents; break }
      }
      if (unitPriceCents === 0 && pricesFor.length > 0) {
        const pr0 = pricesFor[0]
        const convertedQty = inventory.convert(t.unit, pr0.unit, t.qty)
        t.valueCents = Math.round(convertedQty * Math.max(0, pr0.price_per_unit_cents || 0))
      } else {
        t.valueCents = Math.round(t.qty * Math.max(0, unitPriceCents || 0))
      }
    }
    return totals
  }, [deliveredOrders, recipesByProduct, prices])

  const totalValue = useMemo(() => Object.values(outflow).reduce((s,v)=> s + v.valueCents, 0), [outflow])

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Saída de Estoque por Vendas</h1>
      <div className="bg-white border rounded p-4">
        {Object.keys(outflow).length === 0 ? (
          <div className="text-sm text-gray-500">Sem dados</div>
        ) : (
          <div className="divide-y">
            {Object.entries(outflow).map(([ingId, data])=> (
              <div key={ingId} className="py-2 flex items-center justify-between">
                <div className="text-sm">{ingredients.find(i=>String(i.id)===String(ingId))?.name || ingId}</div>
                <div className="text-sm">{data.qty.toFixed(3)} {data.unit}</div>
                <div className="text-sm font-medium">R$ {(data.valueCents/100).toFixed(2)}</div>
              </div>
            ))}
            <div className="pt-3 mt-2 flex items-center justify-end border-t">
              <div className="text-sm font-bold">Total: R$ {(totalValue/100).toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}