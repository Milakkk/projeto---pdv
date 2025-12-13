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
          // Mapear campos do DB para o tipo Category (se necessário)
          // DB: id, name, unit_id, default_station, etc.
          // Type: id, name, icon, order, active...
          // Assumindo que o DB tem as colunas corretas ou mapeamento básico
          const mappedCategories: Category[] = categoriesData.map((c: any) => ({
            id: c.id,
            name: c.name,
            icon: c.icon || 'ri-layout-grid-line', // Default icon if missing
            order: c.display_order || 0,
            active: c.is_active !== false,
            integrationCode: c.integration_code,
            kitchenIds: [], // Será preenchido pelo CaixaPage ou outra lógica de kitchen
          }));
          
          // Preservar kitchenIds se já existirem localmente para evitar flicker
          setCategories(prev => {
            const kitchenMap = new Map(prev.map(p => [p.id, p.kitchenIds]));
            return mappedCategories.map(c => ({
              ...c,
              kitchenIds: kitchenMap.get(c.id) || []
            }));
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
            price: (p.price_cents || 0) / 100, // Convert cents to float
            sla: p.sla_minutes || 15, // Default SLA if missing
            categoryId: p.category_id,
            observations: [], // TODO: Carregar observações se existirem em outra tabela
            requiredModifierGroups: [], // TODO: Carregar modificadores
            image: p.image_url,
            active: p.is_active !== false,
            code: p.sku, // Mapear SKU para code
            integrationCode: p.integration_code,
            skipKitchen: p.skip_kitchen || false,
            allowPartialDelivery: p.allow_partial_delivery || false,
            unitDeliveryCount: p.unit_delivery_count || 1
          }));

          setMenuItems(mappedItems);
          console.log(`[CatalogSync] ${mappedItems.length} produtos sincronizados.`);
        }

      } catch (error) {
        console.error('[CatalogSync] Erro ao sincronizar catálogo:', error);
      }
    };

    syncCatalog();
    
    // Opcional: Polling a cada X minutos se necessário, mas realtime deve lidar com updates
  }, [isOnline]); // Rodar quando ficar online
}
