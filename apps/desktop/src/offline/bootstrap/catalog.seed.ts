import * as productsService from "../services/productsService";

type Any = Record<string, any>;

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Seeds derivados da pasta referencia (simplificados para o esquema local)
const seedCategories = [
  { id: "cat_burritos", name: "Burritos", icon: "ri-cake-3-line" },
  { id: "cat_quesadilla", name: "Quesadilla", icon: "ri-cake-2-line" },
  { id: "cat_tacos", name: "Tacos", icon: "ri-restaurant-line" },
  { id: "cat_nachos", name: "Nachos", icon: "ri-bowl-line" },
  { id: "cat_extras", name: "Extras", icon: "ri-add-circle-line" },
  { id: "cat_bebidas", name: "Bebidas", icon: "ri-drop-line" },
  { id: "cat_drinks", name: "Drinks", icon: "ri-glass-line" },
  { id: "cat_chopes", name: "Chopes", icon: "ri-beer-line" },
];

const seedProducts = [
  // Burritos
  { name: "Classic Burrito", price: 38.0, categoryId: "cat_burritos", code: "1" },
  { name: "4 Quesos Burrito", price: 38.0, categoryId: "cat_burritos", code: "2" },
  { name: "Al Pastor Burrito", price: 38.0, categoryId: "cat_burritos", code: "3" },
  { name: "Barbacoa Burrito", price: 41.0, categoryId: "cat_burritos", code: "4" },
  // Quesadilla
  { name: "Chilli con Carne Quesadilla", price: 21.0, categoryId: "cat_quesadilla", code: "5" },
  { name: "Pollo Quesadilla", price: 21.0, categoryId: "cat_quesadilla", code: "6" },
  { name: "Al Pastor Quesadilla", price: 21.0, categoryId: "cat_quesadilla", code: "7" },
  { name: "Barbacoa Quesadilla", price: 21.0, categoryId: "cat_quesadilla", code: "8" },
  { name: "Ovomaltine Quesadilla", price: 18.0, categoryId: "cat_quesadilla", code: "9" },
  // Nachos
  { name: "Chilli con Carne Nachos", price: 38.0, categoryId: "cat_nachos", code: "10" },
  // Tacos
  { name: "Trio de Tacos Sortidos", price: 44.0, categoryId: "cat_tacos", code: "11" },
  // Extras
  { name: "Guacamole 50ml", price: 5.0, categoryId: "cat_extras", code: "12" },
  { name: "Sour Cream 50ml", price: 5.0, categoryId: "cat_extras", code: "13" },
  { name: "Guacamole 50ml + Sour Cream 50ml + Tortilla Chips 30g", price: 12.0, categoryId: "cat_extras", code: "14" },
  // Bebidas
  { name: "Água Mineral (Com ou Sem Gás)", price: 5.0, categoryId: "cat_bebidas", code: "15" },
  { name: "Refrigerante Lata (Coca-Cola, Coca-Cola Zero e Fanta Guaraná)", price: 8.0, categoryId: "cat_bebidas", code: "16" },
  { name: "Del Valle Lata (Uva ou Maracujá)", price: 8.0, categoryId: "cat_bebidas", code: "17" },
  { name: "Sucos Naturais (Morango, Maracujá ou Abacaxi com Hortelã)", price: 12.0, categoryId: "cat_bebidas", code: "18" },
  // Drinks
  { name: "Soda Italiana (Maçã Verde ou Blueberry) 500ml", price: 20.0, categoryId: "cat_drinks", code: "19" },
  { name: "Pink Lemonade 500ml", price: 20.0, categoryId: "cat_drinks", code: "20" },
  { name: "Pink Lemonade Alcoólico 500ml", price: 25.0, categoryId: "cat_drinks", code: "21" },
  { name: "Soda Italiana Alcoólica 500ml", price: 25.0, categoryId: "cat_drinks", code: "22" },
  // Chopes
  { name: "Chope Pilsen 500ml", price: 15.0, categoryId: "cat_chopes", code: "23" },
  { name: "Chope IPA 500ml", price: 20.0, categoryId: "cat_chopes", code: "24" },
  { name: "Dupla Chope Pilsen 500ml", price: 25.0, categoryId: "cat_chopes", code: "25" },
  { name: "Dupla Chope IPA 500ml", price: 35.0, categoryId: "cat_chopes", code: "26" },
];

export async function seedCatalogIfEmpty() {
  try {
    const hasIpc = typeof (window as any)?.api?.db?.query === 'function'
    const existingCats = hasIpc ? await productsService.listCategories() : [];
    const existingProds = hasIpc ? await productsService.listProducts() : [];
    const hasData = Array.isArray(existingCats) && existingCats.length > 0 && Array.isArray(existingProds) && existingProds.length > 0;
    const now = new Date().toISOString();

    if (hasIpc) {
      for (const c of seedCategories) {
        try { await productsService.upsertCategory({ id: c.id, name: c.name }); } catch {}
      }
      if (!hasData) {
        for (const p of seedProducts) {
          try {
            await productsService.upsertProduct({
              sku: p.code ?? null,
              name: p.name,
              categoryId: p.categoryId,
              priceCents: Math.max(0, Math.round((p.price ?? 0) * 100)),
              isActive: true,
            });
          } catch {}
        }
        console.log('[seed] catálogo inserido via IPC (categorias + produtos)');
      }
    }

    const cats = hasData ? existingCats : (hasIpc ? await productsService.listCategories() : seedCategories.map(c=>({ id:c.id, name:c.name })));
    const prods = hasData ? existingProds : (hasIpc ? await productsService.listProducts() : seedProducts.map(p=>({ id: `${p.code}`, name: p.name, priceCents: Math.round((p.price||0)*100), categoryId: p.categoryId, isActive: 1, sku: p.code })));

    try {
      const lsCategories = (cats || []).map((c: Any, idx: number) => ({
        id: String(c.id),
        name: String(c.name),
        icon: 'ri-folder-line',
        order: idx + 1,
        active: true,
      }));
      const lsMenuItems = (prods || []).map((p: Any) => ({
        id: String(p.id),
        name: String(p.name),
        price: Number(p.priceCents ?? p.price_cents ?? 0) / 100,
        sla: ["cat_extras", "cat_bebidas", "cat_drinks", "cat_chopes"].includes(String(p.categoryId ?? p.category_id)) ? 3 : 8,
        categoryId: String(p.categoryId ?? p.category_id ?? ''),
        observations: [],
        active: !!(p.isActive ?? p.is_active ?? 1),
        code: p.sku ?? null,
        image: '',
        skipKitchen: ["cat_bebidas", "cat_drinks", "cat_chopes"].includes(String(p.categoryId ?? p.category_id)),
        requiredModifierGroups: [],
        allowPartialDelivery: true,
        unitDeliveryCount: '',
      }));
      localStorage.setItem('categories', JSON.stringify(lsCategories));
      localStorage.setItem('menuItems', JSON.stringify(lsMenuItems));
      console.log('[seed] catálogo refletido no localStorage');
    } catch (e) {
      console.warn('[seed] falha ao hidratar localStorage', e);
    }
  } catch (e) {
    console.warn('[seed] falha no seed via IPC', e);
  }
}
