import { useState, useEffect, useRef, useMemo, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import OrderBoard from './components/OrderBoard';
import OperatorManagementModal from './components/OperatorManagementModal';
import KitchenSelectModal from './components/KitchenSelectModal';
import AlertModal from '../../components/base/AlertModal';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { Order, KitchenOperator, Category, ProductionUnit, OperationalSession } from '../../types';
import { useOffline } from '../../hooks/useOffline';
import Button from '../../components/base/Button';
import { mockCategories } from '../../mocks/data';
import { showSuccess } from '../../utils/toast';
import ReadyOrderTable from './components/ReadyOrderTable';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/base/Modal';
import DeliveredOrderList from './components/DeliveredOrderList';
import Icon from '../../ui/Icon';
// Serviços offline (leitura do SQLite)
import * as productsService from "../../offline/services/productsService";
import * as kdsService from "../../offline/services/kdsService";
import * as cashService from "../../offline/services/cashService";
import { ensureDeviceProfile } from '@/offline/services/deviceProfileService'

import OperationModeBadge from '@/components/OperationModeBadge'
import { getDeviceProfile } from '../../offline/services/deviceProfileService'

const createProductionUnits = (quantity: number): ProductionUnit[] => {
  const units: ProductionUnit[] = [];
  for (let i = 0; i < quantity; i++) {
    units.push({
      unitId: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      unitStatus: 'PENDING',
      operatorName: undefined,
      completedObservations: [],
    });
  }
  return units;
};

export default function CozinhaPage() {
  const { user, store } = useAuth();
  const navigate = useNavigate();

  // Seleção de cozinha e operador
  const [showKitchenSelect, setShowKitchenSelect] = useState(true);
  const [selectedKitchenId, setSelectedKitchenId] = useLocalStorage<string | null>('kds_selected_kitchen_id', null);
  const [selectedKitchenName, setSelectedKitchenName] = useLocalStorage<string>('kds_selected_kitchen_name', 'Todas as Cozinhas');
  const [currentOperatorName, setCurrentOperatorName] = useLocalStorage<string>('kds_current_operator', '');

  const [orders, setOrders] = useState<Order[]>([]);
  const [operators, setOperators] = useLocalStorage<KitchenOperator[]>('kitchenOperators', []);
  useEffect(() => {
    (async () => { try { await kdsService.broadcastOperators(operators) } catch { } })()
  }, [operators])
  const [categories, setCategories] = useLocalStorage<Category[]>('categories', mockCategories);

  const [operationalSession] = useLocalStorage<OperationalSession | null>('currentOperationalSession', null);
  const [cashSession, setCashSession] = useLocalStorage<any>('currentCashSession', null);

  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [showOperatorViewModal, setShowOperatorViewModal] = useState(false);
  const [operatorFilter, setOperatorFilter] = useState('');
  const [onlyPreparingOperatorView, setOnlyPreparingOperatorView] = useState(true);


  const [showReadyModal, setShowReadyModal] = useState(false);
  const [showDeliveredModal, setShowDeliveredModal] = useState(false);
  const [showCanceledModal, setShowCanceledModal] = useState(false);

  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertModalMessage, setAlertModalMessage] = useState({ title: '', message: '', variant: 'error' as 'error' | 'info' | 'success' });

  const [showDeliveryConfirmation, setShowDeliveryConfirmation] = useState(false);
  const [orderToDeliver, setOrderToDeliver] = useState<Order | null>(null);
  // Checklist de entrega por item/unidade (Cozinha)
  const [deliveryUnitChecks, setDeliveryUnitChecks] = useState<Record<string, boolean>>({});

  // Removido: estado e UI da aba Configurações embutida



  const previousOrdersRef = useRef<Order[]>(orders);
  const hasMigratedRef = useRef(false); // NOVO: Ref para controlar se a migração já foi tentada
  const getOrderDetails = (id: string): { pin?: string; password?: string } => {
    try { const raw = localStorage.getItem('kdsOrderDetails'); const map = raw ? JSON.parse(raw) : {}; return map[id] || {} } catch { return {} }
  }
  const setOrderDetails = (id: string, patch: { pin?: string; password?: string }) => {
    try { const raw = localStorage.getItem('kdsOrderDetails'); const map = raw ? JSON.parse(raw) : {}; map[id] = { ...(map[id] || {}), ...patch }; localStorage.setItem('kdsOrderDetails', JSON.stringify(map)) } catch { }
  }

  const isOperationalSessionOpen = useMemo(() => !!operationalSession && operationalSession.status === 'OPEN', [operationalSession]);

  const activeProductionOrders = useMemo(() => {
    return orders.filter(order => ['NEW', 'PREPARING', 'READY'].includes(order.status));
  }, [orders]);

  useEffect(() => {
    let mounted = true
    const hubUrl = (() => {
      const envUrl = (import.meta as any)?.env?.VITE_LAN_HUB_URL
      if (envUrl) return envUrl
      const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost'
      return `http://${host}:4000`
    })()
    const secret = (import.meta as any)?.env?.VITE_LAN_SYNC_SECRET || undefined
      ; (async () => {
        try {
          const dp = await getDeviceProfile()
          const unitId = dp?.unitId || 'default'
          const deviceId = dp?.deviceId || crypto.randomUUID()
          if (!secret) {
            try {
              const { supabase } = await import('../../utils/supabase')
              if (supabase && mounted) {
                const loadAll = async () => {
                  const kitchenFilter = selectedKitchenId || undefined
                  const queued = await kdsService.listTicketsByStatus('queued', kitchenFilter)
                  const prep = await kdsService.listTicketsByStatus('prep', kitchenFilter)
                  const ready = await kdsService.listTicketsByStatus('ready', kitchenFilter)
                  const done = await kdsService.listTicketsByStatus('done', kitchenFilter)
                  const all = [...queued, ...prep, ...ready, ...done]
                  startTransition(() => { setOrders(all as any) })
                }
                await loadAll()

                // Debounce para prevenir loop infinito: agrupa múltiplas mudanças em 500ms
                let debounceTimer: NodeJS.Timeout | null = null

                const sub = supabase
                  .channel('kds_tickets_changes')
                  .on('postgres_changes', { event: '*', schema: 'public', table: 'kds_tickets' }, async () => {
                    if (debounceTimer) clearTimeout(debounceTimer)
                    debounceTimer = setTimeout(async () => {
                      await loadAll()
                      debounceTimer = null
                    }, 500)
                  })
                  .subscribe()
                const unsub = () => {
                  if (debounceTimer) clearTimeout(debounceTimer)
                  try { sub.unsubscribe() } catch { }
                }
                return () => { unsub() }
              }
            } catch { }
            return
          }
          const wsUrl = hubUrl.replace(/^http/, 'ws') + `/realtime?token=${encodeURIComponent(secret)}`
          let attempt = 0
          let reconnectTimer: any = null
          const connect = () => {
            if (!mounted) return
            attempt++
            const ws = new WebSocket(wsUrl)
            ws.addEventListener('open', () => {
              ws.send(JSON.stringify({ unit_id: unitId, device_id: deviceId }))
            })
            ws.addEventListener('message', (ev) => {
              if (!mounted) return
              let events: any[] = []
              try { const msg = JSON.parse(String((ev as MessageEvent).data)); if (msg?.type === 'events') events = msg.events || [] } catch { }
              if (!Array.isArray(events) || events.length === 0) return
              try { (async () => { await kdsService.applyHubEvents(events) })() } catch { }
              const tickets = events.filter((e: any) => String(e.table) === 'kdsTickets' && (e.row || e.rows))
              const ordersEv = events.filter((e: any) => String(e.table) === 'orders' && (e.row || e.rows))
              const phaseTimesEv = events.filter((e: any) => String(e.table) === 'kds_phase_times' && (e.row || e.rows))
              if (tickets.length) {
                const mapToOrderStatus = (s: string) => s === 'ready' ? 'READY' : s === 'prep' ? 'PREPARING' : s === 'done' ? 'DELIVERED' : 'NEW'
                const byIdStatus: Record<string, string> = {}
                for (const e of tickets) {
                  const r = e.row || {}
                  const id = String(r.order_id ?? r.orderId ?? r.id)
                  const st = mapToOrderStatus(String(r.status ?? e.status ?? 'queued'))
                  byIdStatus[id] = st
                }
                startTransition(() => {
                  setOrders(prev => prev.map(o => {
                    const oid = String(o.id)
                    const st = byIdStatus[oid]
                    if (!st) return o
                    if (st === 'DELIVERED') return { ...o, status: 'DELIVERED', deliveredAt: o.deliveredAt ?? new Date(), updatedAt: o.updatedAt }
                    if (st === 'READY') return { ...o, status: 'READY', readyAt: o.readyAt ?? new Date() }
                    if (st === 'PREPARING') return { ...o, status: 'PREPARING', updatedAt: o.updatedAt ?? new Date(), readyAt: undefined }
                    if (st === 'NEW') return { ...o, status: 'NEW', updatedAt: undefined, readyAt: undefined }
                    return o
                  }))
                })
              }
              if (ordersEv.length) {
                for (const e of ordersEv) {
                  const r = e.row || {}
                  const id = String(r.id || '')
                  const pin = typeof r.pin === 'string' ? r.pin : undefined
                  const password = typeof r.password === 'string' ? r.password : undefined
                  if (id && (pin || password)) setOrderDetails(id, { pin, password })
                }
                startTransition(() => {
                  setOrders(prev => prev.map(o => {
                    const evs = ordersEv.filter(e => String(e.row?.id || e.rows?.[0]?.id || '') === String(o.id))
                    const r = evs.length ? (evs[evs.length - 1].row || {}) : {}
                    const st = String(r.status || '').toLowerCase()
                    const det = getOrderDetails(String(o.id))
                    const next: Order = { ...o }
                    if (!next.pin && det.pin) next.pin = det.pin
                    if (!next.password && det.password) next.password = det.password
                    if (st === 'closed') {
                      next.status = 'DELIVERED'
                      next.deliveredAt = r.closed_at ? new Date(r.closed_at) : (o.deliveredAt ?? new Date())
                    }
                    return next
                  }))
                })
              }
              if (phaseTimesEv.length) {
                startTransition(() => {
                  setOrders(prev => prev.map(o => {
                    const evs = phaseTimesEv.filter(e => String(e.row?.orderId || '') === String(o.id))
                    if (!evs.length) return o
                    const patch = evs.reduce((acc: any, e: any) => ({ ...acc, ...e.row }), {})
                    const createdAt = patch.newStart ? new Date(patch.newStart) : o.createdAt
                    const updatedAt = patch.preparingStart ? new Date(patch.preparingStart) : o.updatedAt
                    const readyAt = patch.readyAt ? new Date(patch.readyAt) : o.readyAt
                    const deliveredAt = patch.deliveredAt ? new Date(patch.deliveredAt) : o.deliveredAt
                    return { ...o, createdAt, updatedAt, readyAt, deliveredAt }
                  }))
                })
              }
            })
            const scheduleReconnect = () => {
              if (!mounted) return
              const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(5, attempt)))
              clearTimeout(reconnectTimer)
              reconnectTimer = setTimeout(() => connect(), delay)
            }
            ws.addEventListener('error', () => { scheduleReconnect() })
            ws.addEventListener('close', () => { scheduleReconnect() })
          }
          connect()
        } catch { }
      })()
    return () => { mounted = false }
  }, [setOrders, selectedKitchenId])

  // Listener para mudanças no banco de dados em tempo real (sincronização entre janelas)
  useEffect(() => {
    const api = (window as any)?.api
    if (!api?.db?.onChange) return

    const unsubscribe = api.db.onChange((event: any) => {
      if (!event || !event.table) return

      const { table, operation } = event

      // Tabelas que afetam os pedidos
      const relevantTables = ['orders', 'order_items', 'payments', 'kds_phase_times', 'kds_tickets', 'orders_details', 'kds_unit_states']
      if (!relevantTables.includes(table)) return

      // Recarregar pedidos quando houver mudanças relevantes
      if (operation === 'insert' || operation === 'update' || operation === 'delete') {
        // Pequeno delay para garantir que a transação foi commitada
        setTimeout(async () => {
          try {
            const tickets = await kdsService.listTicketsByStatus('queued')
            const prepTickets = await kdsService.listTicketsByStatus('prep')
            const readyTickets = await kdsService.listTicketsByStatus('ready')
            const doneTickets = await kdsService.listTicketsByStatus('done')

            const allTickets = [...tickets, ...prepTickets, ...readyTickets, ...doneTickets]
            const out: Order[] = []

            for (const t of allTickets) {
              const ordId = String(t.order_id ?? t.orderId ?? '')
              if (!ordId) continue

              const times = await kdsService.getPhaseTimes(ordId)
              const api = (window as any)?.api
              const resItems = api?.db ? await api.db.query(
                'SELECT oi.*, p.name as product_name, p.category_id as category_id FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?',
                [ordId]
              ) : { rows: [] }
              const items = ((resItems?.rows ?? []) as any[]).map((it: any) => ({
                id: String(it.id),
                quantity: Number(it.qty ?? 1),
                skipKitchen: false,
                menuItem: {
                  id: String(it.product_id ?? ''),
                  name: String(it.product_name ?? 'Item'),
                  unitDeliveryCount: 1,
                  categoryId: String(it.category_id ?? ''),
                },
                productionUnits: Array.from({ length: Math.max(1, Number(it.qty ?? 1)) }, (_, idx) => ({
                  unitId: `${String(it.id)}-${idx + 1}`,
                  unitStatus: 'PENDING' as ProductionUnit['unitStatus'],
                  operatorName: undefined,
                  completedObservations: [],
                  completedAt: undefined,
                })),
              }))

              try {
                const unitMap = await kdsService.loadUnitStatesForOrder(ordId)
                const mergedItems = items.map((it: any) => ({
                  ...it,
                  productionUnits: it.productionUnits.map((u: any) => {
                    // Use production_unit_id key format if available
                    // The key format in kdsService.loadUnitStatesForOrder is:
                    // `${orderId}:${itemId}:${unitId}`
                    // unitId here is u.unitId which is `${itemId}-${idx+1}`
                    // This matches the format we used when saving if we passed unitId correctly
                    const key = `${ordId}:${String(it.id)}:${u.unitId}`
                    const s = unitMap[key] || {}
                    
                    return {
                      ...u,
                      operatorName: s.operatorName || u.operatorName,
                      unitStatus: (s.unitStatus || u.unitStatus) as ProductionUnit['unitStatus'],
                      completedObservations: Array.isArray(s.completedObservations) ? s.completedObservations : u.completedObservations,
                      completedAt: s.completedAt || u.completedAt,
                      deliveredAt: s.deliveredAt || u.deliveredAt,
                    }
                  })
                }))

                const pin = t.pin
                const password = t.password
                const statusMap: Record<string, Order['status']> = {
                  'queued': 'NEW',
                  'prep': 'PREPARING',
                  'ready': 'READY',
                  'done': 'DELIVERED',
                }

                out.push({
                  id: ordId,
                  ticketId: String(t.id),
                  pin: pin || '',
                  password: password || '',
                  items: mergedItems,
                  total: 0,
                  status: statusMap[String(t.status)] || 'NEW',
                  createdAt: times?.newStart ? new Date(times.newStart) : new Date(),
                  readyAt: times?.readyAt ? new Date(times.readyAt) : undefined,
                  deliveredAt: times?.deliveredAt ? new Date(times.deliveredAt) : undefined,
                  slaMinutes: 30,
                  createdBy: 'Sistema',
                  updatedAt: times?.preparingStart ? new Date(times.preparingStart) : undefined,
                } as unknown as Order)
              } catch {
                // Fallback sem unit states
                const pin = t.pin
                const password = t.password
                const statusMap: Record<string, Order['status']> = {
                  'queued': 'NEW',
                  'prep': 'PREPARING',
                  'ready': 'READY',
                  'done': 'DELIVERED',
                }
                out.push({
                  id: ordId,
                  ticketId: String(t.id),
                  pin: pin || '',
                  password: password || '',
                  items,
                  total: 0,
                  status: statusMap[String(t.status)] || 'NEW',
                  createdAt: times?.newStart ? new Date(times.newStart) : new Date(),
                  readyAt: times?.readyAt ? new Date(times.readyAt) : undefined,
                  deliveredAt: times?.deliveredAt ? new Date(times.deliveredAt) : undefined,
                  slaMinutes: 30,
                  createdBy: 'Sistema',
                  updatedAt: times?.preparingStart ? new Date(times.preparingStart) : undefined,
                } as unknown as Order)
              }
            }

            setOrders(out)
          } catch (err) {
            console.warn('Erro ao recarregar pedidos após mudança no banco:', err)
          }
        }, 100)
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [setOrders])

  const readyOrdersList = useMemo(() => orders.filter(order => order.status === 'READY'), [orders]);
  const deliveredOrdersList = useMemo(() => orders.filter(o => o.status === 'DELIVERED'), [orders]);
  const canceledOrdersList = useMemo(() => orders.filter(o => o.status === 'CANCELLED'), [orders]);

  const operatorGroups = useMemo(() => {
    const groups: Record<string, { name: string; units: { orderId: string; orderPin: string; itemName: string; unitId: string; status: ProductionUnit['unitStatus'] }[] }> = {};
    orders.forEach(order => {
      (order.items || []).forEach(item => {
        if (item.skipKitchen || item.menuItem?.skipKitchen) return;
        (item.productionUnits || []).forEach(unit => {
          const key = unit.operatorName || 'Sem Operador';
          const g = groups[key] || { name: key, units: [] };
          g.units.push({ orderId: order.id, orderPin: order.pin, itemName: item.menuItem?.name || 'Item', unitId: unit.unitId, status: unit.unitStatus });
          groups[key] = g;
        });
      });
    });
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  useEffect(() => {
    const interval = setInterval(() => {
      startTransition(() => {
        setOrders(prev => prev.map(o => {
          try {
            const raw = localStorage.getItem('kdsPhaseTimes')
            const obj = raw ? JSON.parse(raw) : {}
            const patch = obj[String(o.id)] || {}
            return {
              ...o,
              createdAt: patch.newStart ? new Date(patch.newStart) : o.createdAt,
              updatedAt: patch.preparingStart ? new Date(patch.preparingStart) : o.updatedAt,
              readyAt: patch.readyAt ? new Date(patch.readyAt) : o.readyAt,
              deliveredAt: patch.deliveredAt ? new Date(patch.deliveredAt) : o.deliveredAt,
            }
          } catch { return o }
        }))
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // NOVO useEffect para a lógica de migração, executado apenas uma vez na montagem
  useEffect(() => {
    if (hasMigratedRef.current) return; // Já tentou migrar, não faça novamente

    let needsUpdate = false;

    const migratedOrders = orders.map(order => {
      let orderNeedsUpdate = false;
      let currentOrder = order;

      if (!('operationalSessionId' in currentOrder) && operationalSession) {
        orderNeedsUpdate = true;
        currentOrder = { ...currentOrder, operationalSessionId: operationalSession.id };
      }

      const updatedItems = currentOrder.items.map(item => {
        let itemNeedsUpdate = false;
        let currentItem = item;

        const isUnitStructureInvalid = !currentItem.productionUnits ||
          currentItem.productionUnits.length === 0 ||
          currentItem.productionUnits.length !== currentItem.quantity;

        if (isUnitStructureInvalid) {
          itemNeedsUpdate = true;

          const oldStatus = (currentItem as any).itemStatus;
          const newUnits = createProductionUnits(currentItem.quantity);

          if (oldStatus === 'READY') {
            newUnits.forEach(unit => unit.unitStatus = 'READY');
          }

          currentItem = {
            ...currentItem,
            productionUnits: newUnits,
            operatorName: undefined,
            itemStatus: undefined,
          };
        }

        const unitsWithObsMigration = currentItem.productionUnits.map(unit => {
          let updatedUnit = unit;
          let unitNeedsUpdate = false;

          if (!('completedObservations' in unit)) {
            unitNeedsUpdate = true;
            updatedUnit = { ...updatedUnit, completedObservations: [] };
          }
          if (!('completedAt' in unit)) {
            unitNeedsUpdate = true;
            updatedUnit = { ...updatedUnit, completedAt: undefined };
          }

          if (unitNeedsUpdate) {
            itemNeedsUpdate = true;
            return updatedUnit;
          }
          return unit;
        });

        if (itemNeedsUpdate) {
          orderNeedsUpdate = true;
          return { ...currentItem, productionUnits: unitsWithObsMigration };
        }

        return currentItem;
      });

      if (orderNeedsUpdate) {
        needsUpdate = true;
        return { ...currentOrder, items: updatedItems };
      }
      return currentOrder;
    });

    if (needsUpdate) {
      setOrders(migratedOrders);
      console.log('Dados de pedidos migrados para nova estrutura de ProductionUnits.');
    }

    hasMigratedRef.current = true; // Marca que a migração foi tentada
  }, [orders, setOrders, operationalSession]); // Dependências para a migração

  // Carregamento inicial: operadores, categorias e sessão de caixa
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        try { await ensureDeviceProfile({ role: 'kds' }) } catch (e) { }
        await productsService.migrateLocalStorageCatalog()
        const [ops, cats, sess] = await Promise.all([
          kdsService.listOperators(),
          productsService.listCategories(),
          cashService.getCurrentSession(),
        ]);

        if (!mounted) return;

        if (Array.isArray(ops)) {
          startTransition(() => setOperators(ops as KitchenOperator[]));
        }

        if (Array.isArray(cats)) {
          const mapped = (cats as any[]).map((c: any, idx: number) => ({ id: String(c.id), name: String(c.name ?? 'Sem nome'), active: true, order: idx })) as Category[];
          startTransition(() => setCategories(mapped));
        }

        if (sess) {
          startTransition(() => setCashSession(sess));
        }
      } catch (error) {
        console.warn('cozinha: carregamento inicial', error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setOperators, setCategories, setCashSession]);

  // Carregar tickets por status e atualizar orders (mantendo estrutura da UI)
  useEffect(() => {
    let mounted = true;
    const mapStatus = (s: string): Order['status'] => {
      switch (s) {
        case 'queued': return 'NEW';
        case 'prep': return 'PREPARING';
        case 'ready': return 'READY';
        case 'done': return 'DELIVERED';
        default: return 'NEW';
      }
    };
    const fetchTickets = async () => {
      try {
        const [tkQueued, tkPrep, tkReady, tkDone] = await Promise.all([
          kdsService.listTicketsByStatus('queued'),
          kdsService.listTicketsByStatus('prep'),
          kdsService.listTicketsByStatus('ready'),
          kdsService.listTicketsByStatus('done'),
        ]);

        console.log('[DEBUG] fetchTickets counts:', {
          queued: tkQueued?.length,
          prep: tkPrep?.length,
          ready: tkReady?.length,
          done: tkDone?.length
        });

        if (tkPrep && tkPrep.length > 0) {
            console.log('[DEBUG] Prep tickets IDs:', tkPrep.map((t: any) => t.id || t.ticketId));
        }

        const tk = ([] as any[]).concat(tkQueued || [], tkPrep || [], tkReady || [], tkDone || []);
        if (!mounted || !Array.isArray(tk)) return;
        const supabaseItemsCache: Record<string, any[]> = {};
        const fetchItemsFromSupabase = async (orderId: string) => {
          try {
            const { supabase } = await import('../../utils/supabase');
            if (!supabase) return [];
            const { data, error } = await supabase
              .from('order_items')
              .select(`id, qty, unit_price_cents, product_id, products:products(id, name, sla_minutes, skip_kitchen, unit_delivery_count, category_id)`) // join
              .eq('order_id', orderId);
            if (error) return [];
            return (data || []).map((it: any) => ({
              id: String(it.id),
              quantity: Number(it.qty ?? 1),
              skipKitchen: Boolean(it.products?.skip_kitchen ?? false),
              menuItem: {
                id: String(it.products?.id ?? ''),
                name: String(it.products?.name ?? 'Item'),
                unitDeliveryCount: Number(it.products?.unit_delivery_count ?? 1),
                sla: Number(it.products?.sla_minutes ?? 15),
                categoryId: String(it.products?.category_id ?? ''),
              },
              productionUnits: Array.from({ length: Math.max(1, Number(it.qty ?? 1)) }, (_, idx) => ({
                unitId: `${String(it.id)}-${idx + 1}`,
                unitStatus: 'PENDING' as ProductionUnit['unitStatus'],
                operatorName: undefined,
                completedObservations: [],
                completedAt: undefined,
              })),
            }));
          } catch { return [] }
        };

        const mappedOrders: Order[] = [];
        for (const t of tk as any[]) {
          const oid = String(t.order_id ?? t.orderId ?? '')
          let items: any[] = Array.isArray(t.items) ? t.items : []
          if (!items.length && oid) {
            if (supabaseItemsCache[oid]) {
              items = supabaseItemsCache[oid]
            } else {
              const fetched = await fetchItemsFromSupabase(oid)
              supabaseItemsCache[oid] = fetched
              items = fetched
            }
          }

          // [FIX] Load persisted unit states from Supabase/DB to prevent overwriting with PENDING
          let unitMap: Record<string, any> = {}
          try {
             unitMap = await kdsService.loadUnitStatesForOrder(oid)
          } catch {}

          items = items.map((item: any) => {
            // Base production units (default)
            const defaultUnits = Array.from({ length: Math.max(1, Number(item.quantity ?? 1)) }, (_, idx) => ({
              unitId: `${String(item.id)}-${idx + 1}`,
              unitStatus: 'PENDING' as ProductionUnit['unitStatus'],
              operatorName: undefined,
              completedObservations: [],
              completedAt: undefined,
            }))

            // Use existing units if available, otherwise default
            const currentUnits = Array.isArray(item.productionUnits) ? item.productionUnits : defaultUnits

            // Merge with persisted state
            const mergedUnits = currentUnits.map((u: any) => {
               // Use consistent key format: orderId:itemId:unitId
               const key = `${oid}:${String(item.id)}:${u.unitId}`
               const s = unitMap[key] || {}
               return {
                 ...u,
                 unitId: u.unitId ?? `${String(item.id)}-1`, // Ensure unitId exists
                 operatorName: s.operatorName || u.operatorName,
                 unitStatus: (s.unitStatus || u.unitStatus || 'PENDING'),
                 completedObservations: Array.isArray(s.completedObservations) ? s.completedObservations : (u.completedObservations || []),
                 completedAt: s.completedAt ? new Date(s.completedAt) : (u.completedAt ? new Date(u.completedAt) : undefined),
                 deliveredAt: s.deliveredAt ? new Date(s.deliveredAt) : (u.deliveredAt ? new Date(u.deliveredAt) : undefined),
               }
            })

            return {
              id: String(item.id ?? Math.random().toString(36)),
              quantity: Number(item.quantity ?? 1),
              skipKitchen: Boolean(item.skipKitchen ?? false),
              menuItem: {
                id: String(item.menuItem?.id ?? item.menuItemId ?? ''),
                name: String(item.menuItem?.name ?? item.name ?? 'Item'),
                unitDeliveryCount: Number(item.menuItem?.unitDeliveryCount ?? item.unitDeliveryCount ?? 1),
                sla: Number(item.menuItem?.sla ?? item.sla ?? 15),
                categoryId: String(item.menuItem?.categoryId ?? item.categoryId ?? ''),
              },
              productionUnits: mergedUnits
            }
          })
          const slaMinutes = items.reduce((sum: number, it: any) => sum + (Number(it.menuItem?.sla ?? 15) * Math.max(1, Number(it.quantity ?? 1))), 0)
          const details = getOrderDetails(String(t.order_id ?? t.orderId ?? t.id ?? ''))
          const ord: Order = {
            id: String(t.order_id ?? t.orderId ?? ''),
            pin: String(t.pin ?? t.orderPin ?? details.pin ?? ''),
            password: String(t.password ?? details.password ?? ''),
            status: mapStatus(String(t.status ?? 'queued')),
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
            readyAt: t.readyAt ? new Date(t.readyAt) : undefined,
            deliveredAt: t.deliveredAt ? new Date(t.deliveredAt) : undefined,
            items,
            slaMinutes,
            total: 0,
            paymentMethod: '',
            createdBy: 'KDS',
          }
            ; (ord as any).ticketId = String(t.id ?? t.ticketId ?? ord.id)
          mappedOrders.push(ord as Order)
        }
        const validOrders = mappedOrders.filter(o => o.id && String(o.id).trim().length > 0)
        const merged = validOrders.map(o => {
          const prev = previousOrdersRef.current.find(po => po.id === o.id)
          const prevItems = prev?.items || []
          const createdAt = (() => {
            if (prev?.createdAt && o.createdAt) return prev.createdAt.getTime() <= o.createdAt.getTime() ? prev.createdAt : o.createdAt
            return prev?.createdAt ?? o.createdAt
          })()
          const updatedAt = (() => {
            if (prev?.updatedAt && o.updatedAt) return prev.updatedAt.getTime() <= o.updatedAt.getTime() ? prev.updatedAt : o.updatedAt
            return o.updatedAt ?? prev?.updatedAt
          })()
          const readyAt = o.readyAt ?? prev?.readyAt
          const deliveredAt = o.deliveredAt ?? prev?.deliveredAt
          const items = (o.items && o.items.length > 0 ? o.items : prevItems).filter(it => !(it.skipKitchen || it.menuItem?.skipKitchen))
          const pin = (o.pin && String(o.pin).trim()) ? o.pin : (prev?.pin ?? '')
          const password = (o.password && String(o.password).trim()) ? o.password : (prev?.password ?? '')
          return { ...o, items, createdAt, updatedAt, readyAt, deliveredAt, pin, password }
        })
        const rank = (s: Order['status']) => s === 'DELIVERED' ? 3 : s === 'READY' ? 2 : s === 'PREPARING' ? 1 : 0
        const byId: Record<string, Order> = {}
        for (const o of merged) {
          const cur = byId[o.id]
          if (!cur) { byId[o.id] = o; continue }
          const lenCur = (cur.items || []).length
          const lenNext = (o.items || []).length
          if (lenNext > lenCur) { byId[o.id] = o; continue }
          if (lenNext === lenCur && rank(o.status) > rank(cur.status)) { byId[o.id] = o }
        }
        const final = Object.values(byId)
        startTransition(() => setOrders(final));
      } catch (error) {
      }
    };
    fetchTickets();
    const timer = setInterval(fetchTickets, 2000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [setOrders]);

  // useEffect para monitorar pedidos prontos e disparar notificação (mantido separado)
  useEffect(() => {
    const previousOrders = previousOrdersRef.current;

    orders.forEach(currentOrder => {
      const previousOrder = previousOrders.find(o => o.id === currentOrder.id);
      if (currentOrder.status === 'READY' && previousOrder?.status !== 'READY') {
        // showSuccess(`Pedido #${currentOrder.pin} (Senha: ${currentOrder.password}) marcado como PRONTO!`); // REMOVIDO
      }
    });

    previousOrdersRef.current = orders;
  }, [orders]); // Dependência apenas de orders para este efeito

  const displayAlert = (title: string, message: string, variant: 'error' | 'info' | 'success' = 'error') => {
    setAlertModalMessage({ title, message, variant });
    setShowAlertModal(true);
  };

  // Pré-marcar unidades já entregues (entrega direta) ao abrir confirmação
  useEffect(() => {
    if (showDeliveryConfirmation && orderToDeliver) {
      const init: Record<string, boolean> = {};
      (orderToDeliver.items || []).forEach(it => {
        const totalUnits = Math.max(1, (it.quantity || 1) * Math.max(1, it.menuItem?.unitDeliveryCount || 1));
        const delivered = Math.max(0, it.directDeliveredUnitCount || 0);
        for (let i = 0; i < totalUnits; i++) {
          const key = `${it.id}-${i}`;
          init[key] = i < delivered; // Unidades já entregues ficam pré-marcadas
        }
      });
      setDeliveryUnitChecks(init);
    } else {
      setDeliveryUnitChecks({});
    }
  }, [showDeliveryConfirmation, orderToDeliver]);

  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    if (status === 'DELIVERED') {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setOrderToDeliver(order);
        setShowDeliveryConfirmation(true);
      }
      return;
    }

    // Atualiza status via serviço KDS PRIMEIRO, aguarda confirmação, depois atualiza UI
    (async () => {
      try {
        console.log('[DEBUG] updateOrderStatus called', { orderId, status });
        // Correção CRÍTICA: NEW → queued, PREPARING → prep, READY → ready, DELIVERED → done
        const mapToKds = (s: Order['status']) => {
          if (s === 'NEW') return 'queued';
          if (s === 'PREPARING') return 'prep';
          if (s === 'READY') return 'ready';
          if (s === 'DELIVERED') return 'done';
          return 'queued';
        };
        const ord = orders.find(o => o.id === orderId)
        const tId = (ord as any)?.ticketId || orderId
        
        // Tenta usar Supabase diretamente se disponível (Web Mode)
        if (isOnline) {
            console.log('[DEBUG] isOnline=true, trying Supabase direct update');
            const { supabase } = await import('../../utils/supabase');
            if (supabase) {
              // Fix: Supabase expects 'PREPARING', 'NEW', 'READY', 'DELIVERED' in kds_tickets
              // But mapToKds returns 'prep', 'queued', etc.
              // We should use the uppercase status for the DB value to match kdsService expectations.
              const dbStatus = status; 
              console.log('[DEBUG] updating kds_tickets status to', dbStatus);
              const { error } = await supabase
                .from('kds_tickets')
                .update({ status: dbStatus, updated_at: new Date().toISOString() })
                .eq('id', tId);
                
              if (error) {
                console.error('[Cozinha] Erro ao atualizar Supabase:', error);
                // Fallback para kdsService se falhar (pode ser ticket não encontrado ou outra tabela)
              } else {
                console.log('[Cozinha] Status atualizado no Supabase com sucesso:', { orderId, status });
                // Persistir timestamps de fase
                try {
                  const nowIso = new Date().toISOString();
                  const patch: any = { order_id: orderId };
                  if (status === 'NEW') patch.new_start = nowIso;
                  if (status === 'PREPARING') patch.preparing_start = nowIso;
                  if (status === 'READY') patch.ready_at = nowIso;
                  if (status === 'DELIVERED') patch.delivered_at = nowIso;
                  
                  // Fix: Use SELECT -> UPDATE/INSERT instead of UPSERT to avoid 400 Bad Request if unique constraint is missing
                  const { data: existingPhases } = await supabase
                    .from('kds_phase_times')
                    .select('id')
                    .eq('order_id', orderId)
                    .limit(1);
                    
                  if (existingPhases && existingPhases.length > 0) {
                    await supabase.from('kds_phase_times').update(patch).eq('order_id', orderId);
                  } else {
                    const { error: insertErr } = await supabase.from('kds_phase_times').insert(patch);
                    // Fallback for race condition or if row appeared
                    if (insertErr) {
                       await supabase.from('kds_phase_times').update(patch).eq('order_id', orderId);
                    }
                  }
                } catch {}
                
                // Também atualiza orders para garantir consistência
                await supabase
                  .from('orders')
                  .update({ status: status, updated_at: new Date().toISOString() })
                  .eq('id', orderId);
                
                return; // Sucesso, não precisa do kdsService
              }
            }
        }

        await kdsService.setTicketStatus(String(tId), mapToKds(status));
        console.log('[Cozinha] Status atualizado com sucesso:', { orderId, status, kdsStatus: mapToKds(status) });
      } catch (error) {
        console.error('[Cozinha] ERRO ao atualizar status:', error);
      }
    })();

    startTransition(() => {
      setOrders(prevOrders => prevOrders.map(order => {
        if (order.id === orderId) {
          const now = new Date();
          let readyAt = order.readyAt;
          let updatedAt = order.updatedAt;

          if (status === 'PREPARING' && order.status === 'NEW') {
            const updatedItems = order.items.map(item => ({
              ...item,
              productionUnits: item.productionUnits.map(unit => ({
                ...unit,
                unitStatus: unit.unitStatus || 'PENDING',
                completedAt: undefined,
              }))
            }));
            updatedAt = now;
            return { ...order, status, items: updatedItems, updatedAt, readyAt: undefined };
          }

          if (status === 'READY' && order.status === 'PREPARING') {
            readyAt = now;
            const updatedItems = order.items.map(item => ({
              ...item,
              productionUnits: item.productionUnits.map(unit => ({
                ...unit,
                unitStatus: 'READY' as ProductionUnit['unitStatus'],
                completedAt: unit.unitStatus === 'READY' ? unit.completedAt : now,
              }))
            }));
            return { ...order, status, items: updatedItems, updatedAt: order.updatedAt, readyAt };
          }

          if (status === 'DELIVERED' && order.status === 'READY') {
            // Não sobrescreva updatedAt (início do preparo); registre o tempo de entrega em deliveredAt
            return { ...order, status, deliveredAt: now, updatedAt: order.updatedAt, readyAt };
          }

          if (status === 'PREPARING' && order.status === 'READY') {
            readyAt = undefined;
            return { ...order, status, updatedAt: order.updatedAt, readyAt: undefined };
          }
          if (status === 'NEW' && order.status === 'PREPARING') {
            return { ...order, status, updatedAt: undefined, readyAt: undefined };
          }

          return { ...order, status, updatedAt: now, readyAt };
        }
        return order;
      }));
    });
  };

  // NOVO: Atualizar progresso de entrega direta por item (salvar entrega parcial)
  const updateDirectDelivery = (orderId: string, updates: { itemId: string; deliveredCount: number }[]) => {
    setOrders(prevOrders => prevOrders.map(order => {
      if (order.id !== orderId) return order;
      const updatedItems = order.items.map(item => {
        const upd = updates.find(u => u.itemId === item.id);
        if (!upd) return item;
        const totalUnits = Math.max(1, item.quantity * Math.max(1, item.menuItem.unitDeliveryCount || 1));
        const delivered = Math.min(totalUnits, Math.max(0, upd.deliveredCount));
        const prevDelivered = Math.max(0, item.directDeliveredUnitCount || 0);
        const delta = delivered - prevDelivered;
        let deliveredTimes = Array.isArray(item.directDeliveredUnitTimes) ? [...item.directDeliveredUnitTimes] : [];
        const now = new Date();
        if (delta > 0) {
          for (let i = 0; i < delta; i++) {
            deliveredTimes.push(now);
          }
        } else if (delta < 0) {
          deliveredTimes = deliveredTimes.slice(0, Math.max(0, deliveredTimes.length + delta));
        }
        try {
          for (let i = 0; i < delivered; i++) {
            const unitId = `${item.id}-${i + 1}`;
            kdsService.setUnitDelivered(orderId, item.id, unitId, (deliveredTimes[i] ? new Date(deliveredTimes[i]).toISOString() : now.toISOString()));
          }
          for (let i = delivered; i < totalUnits; i++) {
            const unitId = `${item.id}-${i + 1}`;
            kdsService.setUnitDelivered(orderId, item.id, unitId, undefined as any);
          }
        } catch { }
        return { ...item, directDeliveredUnitCount: delivered, directDeliveredUnitTimes: deliveredTimes };
      });
      return { ...order, items: updatedItems };
    }));
  };

  const confirmDelivery = () => {
    if (!orderToDeliver) return;
    startTransition(() => {
      setOrders(prevOrders => prevOrders.map(order => {
        if (order.id === orderToDeliver.id) {
          // Preserve updatedAt como início do preparo; registre entrega em deliveredAt
          return { ...order, status: 'DELIVERED', deliveredAt: new Date(), updatedAt: order.updatedAt };
        }
        return order;
      }));
    });
    showSuccess(`Pedido #${orderToDeliver.pin} marcado como entregue.`);
    try {
      const tId = (orderToDeliver as any)?.ticketId || orderToDeliver.id;
      kdsService.setTicketStatus(String(tId), 'done');
    } catch { }
    setShowDeliveryConfirmation(false);
    setOrderToDeliver(null);
  };

  // NOVO: confirmar entrega diretamente (sem abrir checklist/modal do Caixa)
  const confirmDeliveryImmediate = (orderId: string) => {
    startTransition(() => {
      setOrders(prevOrders => prevOrders.map(order => {
        if (order.id === orderId) {
          return { ...order, status: 'DELIVERED', deliveredAt: new Date(), updatedAt: order.updatedAt };
        }
        return order;
      }));
    });
    const ord = orders.find(o => o.id === orderId);
    showSuccess(`Pedido #${ord?.pin ?? orderId} marcado como entregue.`);
    try {
      const tId = (ord as any)?.ticketId || orderId;
      kdsService.setTicketStatus(String(tId), 'done');
    } catch { }
  };

  const updateProductionUnitStatus = (orderId: string, itemId: string, unitId: string, unitStatus: ProductionUnit['unitStatus'], completedObservations?: string[]) => {
    startTransition(() => {
      setOrders(prevOrders => prevOrders.map(order => {
        if (order.id === orderId) {
          const now = new Date();
          let newOrderStatus = order.status;
          let readyAt = order.readyAt;
          let orderUpdated = false;

          const updatedItems = order.items.map(item => {
            if (item.id === itemId) {
              const updatedUnits = item.productionUnits.map(unit => {
                if (unit.unitId === unitId) {
                  const updatedUnit = { ...unit, unitStatus };
                  if (unitStatus === 'READY') {
                    updatedUnit.completedAt = now;
                  } else {
                    updatedUnit.completedAt = undefined;
                  }
                  if (completedObservations !== undefined) {
                    updatedUnit.completedObservations = completedObservations;
                  }
                  orderUpdated = true;
                  return updatedUnit;
                }
                return unit;
              });
              return { ...item, productionUnits: updatedUnits };
            }
            return item;
          });

          const allUnitsReady = updatedItems.every(item =>
            item.productionUnits.every(unit => unit.unitStatus === 'READY')
          );

          if (order.status === 'NEW' && unitStatus === 'READY') {
            newOrderStatus = 'PREPARING';
            orderUpdated = true;
          }

          if (order.status === 'READY' && unitStatus === 'PENDING' && !allUnitsReady) {
            newOrderStatus = 'PREPARING';
            readyAt = undefined;
            orderUpdated = true;
          }

          let finalUpdatedAt = order.updatedAt;
          if (newOrderStatus === 'PREPARING' && order.status === 'NEW') {
            finalUpdatedAt = now;
          }

          return {
            ...order,
            items: updatedItems,
            status: newOrderStatus,
            updatedAt: order.status === 'NEW' && newOrderStatus === 'PREPARING' ? finalUpdatedAt : order.updatedAt,
            readyAt: readyAt
          };
        }
        return order;
      }));
    });
    try { kdsService.setUnitStatus(orderId, itemId, unitId, unitStatus as any, completedObservations) } catch { }
  };

  const assignOperatorToUnit = (orderId: string, itemId: string, unitId: string, operatorName: string) => {
    startTransition(() => {
      setOrders(prevOrders =>
        prevOrders.map(order => {
          if (order.id === orderId) {
            return {
              ...order,
              items: order.items.map(item => {
                if (item.id === itemId) {
                  return {
                    ...item,
                    productionUnits: item.productionUnits.map(unit =>
                      unit.unitId === unitId ? { ...unit, operatorName } : unit
                    ),
                  };
                }
                return item;
              }),
            };
          }
          return order;
        })
      );
    });
    try { kdsService.setUnitOperator(orderId, itemId, unitId, operatorName) } catch { }
  };

  const handleAssignOperatorToAll = (orderId: string, operatorName: string) => {
    startTransition(() => {
      setOrders(prevOrders =>
        prevOrders.map(order => {
          if (order.id === orderId) {
            return {
              ...order,
              items: order.items.map(item => ({
                ...item,
                productionUnits: item.productionUnits.map(unit => ({ ...unit, operatorName })),
              })),
            };
          }
          return order;
        })
      );
    });
    try {
      const ord = orders.find(o => o.id === orderId)
      for (const it of ord?.items || []) {
        for (const u of it.productionUnits || []) {
          kdsService.setUnitOperator(orderId, it.id, u.unitId, operatorName)
        }
      }
    } catch { }
  };

  const cancelOrder = (orderId: string, reason: string) => {
    startTransition(() => {
      setOrders(orders.map(order =>
        order.id === orderId
          ? { ...order, status: 'CANCELLED', cancelReason: reason, updatedAt: new Date() }
          : order
      ));
    });
  };

  const { isOnline } = useOffline();

  const productionOrders = useMemo(() => {
    return orders.filter(order => ['NEW', 'PREPARING'].includes(order.status));
  }, [orders]);

  // Handler para seleção de cozinha
  const handleKitchenSelect = (kitchenId: string | null, kitchenName: string, operatorName: string) => {
    setSelectedKitchenId(kitchenId);
    setSelectedKitchenName(kitchenName);
    setCurrentOperatorName(operatorName);
    setShowKitchenSelect(false);
  };

  // Modal de seleção de cozinha
  if (showKitchenSelect) {
    return (
      <KitchenSelectModal
        onSelect={handleKitchenSelect}
        onCancel={() => navigate('/module-selector')}
        operators={operators}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col h-full bg-gray-50 overflow-x-hidden">
        {/* Banner de cozinha e operador */}
        <div className="bg-gradient-to-r from-emerald-600 to-green-500 text-white px-4 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <i className="ri-restaurant-2-fill text-xl"></i>
              <span className="font-bold">{selectedKitchenName}</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-emerald-100">
              <i className="ri-user-fill"></i>
              <span>{currentOperatorName || 'Operador'}</span>
            </div>
          </div>
          <button
            onClick={() => setShowKitchenSelect(true)}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors"
          >
            <i className="ri-refresh-line mr-1"></i>
            Trocar
          </button>
        </div>

        {!isOnline && (
          <div className="bg-yellow-500 text-white text-center py-2 text-sm font-medium flex-shrink-0">
            <span className="material-symbols-outlined align-middle mr-2">wifi_off</span>
            Modo Offline - Algumas funcionalidades podem estar limitadas
          </div>
        )}

        <div className="px-4 lg:px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Cozinha - KDS</h1>
            <div className="flex items-center gap-3">
              <p className="text-gray-600 hidden sm:block">Sistema de Display da Cozinha</p>
              <OperationModeBadge compact />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-3">




            <Button
              variant="secondary"
              onClick={() => setShowReadyModal(true)}
              className="bg-green-50 text-green-600 hover:bg-green-100 flex-shrink-0"
              size="sm"
            >
              <span className="material-symbols-outlined mr-2">done</span>
              Prontos ({readyOrdersList.length})
            </Button>

            <Button
              variant="secondary"
              onClick={() => setShowDeliveredModal(true)}
              className="bg-green-50 text-green-600 hover:bg-green-100 flex-shrink-0"
              size="sm"
            >
              <span className="material-symbols-outlined mr-2">done_all</span>
              Entregues ({deliveredOrdersList.length})
            </Button>

            <Button
              variant="secondary"
              onClick={() => setShowCanceledModal(true)}
              className="bg-red-50 text-red-600 hover:bg-red-100 flex-shrink-0"
              size="sm"
            >
              <Icon name="XCircle" className="mr-2" />
              Cancelados ({canceledOrdersList.length})
            </Button>

            <Button onClick={() => setShowOperatorModal(true)} size="sm" className="flex-shrink-0">
              <Icon name="UserPlus" className="mr-2" />
              + Operador
            </Button>
            <Button onClick={() => setShowOperatorViewModal(true)} size="sm" className="flex-shrink-0">
              <Icon name="ListChecks" className="mr-2" />
              Por Operador
            </Button>
          </div>
        </div>

        <div className="pb-6 flex-1 overflow-y-auto min-h-0">
          {true ? (
            <div className="px-4 lg:px-6 h-full">
              <div className="flex flex-col h-full">
                <div className="flex-1 flex flex-col min-h-0">
                  <OrderBoard
                    orders={orders}
                    operators={operators}
                    categories={categories}
                    onUpdateStatus={updateOrderStatus}
                    onCancelOrder={cancelOrder}
                    onAssignOperator={assignOperatorToUnit}
                    onAssignOperatorToAll={handleAssignOperatorToAll}
                    onUpdateItemStatus={updateProductionUnitStatus}
                    onUpdateDirectDelivery={updateDirectDelivery}
                    onConfirmDelivery={confirmDeliveryImmediate}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <OperatorManagementModal
          isOpen={showOperatorModal}
          onClose={() => setShowOperatorModal(false)}
          operators={operators}
          setOperators={setOperators}
        />

        <Modal
          isOpen={showOperatorViewModal}
          onClose={() => setShowOperatorViewModal(false)}
          title="Visão por Operador"
          size="lg"
        >
          <div className="space-y-4">
            {operatorGroups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Nenhuma unidade em produção</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <select className="border rounded px-2 py-1" value={operatorFilter} onChange={(e) => setOperatorFilter(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="Sem Operador">Sem Operador</option>
                    {operators.map(op => (<option key={op.id} value={op.name}>{op.name}</option>))}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={onlyPreparingOperatorView} onChange={(e) => setOnlyPreparingOperatorView(e.target.checked)} />
                    Mostrar apenas em preparo
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(operatorGroups.filter(g => !operatorFilter || g.name === operatorFilter)).map(group => {
                    const total = group.units.length;
                    const visibleUnits = onlyPreparingOperatorView ? group.units.filter(u => u.status !== 'READY') : group.units;
                    const pendentes = visibleUnits.filter(u => u.status === 'PENDING').length;
                    const prontos = visibleUnits.filter(u => u.status === 'READY').length;
                    return (
                      <div key={group.name} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-gray-900">{group.name}</div>
                          <div className="flex items-center space-x-2 text-sm">
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700">Total {total}</span>
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">Pendentes {pendentes}</span>
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700">Prontos {prontos}</span>
                          </div>
                        </div>
                        <div className="divide-y">
                          {visibleUnits.map(u => (
                            <div key={u.unitId} className="py-2 flex items-center justify-between">
                              <div className="text-sm text-gray-800">
                                Pedido #{u.orderPin} • {u.itemName}
                              </div>
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${u.status === 'READY' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                                {u.status === 'READY' ? 'Pronto' : 'Em preparo'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex justify-end pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowOperatorViewModal(false)}>Fechar</Button>
            </div>
          </div>
        </Modal>



        <AlertModal
          isOpen={showAlertModal}
          onClose={() => setShowAlertModal(false)}
          title={alertModalMessage.title}
          message={alertModalMessage.message}
          variant={alertModalMessage.variant}
        />

        {orderToDeliver && (
          <Modal
            isOpen={showDeliveryConfirmation}
            onClose={() => {
              setShowDeliveryConfirmation(false);
              setDeliveryUnitChecks({});
            }}
            title="Confirmar Entrega do Pedido"
            zIndex="z-[1000]"
            size="lg"
          >
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-green-800">
                    Pedido <span className="font-bold">#{orderToDeliver.pin}</span> • Senha <span className="font-bold">{orderToDeliver.password}</span>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Icon name="Check" className="mr-1" />
                    Conferência de Entrega
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {(orderToDeliver.items || []).map(it => (
                  <div key={it.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-800">
                        {it.menuItem?.name || 'Item'}
                      </div>
                      <div className="text-sm text-gray-600">Qtd: {Math.max(1, it.quantity || 1)}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {Array.from({ length: Math.max(1, (it.quantity || 1) * Math.max(1, it.menuItem?.unitDeliveryCount || 1)) }).map((_, idx) => {
                        const key = `${it.id}-${idx}`;
                        const checked = !!deliveryUnitChecks[key];
                        return (
                          <button
                            type="button"
                            key={key}
                            onClick={() => {
                              setDeliveryUnitChecks(prev => ({ ...prev, [key]: !prev[key] }));
                            }}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${checked ? 'bg-green-50 border-green-400 text-green-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                          >
                            <span>Unidade {idx + 1}</span>
                            {checked ? (
                              <Icon name="Check" />
                            ) : (
                              <Icon name="Square" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowDeliveryConfirmation(false);
                    setDeliveryUnitChecks({});
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!orderToDeliver) return;
                    // Registrar entrega parcial por item
                    const updates = (orderToDeliver.items || []).map(it => {
                      const totalUnits = Math.max(1, (it.quantity || 1) * Math.max(1, it.menuItem?.unitDeliveryCount || 1));
                      let deliveredCount = Math.max(0, it.directDeliveredUnitCount || 0);
                      for (let i = 0; i < totalUnits; i++) {
                        const key = `${it.id}-${i}`;
                        if (deliveryUnitChecks[key]) deliveredCount++;
                      }
                      return { itemId: it.id, deliveredCount: Math.min(totalUnits, deliveredCount) };
                    });

                    // Persistir no estado dos pedidos
                    setOrders(prev => prev.map(o => {
                      if (o.id !== orderToDeliver.id) return o;
                      const newItems = o.items.map(it => {
                        const upd = updates.find(u => u.itemId === it.id);
                        if (!upd) return it;
                        return { ...it, directDeliveredUnitCount: upd.deliveredCount };
                      });
                      return { ...o, items: newItems };
                    }));

                    // Se todos completos, marcar como entregue
                    const allItemsCompleted = updates.every(u => {
                      const it = (orderToDeliver.items || []).find(i => i.id === u.itemId)!;
                      const total = Math.max(1, (it.quantity || 1) * Math.max(1, it.menuItem?.unitDeliveryCount || 1));
                      return u.deliveredCount >= total;
                    });
                    if (allItemsCompleted) {
                      confirmDelivery();
                    } else {
                      showSuccess('Entrega parcial registrada. Continue a entrega das unidades restantes quando necessário.');
                      setShowDeliveryConfirmation(false);
                      setOrderToDeliver(null);
                    }
                  }}
                  className="flex-1"
                  disabled={Object.values(deliveryUnitChecks).every(v => !v)}
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </Modal>
        )}

        <Modal
          isOpen={showReadyModal}
          onClose={() => setShowReadyModal(false)}
          title="Pedidos Prontos para Retirada"
          size="full"
        >
          <ReadyOrderTable
            readyOrders={readyOrdersList}
            onUpdateStatus={updateOrderStatus}
            onUpdateDirectDelivery={updateDirectDelivery}
            onConfirmDelivery={confirmDeliveryImmediate}
          />
          <div className="flex justify-end pt-4 border-t mt-4">
            <Button variant="secondary" onClick={() => setShowReadyModal(false)}>
              Fechar
            </Button>
          </div>
        </Modal>

        <Modal
          isOpen={showDeliveredModal}
          onClose={() => setShowDeliveredModal(false)}
          title="Pedidos Entregues"
          size="lg"
        >
          <div className="space-y-4">
            {deliveredOrdersList.length === 0 ? (
              <div className="text-center py-8">
                <i className="ri-check-double-line text-4xl text-gray-400 mb-4"></i>
                <p className="text-gray-500">Nenhum pedido entregue</p>
              </div>
            ) : (
              <DeliveredOrderList deliveredOrders={deliveredOrdersList} />
            )}
            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => setShowDeliveredModal(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showCanceledModal}
          onClose={() => setShowCanceledModal(false)}
          title="Pedidos Cancelados"
          size="lg"
        >
          <div className="space-y-4">
            {canceledOrdersList.length === 0 ? (
              <div className="text-center py-8">
                <i className="ri-close-circle-line text-4xl text-gray-400 mb-4"></i>
                <p className="text-gray-500">Nenhum pedido cancelado</p>
              </div>
            ) : (
              <DeliveredOrderList deliveredOrders={canceledOrdersList} />
            )}
            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => setShowCanceledModal(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}
