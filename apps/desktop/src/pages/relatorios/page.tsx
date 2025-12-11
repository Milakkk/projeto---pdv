import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/base/Input';
import type { Order, Category, MenuItem } from '../../types';
import Button from '../../components/base/Button';
import HourlySalesChart from '../../components/feature/HourlySalesChart';
import OperatorPerformanceChart from '../../components/feature/OperatorPerformanceChart';
import { mockCategories, mockMenuItems } from '../../mocks/data'; // Importando mocks para fallback
import OrderListTab from '../caixa/components/OrderListTab';
import * as ordersService from '../../offline/services/ordersService';
import * as productsService from '../../offline/services/productsService';

type ReportTab = 'sales' | 'orders' | 'performance' | 'items_categories' | 'analysis';

// Função auxiliar para obter a data de hoje no formato YYYY-MM-DD (local)
const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Função para criar um objeto Date no início do dia local
const createLocalStartOfDay = (dateString: string) => {
  if (!dateString) return null; // Adicionando verificação de segurança
  const parts = dateString.split('-');
  if (parts.length !== 3) return null; // Garantir formato YYYY-MM-DD
  const [year, month, day] = parts.map(Number);
  // Cria a data no fuso horário local
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

// Função para criar um objeto Date no final do dia local
const createLocalEndOfDay = (dateString: string) => {
  if (!dateString) return null; // Adicionando verificação de segurança
  const parts = dateString.split('-');
  if (parts.length !== 3) return null; // Garantir formato YYYY-MM-DD
  const [year, month, day] = parts.map(Number);
  // Cria a data no fuso horário local
  return new Date(year, month - 1, day, 23, 59, 59, 999);
};

// Função para calcular o tempo de entrega e status
const calculateDeliveryMetrics = (order: Order) => {
  const createdAt = new Date(order.createdAt).getTime();
  const isFinalStatus = order.status === 'DELIVERED' || order.status === 'CANCELLED';
  const now = Date.now();

  // 1. Tempo Final (Entrega ou Cancelamento)
  let finalTime = now;
  if (isFinalStatus && order.updatedAt) {
    finalTime = new Date(order.updatedAt).getTime();
  }

  // 2. Tempo de Início do Preparo (Fim da fase NEW)
  // Se o pedido está em status final, usamos o updatedAt fixo. Caso contrário, usamos o updatedAt se existir, ou createdAt.
  const preparingStartTime = (isFinalStatus && order.updatedAt) || order.status !== 'NEW'
    ? new Date(order.updatedAt || order.createdAt).getTime() 
    : createdAt;

  // 3. Tempo Final de Produção (Fim da fase PREPARING / Início da fase READY)
  let productionEndTime: number;
  
  if (order.readyAt) {
      productionEndTime = new Date(order.readyAt).getTime();
  } else if (order.status === 'READY' && order.updatedAt) {
      productionEndTime = new Date(order.updatedAt).getTime();
  } else if (isFinalStatus) {
      // Se está em status final (DELIVERED/CANCELLED) sem readyAt, usamos o tempo de início do preparo
      productionEndTime = preparingStartTime;
  } else {
      // Se está NEW ou PREPARING, o fim da produção é o tempo atual (para cálculo em tempo real)
      productionEndTime = now;
  }
  
  // --- CÁLCULOS ---
  
  // Se o status for final, usamos os valores fixos:
  if (isFinalStatus) {
    const totalKitchenTimeMs = productionEndTime - createdAt;
    const totalKitchenTimeMinutes = totalKitchenTimeMs / 60000;
    
    return {
      totalKitchenTimeMinutes: Math.max(0, totalKitchenTimeMinutes),
      newTimeMinutes: Math.max(0, (preparingStartTime - createdAt) / 60000),
      preparingTimeMinutes: Math.max(0, (productionEndTime - preparingStartTime) / 60000),
      readyTimeMinutes: Math.max(0, (finalTime - productionEndTime) / 60000),
      isOverdue: totalKitchenTimeMinutes > order.slaMinutes,
      displayTime: `${Math.round(totalKitchenTimeMinutes)} min`
    };
  }
  
  // Se o status for ativo, usamos o tempo atual (now) para calcular o tempo decorrido até agora
  
  // Tempo de Espera (NEW): Se ainda estiver em NEW, usa 'now' como fim da espera
  const currentPreparingStartTime = order.status === 'NEW' ? now : preparingStartTime;
  const newTimeMinutes = (currentPreparingStartTime - createdAt) / 60000;
  
  // Tempo de Preparo (PREPARING): Se ainda estiver em PREPARING, usa 'now' como fim do preparo
  const currentProductionEndTime = order.status === 'PREPARING' ? now : productionEndTime;
  const preparingTimeMinutes = (currentProductionEndTime - preparingStartTime) / 60000;
  
  // Tempo Cozinha (Total)
  const totalKitchenTimeMinutes = (currentProductionEndTime - createdAt) / 60000;
  
  // Tempo Entrega (READY): Se ainda estiver em READY, usa 'now' como tempo final
  const currentFinalTime = order.status === 'READY' ? now : finalTime;
  const readyTimeMinutes = (currentFinalTime - productionEndTime) / 60000;

  return {
    totalKitchenTimeMinutes: Math.max(0, totalKitchenTimeMinutes),
    newTimeMinutes: Math.max(0, newTimeMinutes),
    preparingTimeMinutes: Math.max(0, preparingTimeMinutes),
    readyTimeMinutes: Math.max(0, readyTimeMinutes),
    isOverdue: totalKitchenTimeMinutes > order.slaMinutes,
    displayTime: order.status === 'READY' ? `${Math.round(totalKitchenTimeMinutes)} min` : '-'
  };
};

// Função para consolidar pagamentos múltiplos (necessário para a tabela)
const consolidatePayments = (order: Order) => {
  const consolidated: { [method: string]: number } = {};
  
  if (order.paymentMethod === 'MÚLTIPLO' && order.paymentBreakdown) {
    Object.entries(order.paymentBreakdown).forEach(([method, amount]) => {
      const baseMethod = method.replace(/\s\(\d+\)$/, ''); 
      consolidated[baseMethod] = (consolidated[baseMethod] || 0) + amount;
    });
  } else {
    consolidated[order.paymentMethod || 'Não informado'] = order.total;
  }
  
  return Object.entries(consolidated).map(([method, amount]) => ({ method, amount }));
};


export default function RelatoriosPage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const ss = sessionStorage.getItem('reportsAuthOk') === '1'
      const ls = localStorage.getItem('reportsAuthOk') === '1'
      return ss || ls
    } catch { return false }
  });
  const [authPass, setAuthPass] = useState('');
  const [authError, setAuthError] = useState('');
  const AUTH_PASS = '156389';
  const tryAuth = () => {
    if (authPass === AUTH_PASS) {
      setIsAuthenticated(true);
      setAuthError('');
      try { sessionStorage.setItem('reportsAuthOk', '1') } catch {}
      try { localStorage.setItem('reportsAuthOk', '1') } catch {}
    } else {
      setAuthError('Senha inválida');
    }
  };
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(mockMenuItems);
  const [dateFrom, setDateFrom] = useState(getTodayDateString());
  const [dateTo, setDateTo] = useState(getTodayDateString());
  const [searchPin, setSearchPin] = useState(''); // Novo estado para busca por PIN
  const [itemsFilter, setItemsFilter] = useState(''); // Filtro da tabela de Itens vendidos
  const [itemsSortBy, setItemsSortBy] = useState<'name' | 'category' | 'quantity' | 'revenue'>('quantity');
  const [itemsSortDir, setItemsSortDir] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopped = false;
    const timeout = setTimeout(() => {
      if (!stopped) setLoading(false);
    }, 10000); // Timeout de segurança de 10s

    (async () => {
      try {
        const cats = await productsService.listCategories();
        const prods = await productsService.listProducts();
        const categoriesOut: Category[] = (cats || []).map((c: any) => ({
          id: String(c.id),
          name: String(c.name || ''),
          icon: '',
          order: 0,
          active: Boolean(c.isActive ?? true),
        }));
        const menuItemsOut: MenuItem[] = (prods || []).map((p: any) => ({
          id: String(p.id),
          name: String(p.name || ''),
          price: Math.max(0, Number(p.priceCents ?? 0) / 100),
          sla: 0,
          categoryId: p.categoryId ? String(p.categoryId) : '',
          observations: [],
          active: Boolean(p.isActive ?? true),
        }));
        const productMap: Record<string, MenuItem> = {};
        menuItemsOut.forEach(mi => { productMap[mi.id] = mi; });
        if (!stopped) {
          if (categoriesOut.length) setCategories(categoriesOut);
          if (menuItemsOut.length) setMenuItems(menuItemsOut);
        }
        const detailed = await ordersService.listOrdersDetailed();
        const out: Order[] = [];
        for (const d of detailed) {
          const r = d.order as any;
          const items = d.items || [];
          const payments = d.payments || [];
          const pinVal = d.details?.pin;
          const passVal = d.details?.password;
          const orderItems = (items || []).map((it: any) => {
            const pid = it.product_id ?? it.productId;
            const mi = pid ? productMap[String(pid)] : undefined;
            const menuItem: MenuItem = mi || {
              id: String(pid || String(it.id)),
              name: String(it.product_name ?? mi?.name ?? 'Item'),
              price: Math.max(0, Number(it.unit_price_cents ?? it.unitPriceCents ?? 0) / 100),
              sla: 0,
              categoryId: String(it.category_id ?? mi?.categoryId ?? ''),
              observations: [],
              active: true,
            };
            return {
              id: String(it.id),
              menuItem,
              quantity: Number(it.qty ?? it.quantity ?? 1),
              unitPrice: Math.max(0, Number(it.unit_price_cents ?? it.unitPriceCents ?? menuItem.price) / 100),
              productionUnits: [],
            } as any;
          });
          const paid = (payments || []).reduce((s: number, p: any) => s + Math.max(0, Number(p.amount_cents ?? p.amountCents ?? 0) / 100), 0);
          const breakdown = (payments || []).length > 1 ? Object.fromEntries((payments || []).map((p: any) => [String(p.method).toUpperCase(), Math.max(0, Number(p.amount_cents ?? p.amountCents ?? 0) / 100)])) : undefined;
          const method = (payments || []).length > 1 ? 'MÚLTIPLO' : ((payments || [])[0]?.method ? String((payments || [])[0].method).toUpperCase() : '');
          const ord: Order = {
            id: String(r.id),
            pin: pinVal || String(r.id),
            password: passVal || '',
            items: orderItems,
            total: paid > 0 ? paid : Math.max(0, Number(r.total_cents ?? 0) / 100),
            paymentMethod: breakdown ? 'MÚLTIPLO' : (method || 'Não informado'),
            paymentBreakdown: breakdown,
            status:
              r.closed_at
                ? 'DELIVERED'
                : String(r.status).toLowerCase() === 'closed' || String(r.status).toUpperCase() === 'DELIVERED'
                ? 'DELIVERED'
                : String(r.status).toLowerCase() === 'cancelled' || String(r.status).toUpperCase() === 'CANCELLED'
                ? 'CANCELLED'
                : 'NEW',
            createdAt: r.opened_at ? new Date(r.opened_at) : new Date(),
            updatedAt: r.updated_at ? new Date(r.updated_at) : undefined,
            readyAt: r.ready_at ? new Date(r.ready_at) : undefined,
            deliveredAt: r.closed_at ? new Date(r.closed_at) : undefined,
            slaMinutes: 0,
            createdBy: '',
          } as any;
          out.push(ord);
        }
        if (!stopped) setOrders(out);
      } catch (e) {
        console.error('Erro ao carregar relatórios:', e);
      } finally {
        if (!stopped) setLoading(false);
        clearTimeout(timeout);
      }
    })();
    return () => { stopped = true; clearTimeout(timeout); };
  }, []);

  // Atualização periódica dos pedidos via SQLite para refletir mudanças entre janelas
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const detailed = await ordersService.listOrdersDetailed();
        if (!mounted) return;
        const out: Order[] = [];
        for (const d of detailed) {
          const r = d.order as any;
          const items = d.items || [];
          const payments = d.payments || [];
          const pinVal = d.details?.pin;
          const passVal = d.details?.password;
          const paid = (payments || []).reduce((s: number, p: any) => s + Math.max(0, Number(p.amount_cents ?? p.amountCents ?? 0) / 100), 0);
          const breakdown = (payments || []).length > 1 ? Object.fromEntries((payments || []).map((p: any) => [String(p.method).toUpperCase(), Math.max(0, Number(p.amount_cents ?? p.amountCents ?? 0) / 100)])) : undefined;
          const method = (payments || []).length > 1 ? 'MÚLTIPLO' : ((payments || [])[0]?.method ? String((payments || [])[0].method).toUpperCase() : '');
          const ord: Order = {
            id: String(r.id),
            pin: pinVal || String(r.id),
            password: passVal || '',
            items: (items || []).map((it: any) => ({
              id: String(it.id),
              menuItem: {
                id: String(it.product_id ?? it.productId ?? String(it.id)),
                name: String(it.product_name ?? 'Item'),
                price: Math.max(0, Number(it.unit_price_cents ?? it.unitPriceCents ?? 0) / 100),
                sla: 0,
                categoryId: String(it.category_id ?? ''),
                observations: [],
                active: true,
              } as any,
              quantity: Number(it.qty ?? it.quantity ?? 1),
              unitPrice: Math.max(0, Number(it.unit_price_cents ?? it.unitPriceCents ?? 0) / 100),
              productionUnits: [],
            })) as any,
            total: paid > 0 ? paid : Math.max(0, Number(r.total_cents ?? 0) / 100),
            paymentMethod: breakdown ? 'MÚLTIPLO' : (method || 'Não informado'),
            paymentBreakdown: breakdown,
            status:
              r.closed_at
                ? 'DELIVERED'
                : String(r.status).toLowerCase() === 'closed' || String(r.status).toUpperCase() === 'DELIVERED'
                ? 'DELIVERED'
                : String(r.status).toLowerCase() === 'cancelled' || String(r.status).toUpperCase() === 'CANCELLED'
                ? 'CANCELLED'
                : 'NEW',
            createdAt: r.opened_at ? new Date(r.opened_at) : new Date(),
            updatedAt: r.updated_at ? new Date(r.updated_at) : undefined,
            readyAt: r.ready_at ? new Date(r.ready_at) : undefined,
            deliveredAt: r.closed_at ? new Date(r.closed_at) : undefined,
            slaMinutes: 0,
            createdBy: '',
          } as any;
          out.push(ord);
        }
        setOrders(out);
      } catch {}
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900">Acesso aos Relatórios</h3>
            <p className="text-xs text-gray-500">Digite a senha para acessar</p>
          </div>
          <div className="space-y-3">
            <Input value={authPass} onChange={e=>setAuthPass((e.target as HTMLInputElement).value)} onKeyDown={e=>{ if ((e as any).key === 'Enter') tryAuth() }} placeholder="Senha" type="password" />
            {authError ? <div className="text-red-600 text-sm">{authError}</div> : null}
            <Button onClick={tryAuth}>Entrar</Button>
          </div>
        </div>
      </div>
    );
  }

  // Mapeamento de itens para facilitar a busca por categoria
  const itemMap = useMemo(() => {
    return menuItems.reduce((map, item) => {
      map[item.id] = item;
      return map;
    }, {} as Record<string, MenuItem>);
  }, [menuItems]);

  const categoryNameMap = useMemo(() => {
    return categories.reduce((map, cat) => {
      map[cat.id] = cat.name;
      return map;
    }, {} as Record<string, string>);
  }, [categories]);

  // Filtro de pedidos por data e PIN
  const filteredOrders = useMemo(() => {
    if (!dateFrom || !dateTo) return [];
    
    // 1. Filtrar por data
    const from = createLocalStartOfDay(dateFrom);
    const to = createLocalEndOfDay(dateTo);

    if (!from || !to) return [];

    let result = orders.filter((order: Order) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= from && orderDate <= to;
    });
    
    // 2. Filtrar por PIN (se houver termo de busca)
    if (searchPin.trim()) {
      const lowerCaseSearch = searchPin.trim().toLowerCase();
      result = result.filter(order => 
        order.pin.toLowerCase().includes(lowerCaseSearch)
      );
    }

    return result;
  }, [dateFrom, dateTo, orders, searchPin]);

  // Dados de vendas
  const salesData = useMemo(() => {
    const deliveredOrders = filteredOrders.filter(o => o.status === 'DELIVERED');
    const totalOrders = deliveredOrders.length;
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.total, 0);
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    const canceledOrders = filteredOrders.filter(o => o.status === 'CANCELLED').length;
    const totalOrdersInPeriod = filteredOrders.length;
    const cancelRate = totalOrdersInPeriod > 0 ? (canceledOrders / totalOrdersInPeriod) * 100 : 0;

    // Vendas por hora
    const hourlyMap: { [hour: string]: { orders: number; revenue: number; totalRevenue: number; items: { name: string; quantity: number; categoryName: string }[] } } = {};
    deliveredOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      // Usar getHours() que retorna a hora local
      const hour = orderDate.getHours(); 
      const hourKey = `${hour.toString().padStart(2, '0')}:00`;
      
      if (!hourlyMap[hourKey]) {
        hourlyMap[hourKey] = { orders: 0, revenue: 0, totalRevenue: 0, items: [] };
      }
      
      hourlyMap[hourKey].orders += 1;
      hourlyMap[hourKey].revenue += order.total;
      hourlyMap[hourKey].totalRevenue += order.total;

      order.items.forEach(item => {
        const itemName = item.menuItem.name;
        const categoryId = item.menuItem.categoryId;
        const categoryName = categoryNameMap[categoryId] || 'Sem Categoria';

        const existingItem = hourlyMap[hourKey].items.find(i => i.name === itemName);
        if (existingItem) {
          existingItem.quantity += item.quantity;
        } else {
          hourlyMap[hourKey].items.push({ name: itemName, quantity: item.quantity, categoryName });
        }
      });
    });

    // Converter o mapa para um array ordenado por hora
    const hourlyData = Object.entries(hourlyMap)
      .map(([hour, data]) => ({ 
        hour, 
        orders: data.orders,
        revenue: data.revenue,
        averageTicket: data.orders > 0 ? data.totalRevenue / data.orders : 0, // Calculate average ticket
        items: data.items.sort((a, b) => b.quantity - a.quantity)
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));


    // Itens mais vendidos (apenas para referência interna, não mais exibido)
    const itemSales: { [itemName: string]: { quantity: number; revenue: number; categoryId: string } } = {};
    deliveredOrders.forEach(order => {
      order.items.forEach(item => {
        const itemName = item.menuItem.name;
        const categoryId = item.menuItem.categoryId;
        if (!itemSales[itemName]) {
          itemSales[itemName] = { quantity: 0, revenue: 0, categoryId };
        }
        itemSales[itemName].quantity += item.quantity;
        itemSales[itemName].revenue += item.unitPrice * item.quantity;
      });
    });

    const topSellingItems = Object.entries(itemSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const topRevenueItems = Object.entries(itemSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Formas de pagamento
    const paymentData: { [method: string]: { orders: number; revenue: number } } = {};
    deliveredOrders.forEach(order => {
      if (order.paymentMethod === 'MÚLTIPLO' && order.paymentBreakdown) {
        const breakdown = order.paymentBreakdown;
        
        Object.entries(breakdown).forEach(([method, amount]) => {
          const baseMethod = method.replace(/\s\(\d+\)$/, ''); 
          
          if (!paymentData[baseMethod]) {
            paymentData[baseMethod] = { orders: 0, revenue: 0 };
          }
          
          paymentData[baseMethod].orders += 1; 
          paymentData[baseMethod].revenue += amount; 
        });
        
      } else {
        const paymentMethod = order.paymentMethod || 'Não informado';
        if (!paymentData[paymentMethod]) {
          paymentData[paymentMethod] = { orders: 0, revenue: 0 };
        }
        paymentData[paymentMethod].orders += 1;
        paymentData[paymentMethod].revenue += order.total;
      }
    });

    return {
      totalOrders,
      totalRevenue,
      averageTicket,
      canceledOrders,
      cancelRate,
      hourlyData,
      topSellingItems, // Mantido para cálculo, mas não renderizado
      topRevenueItems, // Mantido para cálculo, mas não renderizado
      paymentData
    };
  }, [filteredOrders, categoryNameMap]);

  // Dados de Itens e Categorias
  const itemCategoryData = useMemo(() => {
    const deliveredOrders = filteredOrders.filter(o => o.status === 'DELIVERED');
    
    const categorySales: { [categoryId: string]: { revenue: number; quantity: number; totalProductionTime: number; items: { [itemId: string]: { name: string; categoryId: string; quantity: number; revenue: number; productionTime: number; revenuePerMinute: number } } } } = {};
    const itemDetails: { [itemId: string]: { name: string; categoryId: string; quantity: number; revenue: number } } = {};

    deliveredOrders.forEach(order => {
      order.items.forEach(item => {
        const categoryId = item.menuItem.categoryId;
        const itemId = item.menuItem.id;
        const itemRevenue = item.unitPrice * item.quantity;
        const itemSla = item.menuItem.sla;
        
        // Tempo de produção total (SLA * Quantidade)
        const itemProductionTime = itemSla * item.quantity;

        // Vendas por Categoria
        if (!categorySales[categoryId]) {
          categorySales[categoryId] = { revenue: 0, quantity: 0, totalProductionTime: 0, items: {} };
        }
        categorySales[categoryId].revenue += itemRevenue;
        categorySales[categoryId].quantity += item.quantity;
        categorySales[categoryId].totalProductionTime += itemProductionTime;

        // Detalhes por Item
        if (!itemDetails[itemId]) {
          itemDetails[itemId] = { 
            name: item.menuItem.name, 
            categoryId, 
            quantity: 0, 
            revenue: 0 
          };
        }
        itemDetails[itemId].quantity += item.quantity;
        itemDetails[itemId].revenue += itemRevenue;
        
        // Detalhes por Item dentro da Categoria (para Análise)
        if (!categorySales[categoryId].items[itemId]) {
          categorySales[categoryId].items[itemId] = {
            name: item.menuItem.name,
            categoryId,
            quantity: 0,
            revenue: 0,
            productionTime: 0,
            revenuePerMinute: 0
          };
        }
        
        const itemData = categorySales[categoryId].items[itemId];
        itemData.quantity += item.quantity;
        itemData.revenue += itemRevenue;
        itemData.productionTime += itemProductionTime;
        // Recalcular R$/min para o item (baseado no total acumulado)
        itemData.revenuePerMinute = itemData.productionTime > 0 ? itemData.revenue / itemData.productionTime : 0;
      });
    });

    const revenueByCategory = Object.entries(categorySales)
      .map(([categoryId, data]) => {
        const revenuePerMinute = data.totalProductionTime > 0 ? data.revenue / data.totalProductionTime : 0;
        
        // Ordenar itens por quantidade vendida
        const sortedItems = Object.values(data.items).sort((a, b) => b.quantity - a.quantity);

        return {
          categoryId,
          categoryName: categoryNameMap[categoryId] || 'Sem Categoria',
          ...data,
          revenuePerMinute, // R$/min
          items: sortedItems
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const itemsSoldDetails = Object.entries(itemDetails)
      .map(([itemId, d]) => ({ itemId, ...d }))
      .sort((a, b) => b.quantity - a.quantity);

    return {
      revenueByCategory,
      itemsSoldDetails,
    };
  }, [filteredOrders, categoryNameMap]);

  // Lista filtrada de Itens Vendidos (por qualquer coluna)
  const filteredItemsSoldDetails = useMemo(() => {
    const term = itemsFilter.trim().toLowerCase();
    if (!term) return itemCategoryData.itemsSoldDetails;
    return itemCategoryData.itemsSoldDetails.filter((it) => {
      const catName = (categoryNameMap[it.categoryId] || 'Sem Categoria').toLowerCase();
      const qtyStr = String(it.quantity);
      const revenueStr = it.revenue.toFixed(2);
      return (
        it.name.toLowerCase().includes(term) ||
        catName.includes(term) ||
        qtyStr.includes(term) ||
        revenueStr.includes(term)
      );
    });
  }, [itemsFilter, itemCategoryData.itemsSoldDetails, categoryNameMap]);

  // Ordenação de Itens Vendidos
  const sortedItemsSoldDetails = useMemo(() => {
    const arr = [...filteredItemsSoldDetails];
    const dir = itemsSortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      if (itemsSortBy === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (itemsSortBy === 'category') {
        const an = categoryNameMap[a.categoryId] || 'Sem Categoria';
        const bn = categoryNameMap[b.categoryId] || 'Sem Categoria';
        cmp = an.localeCompare(bn);
      } else if (itemsSortBy === 'quantity') {
        cmp = a.quantity - b.quantity;
      } else if (itemsSortBy === 'revenue') {
        cmp = a.revenue - b.revenue;
      }
      return cmp * dir;
    });
    return arr;
  }, [filteredItemsSoldDetails, itemsSortBy, itemsSortDir, categoryNameMap]);


  // Dados de performance
  const performanceData = useMemo(() => {
    const deliveredOrders = filteredOrders.filter(o => o.status === 'DELIVERED');
    const totalSlaTime = deliveredOrders.reduce((sum, order) => sum + order.slaMinutes, 0);
    const averageSla = deliveredOrders.length > 0 ? totalSlaTime / deliveredOrders.length : 0;

    let overdueOrders = 0;
    let totalKitchenTime = 0;
    let totalNewTime = 0;
    let totalPreparingTime = 0;
    let totalReadyTime = 0;
    let totalProcessed = 0;
    
    // Performance por Operador (Cozinha)
    const kitchenPerformance: { [operatorName: string]: { totalTime: number; count: number } } = {};

    deliveredOrders.forEach(order => {
      const metrics = calculateDeliveryMetrics(order);
      
      if (metrics.totalKitchenTimeMinutes > 0) {
        totalKitchenTime += metrics.totalKitchenTimeMinutes;
        totalNewTime += metrics.newTimeMinutes;
        totalPreparingTime += metrics.preparingTimeMinutes;
        totalReadyTime += metrics.readyTimeMinutes;
        totalProcessed++;
        
        // Comparação com SLA usando Tempo Cozinha
        if (metrics.isOverdue) {
          overdueOrders++;
        }
      }
      
      // CÁLCULO DO TEMPO MÉDIO POR OPERADOR (Baseado no tempo total de preparo do pedido)
      const preparingStartTimeMs = new Date(order.updatedAt || order.createdAt).getTime(); // Tempo que saiu de NEW
      
      // Encontrar todos os operadores que trabalharam neste pedido
      const operatorsInOrder = new Set<string>();
      order.items.forEach(item => {
        (item.productionUnits || []).forEach(unit => {
          if (unit.operatorName) {
            operatorsInOrder.add(unit.operatorName);
          }
        });
      });
      
      // Se o pedido foi concluído (readyAt existe), dividimos o tempo de preparo total do pedido
      // pelo número de operadores envolvidos para ter uma métrica de "carga de trabalho"
      if (order.readyAt && operatorsInOrder.size > 0) {
        const timeTakenMinutes = metrics.preparingTimeMinutes;
        const timePerOperator = timeTakenMinutes / operatorsInOrder.size;
        
        operatorsInOrder.forEach(operatorName => {
          if (!kitchenPerformance[operatorName]) {
            kitchenPerformance[operatorName] = { totalTime: 0, count: 0 };
          }
          kitchenPerformance[operatorName].totalTime += timePerOperator;
          kitchenPerformance[operatorName].count += 1;
        });
      }
    });

    const averageKitchenTime = totalProcessed > 0 ? totalKitchenTime / totalProcessed : 0;
    const averageNewTime = totalProcessed > 0 ? totalNewTime / totalProcessed : 0;
    const averagePreparingTime = totalProcessed > 0 ? totalPreparingTime / totalProcessed : 0;
    const averageReadyTime = totalProcessed > 0 ? totalReadyTime / totalProcessed : 0;
    
    const onTimeRate = totalProcessed > 0 ? ((totalProcessed - overdueOrders) / totalProcessed) * 100 : 0;
    
    // Performance por Operador (Cozinha)
    const kitchenPerformanceData = Object.entries(kitchenPerformance)
      .map(([name, data]) => ({
        name,
        averageTime: data.count > 0 ? data.totalTime / data.count : 0,
        ordersCount: data.count
      }))
      .filter(data => data.ordersCount > 0)
      .sort((a, b) => a.averageTime - b.averageTime); // Mais rápido primeiro
      
    // Removendo itemMetrics e categoryMetrics

    return {
      averageSla,
      averageDeliveryTime: averageKitchenTime, // Agora é o tempo médio de cozinha
      overdueOrders,
      onTimeRate,
      totalProcessed,
      averageTimeInNew: averageNewTime, 
      averagePreparingTime, // NOVO
      averageReadyTime, // NOVO
      kitchenPerformanceData,
      // Removendo itemMetrics e categoryMetrics
    };
  }, [filteredOrders, categoryNameMap]);

  // Dados de Análise (Correlations)
  const analysisData = useMemo(() => {
    // 3. Vendas por Categoria vs. Tempo de Produção (R$/min)
    const categoryCorrelation = itemCategoryData.revenueByCategory.map(cat => {
      return {
        categoryName: cat.categoryName,
        revenue: cat.revenue,
        totalProductionTime: cat.totalProductionTime,
        revenuePerMinute: cat.revenuePerMinute,
        quantity: cat.quantity,
        items: cat.items // Incluindo itens
      };
    }).sort((a, b) => b.revenuePerMinute - a.revenuePerMinute); // Ordenar por R$/min

    return {
      categoryCorrelation
    };
  }, [itemCategoryData.revenueByCategory]);
  
  // Função dummy para satisfazer o contrato de OrderListTab
  const handleMarkAsDeliveredDummy = () => {
    alert('A entrega de pedidos só pode ser feita no módulo Caixa (PDV).');
  };

  // Exportar CSV
  const exportCSV = () => {
    try {
      const csvData = [
        ['Pedido', 'Data', 'Itens', 'Total', 'Pagamento', 'Status', 'Tempo SLA', 'Cliente WhatsApp'].join(','),
        ...filteredOrders.map(order => [
          `#${order.pin}`,
          new Date(order.createdAt).toLocaleString('pt-BR'),
          order.items.map(item => `${item.quantity}x ${item.menuItem.name}`).join('; '),
          `R$ ${order.total.toFixed(2)}`,
          order.paymentMethod || 'Não informado',
          order.status,
          `${order.slaMinutes} min`,
          order.customerWhatsApp || 'N/A'
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `relatorio-${dateFrom}-${dateTo}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Falha ao exportar CSV:', err);
      alert('Erro ao exportar relatório. Tente novamente.');
    }
  };

  const tabs = [
    { id: 'sales', name: 'Vendas', icon: 'ri-money-dollar-circle-line' },
    { id: 'items_categories', name: 'Itens & Categorias', icon: 'ri-restaurant-line' },
    { id: 'analysis', name: 'Análise', icon: 'ri-line-chart-line' },
    { id: 'orders', name: 'Pedidos', icon: 'ri-list-check-line' },
    { id: 'performance', name: 'Performance', icon: 'ri-speed-up-line' }
  ];

  return (
    <div className="flex flex-col h-full flex-1 min-h-0 bg-gray-50">
      
      {/* HEADER FIXO */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="secondary" onClick={() => navigate('/dashboard')}>
                <i className="ri-arrow-left-line mr-2"></i>
                Voltar aos Módulos
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {filteredOrders.length} pedidos no período selecionado
                </p>
              </div>
            </div>
            <Button onClick={exportCSV} variant="secondary" className="whitespace-nowrap">
              <i className="ri-download-line mr-2"></i>
              Exportar CSV
            </Button>
          </div>
        </div>
        
        <div className="px-6">
          <div className="flex items-center space-x-4 mb-4">
            <Input
              label="De:"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
            />
            <Input
              label="Até:"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
            />
          </div>

          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ReportTab)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <i className={`${tab.icon} mr-2`}></i>
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTEÚDO ROLÁVEL */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center">
              <i className="ri-loader-4-line text-4xl text-amber-500 animate-spin mb-4"></i>
              <p className="text-gray-500">Carregando dados...</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'sales' && (
              <div className="space-y-6">
            {/* Cards de métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <i className="ri-shopping-cart-line text-xl text-green-600"></i>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Pedidos Entregues</p>
                    <p className="text-2xl font-bold text-gray-900">{salesData.totalOrders}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <i className="ri-money-dollar-circle-line text-xl text-amber-600"></i>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Faturamento</p>
                    <p className="text-2xl font-bold text-gray-900">R$ {salesData.totalRevenue.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <i className="ri-receipt-line text-xl text-blue-600"></i>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Ticket Médio</p>
                    <p className="text-2xl font-bold text-gray-900">R$ {salesData.averageTicket.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <i className="ri-close-circle-line text-xl text-red-600"></i>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Taxa Cancelamento</p>
                    <p className="text-2xl font-bold text-gray-900">{salesData.cancelRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendas por Hora</h3>
                <HourlySalesChart data={salesData.hourlyData} />
              </div>

              {/* Formas de pagamento - Layout Horizontal */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Formas de Pagamento</h3>
                {Object.keys(salesData.paymentData).length > 0 ? (
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(salesData.paymentData).map(([method, data]) => (
                      <div key={method} className="p-4 bg-gray-50 rounded-lg border border-gray-200 w-full sm:w-56">
                        <h4 className="font-medium text-gray-900 mb-2 truncate">{method}</h4>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Vendas:</span>
                            <span className="font-medium">{data.orders}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Valor:</span>
                            <span className="font-medium text-amber-600">R$ {data.revenue.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <i className="ri-bank-card-line text-3xl mb-2"></i>
                    <p>Nenhum pagamento registrado no período</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'items_categories' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Análise de Cardápio</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Faturamento por Categoria */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Faturamento por Categoria</h3>
                <div className="space-y-3">
                  {itemCategoryData.revenueByCategory.map((data, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-gray-800">{data.categoryName}</span>
                        <span className="font-bold text-amber-600">R$ {data.revenue.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-amber-500 h-2 rounded-full" 
                          style={{ width: `${(data.revenue / salesData.totalRevenue) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {data.quantity} unidades vendidas
                      </p>
                    </div>
                  ))}
                  {itemCategoryData.revenueByCategory.length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      <i className="ri-folder-line text-2xl mb-2"></i>
                      <p className="text-sm">Nenhuma venda por categoria</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Itens Vendidos por Hora */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Itens Vendidos por Hora</h3>
                <div className="max-h-96 overflow-y-auto space-y-4">
                  {salesData.hourlyData.length > 0 ? (
                    salesData.hourlyData.map(hourData => (
                      <div key={hourData.hour} className="border-b pb-3 last:border-b-0">
                        <h4 className="font-bold text-blue-700 mb-2">{hourData.hour} ({hourData.orders} pedidos)</h4>
                        <div className="space-y-1">
                          {hourData.items.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm text-gray-700">
                              <span>
                                <span className="font-medium text-gray-500 mr-1">[{item.categoryName}]</span>
                                {item.name}
                              </span>
                              <span className="font-medium text-gray-900">{item.quantity} un.</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <i className="ri-time-line text-2xl mb-2"></i>
                      <p className="text-sm">Nenhum item vendido por hora</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Top 5 Itens por Faturamento (Mantido aqui para referência, mas agora também na aba Sales) */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Itens (Faturamento)</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {salesData.topRevenueItems.map((item, index) => (
                    <div key={item.name} className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center">
                      <span className="text-xl font-bold text-amber-600 block mb-1">#{index + 1}</span>
                      <h4 className="font-medium text-gray-900 text-sm truncate mb-1" title={item.name}>{item.name}</h4>
                      <p className="text-xs text-gray-600 mb-2">({categoryNameMap[item.categoryId] || 'Sem Categoria'})</p>
                      <span className="text-lg font-bold text-amber-700 block">R$ {item.revenue.toFixed(2)}</span>
                      <span className="text-xs text-gray-500">{item.quantity} un.</span>
                    </div>
                  ))}
                  {salesData.topRevenueItems.length === 0 && (
                    <div className="md:col-span-5 text-center py-4 text-gray-500">
                      <i className="ri-money-dollar-circle-line text-2xl mb-2"></i>
                      <p className="text-sm">Nenhum item gerou receita no período</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Itens Vendidos (Lista Completa) */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Itens vendidos</h3>
                {itemCategoryData.itemsSoldDetails && itemCategoryData.itemsSoldDetails.length > 0 ? (
                  <div className="overflow-x-auto">
                    {/* Filtro por qualquer título/coluna */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-full md:w-1/3">
                        <Input
                          placeholder="Filtrar por item, categoria, quantidade ou receita"
                          value={itemsFilter}
                          onChange={(e) => setItemsFilter(e.target.value)}
                        />
                      </div>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th
                            className="px-4 py-3 text-left font-medium text-gray-700 cursor-pointer select-none"
                            onClick={() => setItemsSortBy(prev => (prev === 'name' ? 'name' : 'name')) || setItemsSortDir(d => (itemsSortBy === 'name' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'))}
                          >
                            Item {itemsSortBy === 'name' && (itemsSortDir === 'asc' ? '▲' : '▼')}
                          </th>
                          <th
                            className="px-4 py-3 text-left font-medium text-gray-700 cursor-pointer select-none"
                            onClick={() => setItemsSortBy(prev => (prev === 'category' ? 'category' : 'category')) || setItemsSortDir(d => (itemsSortBy === 'category' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'))}
                          >
                            Categoria {itemsSortBy === 'category' && (itemsSortDir === 'asc' ? '▲' : '▼')}
                          </th>
                          <th
                            className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer select-none"
                            onClick={() => setItemsSortBy(prev => (prev === 'quantity' ? 'quantity' : 'quantity')) || setItemsSortDir(d => (itemsSortBy === 'quantity' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'))}
                          >
                            Quantidade {itemsSortBy === 'quantity' && (itemsSortDir === 'asc' ? '▲' : '▼')}
                          </th>
                          <th
                            className="px-4 py-3 text-right font-medium text-gray-700 cursor-pointer select-none"
                            onClick={() => setItemsSortBy(prev => (prev === 'revenue' ? 'revenue' : 'revenue')) || setItemsSortDir(d => (itemsSortBy === 'revenue' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'))}
                          >
                            Receita {itemsSortBy === 'revenue' && (itemsSortDir === 'asc' ? '▲' : '▼')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {sortedItemsSoldDetails.map((it) => (
                          <tr key={it.itemId} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-900">{it.name}</td>
                            <td className="px-4 py-2 text-gray-600">{categoryNameMap[it.categoryId] || 'Sem Categoria'}</td>
                            <td className="px-4 py-2 text-right font-medium text-gray-900">{it.quantity}</td>
                            <td className="px-4 py-2 text-right font-bold text-amber-700">R$ {it.revenue.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <i className="ri-restaurant-line text-2xl mb-2"></i>
                    <p className="text-sm">Nenhum item vendido no período selecionado</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Análise de Rentabilidade e Produção</h2>

            {/* Correlação Categoria vs. Tempo de Produção (R$/min) */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Rentabilidade por Tempo de Produção (R$/min)</h3>
              <p className="text-sm text-gray-600 mb-4">
                Compara o faturamento total da categoria com o tempo total de SLA necessário para produzir todos os itens vendidos.
              </p>
              <div className="space-y-4">
                {analysisData.categoryCorrelation.map((data, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-gray-900">{data.categoryName}</h4>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">Tempo Total de Produção (min):</span>
                        <span className="font-bold text-blue-600">{data.totalProductionTime.toFixed(0)} min</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm pt-2 border-t">
                      <div>
                        <span className="text-gray-600">Faturamento Total:</span>
                        <span className="font-bold text-amber-600 ml-2">R$ {data.revenue.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Unidades Vendidas:</span>
                        <span className="font-bold text-gray-800 ml-2">{data.quantity}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Rentabilidade Categoria:</span>
                        <span className={`font-bold ml-2 text-xl ${data.revenuePerMinute > 1 ? 'text-green-600' : 'text-red-600'}`}>
                          R$ {data.revenuePerMinute.toFixed(2)}/min
                        </span>
                      </div>
                    </div>
                    
                    {/* Detalhe dos Itens - Agora com formatação alinhada */}
                    {data.items.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase">Itens da Categoria:</h5>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {data.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                              <h6 className="font-medium text-gray-900 text-sm mb-2 truncate">{item.name}</h6>
                              <div className="grid grid-cols-3 gap-4 text-xs">
                                <div>
                                  <span className="text-gray-600">Unidades:</span>
                                  <span className="font-bold text-gray-800 ml-1">{item.quantity}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Receita:</span>
                                  <span className="font-bold text-amber-600 ml-1">R$ {item.revenue.toFixed(2)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">R$/min:</span>
                                  <span className={`font-bold ml-1 ${item.revenuePerMinute > 1 ? 'text-green-600' : 'text-red-600'}`}>
                                    {item.revenuePerMinute.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                                Tempo Produção: <span className="font-medium text-blue-600">{item.productionTime.toFixed(0)} min</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {analysisData.categoryCorrelation.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <i className="ri-line-chart-line text-2xl mb-2"></i>
                    <p className="text-sm">Nenhum dado de correlação disponível</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <OrderListTab
            orders={filteredOrders}
            onMarkAsDelivered={handleMarkAsDeliveredDummy} // Função dummy, pois não deve entregar pedidos aqui
          />
        )}

        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Tempo médio aguardando produção (NEW) */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <i className="ri-hourglass-line text-xl text-blue-600"></i>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Tempo Médio Espera (NEW)</p>
                    <p className="text-2xl font-bold text-gray-900">{performanceData.averageTimeInNew.toFixed(1)}m</p>
                  </div>
                </div>
              </div>
              
              {/* Tempo médio de preparo (PREPARING) */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <i className="ri-fire-line text-xl text-yellow-600"></i>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Tempo Médio Preparo</p>
                    <p className="text-2xl font-bold text-gray-900">{performanceData.averagePreparingTime.toFixed(1)}m</p>
                  </div>
                </div>
              </div>
              
              {/* Tempo médio para entregar (READY) */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <i className="ri-truck-line text-xl text-purple-600"></i>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Tempo Médio Entrega (READY)</p>
                    <p className="text-2xl font-bold text-gray-900">{performanceData.averageReadyTime.toFixed(1)}m</p>
                  </div>
                </div>
              </div>
              
              {/* Tempo médio total (Cozinha) */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <i className="ri-speed-up-line text-xl text-green-600"></i>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Tempo Médio Cozinha (Total)</p>
                    <p className="text-2xl font-bold text-gray-900">{performanceData.averageDeliveryTime.toFixed(0)}m</p>
                  </div>
                </div>
              </div>
              
              {/* Linha 2 */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <i className="ri-checkbox-circle-line text-xl text-amber-600"></i>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Taxa Pontualidade</p>
                    <p className="text-2xl font-bold text-gray-900">{performanceData.onTimeRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <i className="ri-alarm-warning-line text-xl text-red-600"></i>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Pedidos Atrasados</p>
                    <p className="text-2xl font-bold text-gray-900">{performanceData.overdueOrders}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 lg:col-span-2">
                <h3 className="font-medium text-gray-900 mb-3">Indicadores de Eficiência</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Pontualidade</span>
                      <span className="font-medium">{performanceData.onTimeRate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(performanceData.onTimeRate, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Eficiência SLA (Tempo Cozinha vs. SLA)</span>
                      <span className="font-medium">
                        {performanceData.averageDeliveryTime <= performanceData.averageSla ? 'Boa' : 'Precisa melhorar'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          performanceData.averageDeliveryTime <= performanceData.averageSla 
                            ? 'bg-green-600' 
                            : 'bg-red-600'
                        }`}
                        style={{ 
                          width: `${Math.min((performanceData.averageSla / Math.max(performanceData.averageDeliveryTime, 1)) * 100, 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Removido ItemPreparationMetrics */}
          </div>
        )}
        </>
      )}
      </div>
    </div>
  );
}
