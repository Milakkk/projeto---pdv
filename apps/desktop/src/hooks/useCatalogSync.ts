import { useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { useLocalStorage } from './useLocalStorage';
import type { Category, MenuItem } from '../types';
import { useOffline } from './useOffline';

export function useCatalogSync() {
  const { isOnline } = useOffline();
  const [, setCategories] = useLocalStorage<Category[]>('categories', []);
  const [, setMenuItems] = useLocalStorage<MenuItem[]>('menuItems', []);
  const lastSyncAtRef = useRef(0);

  useEffect(() => {
    if (!isOnline || !supabase) return;

    const now = Date.now();
    if (now - lastSyncAtRef.current < 60_000) return;
    lastSyncAtRef.current = now;

    const syncCatalog = async () => {
      try {
        if (import.meta.env.DEV) console.log('[CatalogSync] Iniciando sincronização do catálogo...');

        // 1. Fetch Categories
        const { data: categoriesData, error: catError } = await supabase
          .from('categories')
          .select('*');

        if (catError) throw catError;

        if (categoriesData) {
          let kitchenIdsByCategory: Record<string, string[]> = {};
          try {
            const { data: assoc, error: assocError } = await supabase
              .from('category_kitchens')
              .select('category_id, kitchen_id');
            if (!assocError && Array.isArray(assoc)) {
              for (const r of assoc as any[]) {
                const cid = r?.category_id ? String(r.category_id) : '';
                const kid = r?.kitchen_id ? String(r.kitchen_id) : '';
                if (!cid || !kid) continue;
                if (!kitchenIdsByCategory[cid]) kitchenIdsByCategory[cid] = [];
                kitchenIdsByCategory[cid].push(kid);
              }
            }
          } catch (e) {
            console.error('[CatalogSync] Erro ao carregar category_kitchens:', e);
          }

          const mappedCategories: Category[] = (categoriesData || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            icon: c.icon || 'ri-layout-grid-line',
            order: c.display_order || 0,
            active: c.is_active !== false,
            integrationCode: c.integration_code,
            kitchenIds: kitchenIdsByCategory[String(c.id)] || [],
          }));
          
          setCategories(() => {
            const byName = new Map<string, Category>();
            for (const c of mappedCategories) {
              const key = String(c.name || '').trim().toLowerCase();
              if (!key) continue;
              const prevC = byName.get(key);
              // Mantém o mais recente (se existir updated_at)
              if (!prevC) {
                byName.set(key, c);
              } else {
                const prevUpdated = (prevC as any).updated_at ? new Date((prevC as any).updated_at).getTime() : 0;
                const nextUpdated = (c as any).updated_at ? new Date((c as any).updated_at).getTime() : 0;
                byName.set(key, nextUpdated >= prevUpdated ? c : prevC);
              }
            }
            return Array.from(byName.values());
          });

          if (import.meta.env.DEV) console.log(`[CatalogSync] ${mappedCategories.length} categorias sincronizadas.`);
        }

        // 2. Fetch Products
        const { data: productsData, error: prodError } = await supabase
          .from('products')
          .select('*');

        if (prodError) throw prodError;

        if (productsData) {
          const mappedItems: MenuItem[] = (productsData || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            price: (p.price_cents || 0) / 100,
            sla: p.sla_minutes || 15,
            categoryId: p.category_id,
            observations: [],
            requiredModifierGroups: [],
            image: p.image_url,
            active: p.is_active !== false,
            code: p.sku,
            integrationCode: p.integration_code,
            skipKitchen: p.skip_kitchen || false,
            allowPartialDelivery: p.allow_partial_delivery || false,
            unitDeliveryCount: p.unit_delivery_count || 1
          }));

          setMenuItems(() => {
            const byKey = new Map<string, MenuItem>();
            for (const i of mappedItems) {
              const key = (i.code && String(i.code).trim().length > 0)
                ? `sku:${String(i.code).trim().toLowerCase()}`
                : `name:${String(i.name || '').trim().toLowerCase()}|cat:${String(i.categoryId || '')}`;
              const prevI = byKey.get(key);
              const nextUpdated = (i as any).updated_at ? new Date((i as any).updated_at).getTime() : 0;
              const prevUpdated = (prevI as any)?.updated_at ? new Date((prevI as any).updated_at).getTime() : 0;
              byKey.set(key, (!prevI || nextUpdated >= prevUpdated) ? i : prevI);
            }
            return Array.from(byKey.values());
          });
          if (import.meta.env.DEV) console.log(`[CatalogSync] ${mappedItems.length} produtos sincronizados.`);
        }

      } catch (error) {
        console.error('[CatalogSync] Erro ao sincronizar catálogo:', error);
      }
    };

    syncCatalog();
  }, [isOnline]); 
}
