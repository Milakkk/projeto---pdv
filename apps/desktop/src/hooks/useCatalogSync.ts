import { useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useLocalStorage } from './useLocalStorage';
import { Category, MenuItem } from '../types';
import { useOffline } from './useOffline';

export function useCatalogSync() {
  const { isOnline } = useOffline();
  const [categories, setCategories] = useLocalStorage<Category[]>('categories', []);
  const [menuItems, setMenuItems] = useLocalStorage<MenuItem[]>('menuItems', []);

  useEffect(() => {
    if (!isOnline || !supabase) return;

    const syncCatalog = async () => {
      try {
        console.log('[CatalogSync] Iniciando sincronização do catálogo...');

        // 1. Fetch Categories
        const { data: categoriesData, error: catError } = await supabase
          .from('categories')
          .select('*')
          .eq('is_active', true);

        if (catError) throw catError;

        if (categoriesData) {
          const mappedCategories: Category[] = categoriesData.map((c: any) => ({
            id: c.id,
            name: c.name,
            icon: c.icon || 'ri-layout-grid-line',
            order: c.display_order || 0,
            active: c.is_active !== false,
            integrationCode: c.integration_code,
            kitchenIds: [],
          }));
          
          setCategories(prev => {
            const kitchenMap = new Map(prev.map(p => [p.id, p.kitchenIds]));
            const newCategories = mappedCategories.map(c => ({
              ...c,
              kitchenIds: kitchenMap.get(c.id) || []
            }));
            
            // Remove duplicates by ID
            const uniqueCategories = Array.from(new Map(newCategories.map(c => [c.id, c])).values());
            return uniqueCategories;
          });
          
          console.log(`[CatalogSync] ${mappedCategories.length} categorias sincronizadas.`);
        }

        // 2. Fetch Products
        const { data: productsData, error: prodError } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true);

        if (prodError) throw prodError;

        if (productsData) {
          const mappedItems: MenuItem[] = productsData.map((p: any) => ({
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

          setMenuItems(prev => {
             // Remove duplicates by ID
             const uniqueItems = Array.from(new Map(mappedItems.map(i => [i.id, i])).values());
             return uniqueItems;
          });
          console.log(`[CatalogSync] ${mappedItems.length} produtos sincronizados.`);
        }

      } catch (error) {
        console.error('[CatalogSync] Erro ao sincronizar catálogo:', error);
      }
    };

    syncCatalog();
  }, [isOnline]); 
}
