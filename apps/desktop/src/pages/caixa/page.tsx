import CategorySidebar from './components/CategorySidebar';
import MenuGrid from './components/MenuGrid';
import Cart from './components/Cart';
import CashOpening from './components/CashOpening';
import CashMovementComponent from './components/CashMovement';
import CashClosing from './components/CashClosing';
import type { CashOpeningData } from './components/CashOpening';
import type { CashMovement as CashMovementType } from './components/CashMovement';
import type { CashClosingData } from './components/CashClosing';
import OrderTrackerModal from './components/OrderTrackerModal';
import Icon from '../../ui/Icon';
import AlertModal from '../../components/base/AlertModal';
import Modal from '../../components/base/Modal';
import ConfirmationModal from '../../components/base/ConfirmationModal';
import MovementConfirmationModal from './components/MovementConfirmationModal';
import CodeListModal from './components/CodeListModal';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { Category, MenuItem, OrderItem, Order, SavedCart, ProductionUnit, OperationalSession } from '../../types';
import * as productsService from '../../offline/services/productsService';
import * as cashService from '../../offline/services/cashService';
import * as ordersService from '../../offline/services/ordersService';
import * as kdsService from '../../offline/services/kdsService';
import * as stationsService from '../../offline/services/stationsService';
import { useOffline } from '../../hooks/useOffline';
import Input from '../../components/base/Input';
import Button from '../../components/base/Button';
import { showReadyAlert, showSuccess, showError, showInfo } from '../../utils/toast';
import OrderListTab from './components/OrderListTab';
import { useAuth } from '../../context/AuthContext'; // Importação corrigida
import { ensureDeviceProfile } from '@/offline/services/deviceProfileService'
import OperationModeBadge from '@/components/OperationModeBadge'
import { getDeviceProfile } from '../../offline/services/deviceProfileService'

type CaixaTab = 'pdv' | 'orders';

// Função para gerar o PIN da sessão (SMMYYXXX)
const generateSessionPin = (counter: number) => {
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear().toString().slice(-2);
  const sequential = counter.toString().padStart(3, '0');
  return `S${month}${year}${sequential}`;
};

// Definindo o tipo para CashSession (que é o CashOpeningData + status/fechamento)
interface CashSessionHistory extends CashOpeningData {
  id: string; // Adicionado ID
  closingTime?: Date;
  finalAmount?: number;
  expectedAmount?: number;
  difference?: number;
  status: 'OPEN' | 'CLOSED';
  justification?: string;
  // NOVO: separar observações da abertura/fechamento
  openingNotes?: string;
  closingNotes?: string;
  initialAmountInputMode?: 'total' | 'breakdown'; // Adicionado
  finalAmountInputMode?: 'total' | 'breakdown'; // Adicionado
}

interface Kitchen {
  id: string;
  name: string;
}

export default function CaixaPage() {
  const { user, store } = useAuth();
  const navigate = useNavigate()
  const [categories, setCategories] = useLocalStorage<Category[]>('categories', []);
  const [menuItemsLS] = useLocalStorage<MenuItem[]>('menuItems', []);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [autoSelectCategory, setAutoSelectCategory] = useState<boolean>(true);
  const [cashPromptSessionId, setCashPromptSessionId] = useLocalStorage<string | null>('cashPromptSessionId', null);
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [quickSearchCode, setQuickSearchCode] = useState('');
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  
  // Filtro de Cozinha
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [selectedKitchenId, setSelectedKitchenId] = useLocalStorage<string | null>('pdv_selected_kitchen_id', null);
  const [categoryIdsByKitchen, setCategoryIdsByKitchen] = useState<Record<string,string[]>>({})
  
  // Seleção de Estação
  const [showStationModal, setShowStationModal] = useState(false);
  const [stations, setStations] = useState<any[]>([]);
  const [currentStationId, setCurrentStationId] = useLocalStorage<string>('currentStationId', '');

  useEffect(() => {
    (async () => {
      try {
        const unitId = await productsService.getCurrentUnitId();
        if (unitId) {
          const list = await stationsService.listStations(unitId);
          setStations(list || []);
        }
      } catch {}
    })()
  }, []);
  
  // Estados de Sessão e Caixa
  const [operationalSession, setOperationalSession] = useLocalStorage<OperationalSession | null>('currentOperationalSession', null);
  const [operationalSessionsHistory, setOperationalSessionsHistory] = useLocalStorage<OperationalSession[]>('operationalSessionsHistory', []);
  const [sessionCounter, setSessionCounter] = useLocalStorage<number>('sessionCounter', 1);
  
  const [showCashOpening, setShowCashOpening] = useState(false);
  const [showCashMovement, setShowCashMovement] = useState(false);
  const [showCashClosing, setShowCashClosing] = useState(false);
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('IN');
  // CORREÇÃO: Usando CashSessionHistory para o estado ativo
  const [cashSession, setCashSession] = useState<CashSessionHistory | null>(null);
  const [cashSessions, setCashSessions] = useState<CashSessionHistory[]>([]);

  // --- Estado para Modal de Opções e Observações em fluxos de busca/lista ---
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [selectedItemForOptions, setSelectedItemForOptions] = useState<MenuItem | null>(null);
  const [selectedRequiredModifiers, setSelectedRequiredModifiers] = useState<Record<string, string>>({});
  const [selectedOptionalObservations, setSelectedOptionalObservations] = useState<string[]>([]);
  const [customObservation, setCustomObservation] = useState('');
  const [globalObservations] = useLocalStorage<string[]>('globalObservations', []);
  const [cashMovements, setCashMovements] = useState<CashMovementType[]>([]);
  // Estado de carregamento da sessão de caixa para evitar falso "fechamento" ao navegar
  const [cashLoaded, setCashLoaded] = useState(false);
  // Helper: mapeia linha do SQLite (snake_case) para CashSessionHistory
  const mapDbSession = (row: any): CashSessionHistory => ({
    id: String(row.id),
    operatorName: String(row.opened_by ?? ''),
    initialAmount: Math.max(0, (row.opening_amount_cents ?? 0) / 100),
    openingTime: row.opened_at ? new Date(row.opened_at) : new Date(),
    notes: '',
    cashBreakdown: {},
    closingTime: row.closed_at ? new Date(row.closed_at) : undefined,
    finalAmount: row.closing_amount_cents != null ? (row.closing_amount_cents / 100) : undefined,
    expectedAmount: undefined,
    difference: undefined,
    status: row.closed_at ? 'CLOSED' : 'OPEN',
    justification: row.closed_by ?? undefined,
    openingNotes: undefined,
    closingNotes: undefined,
    initialAmountInputMode: 'total',
    finalAmountInputMode: 'total',
  })
  // Carregar estado de caixa a partir do banco offline
  useEffect(() => {
    (async () => {
      try {
        const current = await cashService.getCurrentSession();
        const history = await cashService.listSessions();

        // apps/desktop usa consultas SQL com colunas snake_case
        if (current) setCashSession(mapDbSession(current));
        setCashSessions((history || []).map(mapDbSession));

        if (current) {
          const movs = await cashService.listMovementsBySession(current.id);
          const mappedMovs: CashMovementType[] = (movs || []).map((m: any) => ({
            id: String(m.id),
            type: m.type === 'in' ? 'IN' : 'OUT',
            amount: Math.max(0, (m.amount_cents ?? 0) / 100),
            description: String(m.reason ?? ''),
            timestamp: m.created_at ? new Date(m.created_at) : new Date(),
            sessionId: String(m.session_id ?? current.id),
            orderId: undefined,
          }));
          setCashMovements(mappedMovs);
        }
      } catch (error) {
        console.error('Erro ao carregar sessões e movimentos de caixa:', error);
      } finally {
        // Marca como carregado para impedir que a UI indique "Caixa Fechado" antes de consultar o banco
        setCashLoaded(true);
      }
    })();
  }, []);

  // Carregar cozinhas (Electron → DB local; Browser → Supabase)
  useEffect(() => {
    (async () => {
      const api = (window as any)?.api;
      try {
        if (api?.db?.query) {
          const result = await api.db.query('SELECT * FROM kitchens WHERE is_active = 1 ORDER BY display_order, name');
          if (result?.rows) setKitchens(result.rows.map((k: any) => ({ id: k.id, name: k.name })));
          return
        }
        const { supabase } = await import('../../utils/supabase')
        if (!supabase) return
        const { data, error } = await supabase
          .from('kitchens')
          .select('id,name,is_active,display_order')
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .order('name', { ascending: true })
        if (error) { console.error('Supabase kitchens error', error); return }
        setKitchens((data || []).map((k:any)=>({ id:k.id, name:k.name })))
        const { data: assoc } = await supabase
          .from('category_kitchens')
          .select('category_id,kitchen_id')
        const map: Record<string,string[]> = {}
        for (const r of (assoc||[])) {
          const kid = String(r.kitchen_id)
          const cid = String(r.category_id)
          map[kid] = map[kid] || []
          if (!map[kid].includes(cid)) map[kid].push(cid)
        }
        setCategoryIdsByKitchen(map)
      } catch (err) {
        console.error('Erro ao carregar cozinhas:', err);
      }
    })();
  }, []);

  // Inicializar associações padrão: mapear todas categorias para a cozinha "Mexicano" se ainda não houver associações
  useEffect(() => {
    (async () => {
      const api = (window as any)?.api;
      if (api?.db?.query) return;
      try {
        const { supabase } = await import('../../utils/supabase')
        if (!supabase) return
        const { data: anyAssoc } = await supabase.from('category_kitchens').select('id').limit(1)
        if ((anyAssoc||[]).length > 0) {
          console.log('[Caixa] Já existem associações categoria-cozinha, pulando bootstrap')
          return
        }
        const { data: ks } = await supabase.from('kitchens').select('id,name').eq('is_active', true)
        if (!Array.isArray(ks) || ks.length===0) return
        const mexican = ks.find(k=> String(k.name).toLowerCase()==='mexicano') || ks[0]
        const kid = mexican?.id
        if (!kid) return
        const { data: cats } = await supabase.from('categories').select('id')
        if (!Array.isArray(cats) || cats.length===0) return
        const rows = cats.map(c => ({ category_id: c.id, kitchen_id: kid, updated_at: new Date().toISOString() }))
        console.log('[Caixa] Criando associações automáticas para cozinha Mexicano:', { cozinhaId: kid, categorias: cats.length })
        const { error } = await supabase.from('category_kitchens').insert(rows)
        if (error) {
          console.error('[Caixa] Erro ao criar associações:', error)
        } else {
          console.log('[Caixa] Associações criadas com sucesso')
        }
      } catch (err) {
        console.error('[Caixa] Erro no bootstrap de associações:', err)
      }
    })()
  }, [kitchens])
  
  // Acessando orders e savedCarts
  const [orders, setOrders] = useState<Order[]>([]);
  const [, setSavedCarts] = useLocalStorage<SavedCart[]>('savedCarts', []);
  
  // Estados para Modais
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState({ title: '', message: '', variant: 'error' as 'error' | 'info' | 'success' });
  const [showEndSessionConfirmation, setShowEndSessionConfirmation] = useState(false);
  const [showMovementConfirmation, setShowMovementConfirmation] = useState(false);
  const [confirmedMovement, setConfirmedMovement] = useState<CashMovementType | null>(null);
  const [showOrderTrackerModal, setShowOrderTrackerModal] = useState(false);
  const [showCodeListModal, setShowCodeListModal] = useState(false);

  // Checklist de Entrega Direta (intercepta ENTREGUE quando há itens que pulam a cozinha)
  const [showDirectDeliveryChecklist, setShowDirectDeliveryChecklist] = useState(false);
  const [checklistOrder, setChecklistOrder] = useState<Order | null>(null);
  const [checklistUnitChecks, setChecklistUnitChecks] = useState<Record<string, boolean>>({});
  const [lockedUnitKeys, setLockedUnitKeys] = useState<Record<string, boolean>>({});
  const [checklistMode, setChecklistMode] = useState<'all' | 'directOnly'>('all');

  const [activeTab, setActiveTab] = useState<CaixaTab>('pdv');

  const quickSearchRef = useRef<HTMLInputElement>(null);
  const navScopeRef = useRef<HTMLDivElement>(null);
  const previousOrdersRef = useRef<Order[]>([]);

  const { isOnline, addPendingAction } = useOffline();

  const filteredMenuItems = useMemo(() => {
    const activeItems = menuItems.filter(item => item.active)
    if (!selectedCategory) return []
    if (selectedCategory === 'promo-combos') return activeItems.filter(it => it.isPromo)
    let byDb = activeItems.filter(item => item.categoryId === selectedCategory)
    const allowed = selectedKitchenId ? (categoryIdsByKitchen[selectedKitchenId] || []) : null
    if (allowed) {
      byDb = byDb.filter((it)=> allowed.includes(String(it.categoryId)))
    }
    if (byDb.length > 0) return byDb
    const lsItems = (menuItemsLS || []).filter(it => it.active)
    const byLs = lsItems.filter(it => it.categoryId === selectedCategory)
    return byLs
  }, [menuItems, selectedCategory, menuItemsLS, selectedKitchenId, categoryIdsByKitchen])
  useEffect(() => { setSelectedItemIndex(0) }, [selectedCategory])

  // Pedidos da sessão atual (apenas os vinculados à sessão operacional aberta)
  const sessionOrders = useMemo(() => {
    if (!operationalSession || operationalSession.status !== 'OPEN') return [] as Order[];
    return orders.filter(o => (o.operationalSessionId === operationalSession.id) || !o.operationalSessionId);
  }, [orders, operationalSession]);
  
  // Pedidos ativos (NEW, PREPARING, READY) exclusivos da sessão atual
  const activeOrders = useMemo(() => {
    const filtered = sessionOrders.filter(o => ['NEW', 'PREPARING', 'READY'].includes(o.status));
    return filtered;
  }, [sessionOrders]);
  
  // Pedidos prontos da sessão atual
  const readyOrders = useMemo(() => {
    return sessionOrders.filter(o => o.status === 'READY');
  }, [sessionOrders]);
  
  // Pedidos prontos não vistos (Contagem simples)
  const unseenReadyOrdersCount = readyOrders.length;

  

  // --- Lógica de Estado do Caixa ---
  // Se ainda não carregamos do banco, consideramos o caixa como aberto (estado otimista)
  const isCashOpen = useMemo(
    () => (cashLoaded ? (!!cashSession && cashSession.status === 'OPEN') : true),
    [cashSession, cashLoaded],
  );
  const isOperationalSessionOpen = useMemo(() => !!operationalSession && operationalSession.status === 'OPEN', [operationalSession]);

  useEffect(() => {
    // Só sugerir abertura do caixa uma vez por sessão e apenas na aba PDV
    if (
      activeTab === 'pdv' &&
      isOperationalSessionOpen &&
      cashLoaded && // garantir que já verificamos a sessão de caixa
      !isCashOpen &&
      operationalSession?.id &&
      cashPromptSessionId !== operationalSession.id
    ) {
      setShowCashOpening(true);
      setCashPromptSessionId(operationalSession.id);
    }
  }, [activeTab, isCashOpen, isOperationalSessionOpen, operationalSession, cashPromptSessionId, cashLoaded]);

  // Carregar catálogo de categorias e itens do banco offline
  useEffect(() => {
    // Provisionamento: garantir perfil de dispositivo (POS)
    ;(async () => {
      try { await ensureDeviceProfile({ role: 'pos' }) } catch (e) { /* noop */ }
    })()
    let mounted = true;
    (async () => {
      try {
        await productsService.migrateLocalStorageCatalog()
        const [dbCategories, dbProducts] = await Promise.all([
          productsService.listCategories(),
          productsService.listProducts(),
        ]);

        const mappedCategories: Category[] = (dbCategories || []).map((c: any, idx: number) => ({
          id: c.id,
          name: c.name,
          icon: '',
          order: idx,
          active: true,
        }));

        const mappedMenuItems: MenuItem[] = (dbProducts || []).map((p: any) => {
          const fromLs = (menuItemsLS || []).find(mi => mi.id === p.id || (mi.code && mi.code === p.sku))
          return {
            id: p.id,
            name: p.name,
            price: ((p.priceCents ?? p.price_cents ?? 0) as number) / 100,
            sla: typeof fromLs?.sla === 'number' ? fromLs.sla : 15,
            categoryId: (p.categoryId ?? p.category_id) as string,
            observations: Array.isArray(fromLs?.observations) ? fromLs!.observations : [],
            requiredModifierGroups: Array.isArray(fromLs?.requiredModifierGroups) ? fromLs!.requiredModifierGroups : [],
            image: fromLs?.image,
            active: Boolean(p.isActive ?? p.is_active ?? true),
            code: p.sku ?? undefined,
            skipKitchen: Boolean((fromLs as any)?.skipKitchen ?? false),
            unitDeliveryCount: Math.max(1, Number((fromLs as any)?.unitDeliveryCount ?? 1)),
            isPromo: Boolean((fromLs as any)?.isPromo ?? false),
            comboItemIds: Array.isArray((fromLs as any)?.comboItemIds) ? (fromLs as any).comboItemIds : [],
          }
        });

        if (mounted) {
          const baseCategories = (mappedCategories && mappedCategories.length > 0) ? mappedCategories : categories;
          const promoCategory: Category = {
            id: 'promo-combos',
            name: 'Promoções / Combos',
            icon: '',
            order: Math.max(0, baseCategories.length),
            active: true,
            isPromo: true,
          }
          const withoutDupPromo = baseCategories.filter(cat => cat.id !== 'promo-combos')
          const finalCategories = [...withoutDupPromo, promoCategory]
          setCategories(finalCategories);
          // Fallback para itens do armazenamento local quando o banco estiver vazio
          const finalMenuItems = (mappedMenuItems && mappedMenuItems.length > 0) ? mappedMenuItems : menuItemsLS;
          setMenuItems(finalMenuItems);
          const firstActive = finalCategories.filter(cat => cat.active).sort((a, b) => a.order - b.order)[0];
          if (firstActive) setSelectedCategory(firstActive.id);
        }
      } catch (error) {
        console.error('Erro ao carregar catálogo offline:', error);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Selecionar automaticamente a primeira categoria ativa quando categorias forem carregadas
  useEffect(() => {
    if (autoSelectCategory && !selectedCategory && categories && categories.length > 0) {
      const firstActive = categories.filter(cat => (cat.active ?? true)).sort((a, b) => a.order - b.order)[0]
      if (firstActive) setSelectedCategory(firstActive.id)
    }
  }, [categories, selectedCategory, autoSelectCategory])

  useEffect(() => {
    if (!selectedKitchenId) return
    const allowed = categoryIdsByKitchen[selectedKitchenId] || []
    if (!allowed.length) return
    const active = categories.filter(cat => (cat.active ?? true)).sort((a,b)=>a.order-b.order)
    const firstAllowed = active.find(cat => allowed.includes(String(cat.id)))
    if (firstAllowed && selectedCategory && !allowed.includes(String(selectedCategory))) {
      setSelectedCategory(firstAllowed.id)
    }
  }, [selectedKitchenId, categoryIdsByKitchen, categories, selectedCategory])

  // Efeito para monitorar pedidos prontos e disparar notificação
  useEffect(() => {
    const previousOrders = previousOrdersRef.current;
    
    orders.forEach(currentOrder => {
      const previousOrder = previousOrders.find(o => o.id === currentOrder.id);
      
      if (currentOrder.status === 'READY' && previousOrder?.status !== 'READY') {
        showReadyAlert(`Pedido #${currentOrder.pin} (Senha: ${currentOrder.password}) está PRONTO para retirada!`);
      }
    });

    // Atualizar a referência
    previousOrdersRef.current = orders;
  }, [orders]);
  
  // Efeito para atalhos de teclado: Space (foco na busca) e ESC (deselecionar categoria)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!document.hasFocus()) return;
      const ae = document.activeElement as HTMLElement | null
      const isInput = !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');

      if (activeTab !== 'pdv') return

      if (event.key === ' ' && !isInput) {
        event.preventDefault();
        quickSearchRef.current?.focus();
        return
      }
      if (event.key === 'Escape') {
        const anyOpen = showOptionsModal || showCodeListModal || showOrderTrackerModal || showDirectDeliveryChecklist || showCashOpening || showCashMovement || showCashClosing || showAlertModal || showEndSessionConfirmation || showMovementConfirmation
        if (anyOpen) {
          setShowOptionsModal(false)
          setShowCodeListModal(false)
          setShowOrderTrackerModal(false)
          setShowDirectDeliveryChecklist(false)
          setShowCashOpening(false)
          setShowCashMovement(false)
          setShowCashClosing(false)
          setShowAlertModal(false)
          setShowEndSessionConfirmation(false)
          setShowMovementConfirmation(false)
          return
        }
        setAutoSelectCategory(false)
        setSelectedCategory('')
        return
      }
      if (isInput) return

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        const activeCategories = categories.filter(c=> (c.active ?? true)).sort((a,b)=>a.order-b.order)
        const idx = activeCategories.findIndex(c=>c.id===selectedCategory)
        if (idx>0) setSelectedCategory(activeCategories[idx-1].id)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const activeCategories = categories.filter(c=> (c.active ?? true)).sort((a,b)=>a.order-b.order)
        const idx = activeCategories.findIndex(c=>c.id===selectedCategory)
        if (idx>=0 && idx<activeCategories.length-1) setSelectedCategory(activeCategories[idx+1].id)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (filteredMenuItems.length) setSelectedItemIndex(i=> Math.min(filteredMenuItems.length-1, i+1))
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (filteredMenuItems.length) setSelectedItemIndex(i=> Math.max(0, i-1))
        return
      }
      if (event.key === '+' || (event.key === '=' && event.shiftKey) || event.code === 'NumpadAdd') {
        event.preventDefault()
        const item = filteredMenuItems[selectedItemIndex]
        if (item) {
          setSelectedItemForOptions(item)
          setSelectedRequiredModifiers({})
          setSelectedOptionalObservations([])
          setCustomObservation('')
          setShowOptionsModal(true)
        }
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const item = filteredMenuItems[selectedItemIndex]
        if (item) {
          const required = (item.requiredModifierGroups||[]).filter(g=>g.active)
          if (required.length>0) {
            setSelectedItemForOptions(item)
            setSelectedRequiredModifiers({})
            setSelectedOptionalObservations([])
            setCustomObservation('')
            setShowOptionsModal(true)
          } else {
            handleAddToCart(item)
          }
        }
        return
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, categories, selectedCategory, filteredMenuItems, selectedItemIndex]);

  useEffect(() => {
    try { if (activeTab === 'pdv') navScopeRef.current?.focus() } catch {}
  }, [activeTab])

  useEffect(() => {
    let mounted = true;
    const syncStatuses = async () => {
      try {
        const [tkQueued, tkPrep, tkReady, tkDone] = await Promise.all([
          kdsService.listTicketsByStatus('queued'),
          kdsService.listTicketsByStatus('prep'),
          kdsService.listTicketsByStatus('ready'),
          kdsService.listTicketsByStatus('done'),
        ]);
        const mapIds = (arr: any[]) =>
          (Array.isArray(arr) ? arr : [])
            .map((t: any) => t?.order_id ?? t?.orderId)
            .filter(Boolean)
            .map((id: any) => String(id));
        const queuedIds = mapIds(tkQueued)
        const prepIds = mapIds(tkPrep)
        const readyIds = mapIds(tkReady)
        const doneIds = mapIds(tkDone)
        if (!mounted) return;
        setOrders(prev => prev.map(o => {
          const oid = String(o.id)
          if (doneIds.includes(oid)) return { ...o, status: 'DELIVERED', deliveredAt: o.deliveredAt ?? new Date() }
          if (readyIds.includes(oid)) return { ...o, status: 'READY', readyAt: o.readyAt ?? new Date() }
          if (prepIds.includes(oid)) return { ...o, status: 'PREPARING', updatedAt: o.updatedAt ?? new Date() }
          if (queuedIds.includes(oid)) return { ...o, status: 'NEW', updatedAt: undefined, readyAt: undefined }
          return o
        }))
      } catch {}
    };
    syncStatuses();
    const timer = setInterval(syncStatuses, 2000);
    return () => { mounted = false; clearInterval(timer); };
  }, [setOrders])

  // Pull periódico de pedidos do SQLite para refletir mudanças entre janelas
  useEffect(() => {
    let mounted = true;
    const pullOrders = async () => {
      try {
        const detailed = await ordersService.listOrdersDetailed(200);
        if (!mounted) return;
        setOrders(prev => {
          const map: Record<string, Order> = {};
          for (const o of prev) map[String(o.id)] = o;
          for (const d of (detailed || [])) {
            const r: any = d.order;
            const id = String(r.id);
            const existing = map[id];
            const times = (d as any).phaseTimes || {}
            const rawLower = String(r.status || '').toLowerCase()
            const rawUpper = String(r.status || '').toUpperCase()
            const status: Order['status'] = (() => {
              if (rawLower === 'cancelled' || rawUpper === 'CANCELLED') return 'CANCELLED'
              if (r.closed_at || r.completed_at || rawLower === 'closed' || rawUpper === 'DELIVERED') return 'DELIVERED'
              if (times.deliveredAt) return 'DELIVERED'
              if (times.readyAt) return 'READY'
              if (times.preparingStart) return 'PREPARING'
              if (rawUpper === 'READY') return 'READY'
              if (rawUpper === 'PREPARING') return 'PREPARING'
              if (rawLower === 'open' || rawUpper === 'NEW') return existing?.status || 'NEW'
              return existing?.status || 'NEW'
            })()
            const parsedSessionId = r.operational_session_id ? String(r.operational_session_id) : undefined;
            const unitStates = (d as any).unitStates || {}
            const items = (d.items || []).map((it: any) => {
              const qty = Number(it.qty ?? it.quantity ?? 1)
              const itemId = String(it.id)
              const units = Array.from({ length: Math.max(1, qty) }, (_, idx) => {
                const unitId = `${itemId}-${idx+1}`
                const u = unitStates[`${itemId}:${unitId}`] || {}
                return {
                  unitId,
                  unitStatus: u.unitStatus ?? 'PENDING',
                  operatorName: u.operatorName ?? undefined,
                  completedObservations: Array.isArray(u.completedObservations) ? u.completedObservations : [],
                  completedAt: u.completedAt ?? undefined,
                  deliveredAt: u.deliveredAt ?? undefined,
                }
              })
              return {
                id: itemId,
                menuItem: {
                  id: String(it.product_id ?? it.productId ?? String(it.id)),
                  name: String(it.product_name ?? 'Item'),
                  price: Math.max(0, Number(it.unit_price_cents ?? it.unitPriceCents ?? 0) / 100),
                  sla: 0,
                  categoryId: String(it.category_id ?? ''),
                  observations: [],
                  active: true,
                } as any,
                quantity: qty,
                unitPrice: Math.max(0, Number(it.unit_price_cents ?? it.unitPriceCents ?? 0) / 100),
                productionUnits: units,
              }
            }) as any;
            const payments = d.payments || [];
            const paid = (payments || []).reduce((s: number, p: any) => s + Math.max(0, Number(p.amount_cents ?? p.amountCents ?? 0) / 100), 0);
            const breakdown = (payments || []).length > 1 ? Object.fromEntries((payments || []).map((p: any) => [String(p.method).toUpperCase(), Math.max(0, Number(p.amount_cents ?? p.amountCents ?? 0) / 100)])) : undefined;
            const method = (payments || []).length > 1 ? 'MÚLTIPLO' : ((payments || [])[0]?.method ? String((payments || [])[0].method).toUpperCase() : '');
            map[id] = {
              id,
              pin: (d.details?.pin || existing?.pin || id),
              password: (d.details?.password || existing?.password || ''),
              items,
              total: paid > 0 ? paid : Math.max(0, Number(r.total_cents ?? 0) / 100),
              paymentMethod: breakdown ? 'MÚLTIPLO' : (method || 'Não informado'),
              paymentBreakdown: breakdown,
              status,
              createdAt: (r.opened_at || r.created_at) ? new Date(r.opened_at || r.created_at) : (existing?.createdAt || new Date()),
                updatedAt: times.preparingStart ? new Date(times.preparingStart) : (r.updated_at ? new Date(r.updated_at) : (existing?.updatedAt ?? new Date())),
                readyAt: times.readyAt ? new Date(times.readyAt) : existing?.readyAt,
                deliveredAt: (r.closed_at || r.completed_at) ? new Date(r.closed_at || r.completed_at) : (times.deliveredAt ? new Date(times.deliveredAt) : existing?.deliveredAt),
              slaMinutes: existing?.slaMinutes ?? 0,
              createdBy: existing?.createdBy ?? '',
              operationalSessionId: existing?.operationalSessionId ?? parsedSessionId,
            } as any;
          }
          return Object.values(map);
        });
      } catch {}
    };
    pullOrders();
    const timer = setInterval(pullOrders, 3000);
    return () => { mounted = false; clearInterval(timer); };
  }, [setOrders])

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
            const detailed = await ordersService.listOrdersDetailed(200)
            const out: Order[] = []
            for (const d of detailed) {
              const r = d.order as any
              const items = d.items || []
              const payments = d.payments || []
              const pinVal = d.details?.pin
              const passVal = d.details?.password
              const phaseTimes = d.phaseTimes || {}
              const paid = (payments || []).reduce((s: number, p: any) => s + Math.max(0, Number(p.amount_cents ?? p.amountCents ?? 0) / 100), 0)
              const breakdown = (payments || []).length > 1 ? Object.fromEntries((payments || []).map((p: any) => [String(p.method).toUpperCase(), Math.max(0, Number(p.amount_cents ?? p.amountCents ?? 0) / 100)])) : undefined
              const method = (payments || []).length > 1 ? 'MÚLTIPLO' : ((payments || [])[0]?.method ? String((payments || [])[0].method).toUpperCase() : '')
              const ord: Order = {
                id: String(r.id),
                pin: pinVal || '',
                password: passVal || '',
                items: (items || []).map((it: any) => ({
                  id: String(it.id),
                  quantity: Number(it.qty ?? 1),
                  menuItem: {
                    id: String(it.product_id ?? ''),
                    name: String(it.product_name ?? 'Item'),
                    price: Math.max(0, Number(it.unit_price_cents ?? 0) / 100),
                    unitDeliveryCount: 1,
                    categoryId: String(it.category_id ?? ''),
                  },
                  productionUnits: [],
                  skipKitchen: false,
                })),
                total: Math.max(0, Number(r.total_cents ?? 0) / 100),
                customerWhatsApp: undefined,
                paymentMethod: method,
                status: (() => {
                  const rawLower = String(r.status || '').toLowerCase()
                  const rawUpper = String(r.status || '').toUpperCase()
                  if (rawLower === 'cancelled' || rawUpper === 'CANCELLED') return 'CANCELLED'
                  if (r.closed_at || r.completed_at || rawLower === 'closed' || rawUpper === 'DELIVERED') return 'DELIVERED'
                  if (phaseTimes?.deliveredAt) return 'DELIVERED'
                  if (phaseTimes?.readyAt) return 'READY'
                  if (phaseTimes?.preparingStart) return 'PREPARING'
                  if (rawUpper === 'READY') return 'READY'
                  if (rawUpper === 'PREPARING') return 'PREPARING'
                  if (rawLower === 'open' || rawUpper === 'NEW') return 'NEW'
                  return 'NEW'
                })(),
                createdAt: r.opened_at ? new Date(r.opened_at) : new Date(),
                readyAt: phaseTimes?.readyAt ? new Date(phaseTimes.readyAt) : undefined,
                deliveredAt: phaseTimes?.deliveredAt ? new Date(phaseTimes.deliveredAt) : (r.closed_at ? new Date(r.closed_at) : undefined),
                slaMinutes: 30,
                createdBy: 'Sistema',
                amountPaid: paid > 0 ? paid : undefined,
                changeAmount: undefined,
                updatedAt: phaseTimes?.preparingStart ? new Date(phaseTimes.preparingStart) : (r.updated_at ? new Date(r.updated_at) : undefined),
                operationalSessionId: r.operational_session_id ? String(r.operational_session_id) : undefined,
              }
              out.push(ord)
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

  useEffect(() => {
    let mounted = true
    const hubUrl = (() => {
      const envUrl = (import.meta as any)?.env?.VITE_LAN_HUB_URL
      if (envUrl) return envUrl
      const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost'
      return `http://${host}:4000`
    })()
    const secret = (import.meta as any)?.env?.VITE_LAN_SYNC_SECRET || undefined
    ;(async () => {
      try {
        const dp = await getDeviceProfile()
        const unitId = dp?.unitId || 'default'
        const deviceId = dp?.deviceId || crypto.randomUUID()
        if (!secret) return
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
          try { const msg = JSON.parse(String((ev as MessageEvent).data)); if (msg?.type==='events') events = msg.events || [] } catch {}
          try { (async()=>{ await kdsService.applyHubEvents(events) })() } catch {}
          const tickets = events.filter((e:any)=> String(e.table)==='kdsTickets' && (e.row || e.rows))
          if (tickets.length){
            const mapToOrderStatus = (s: string) => {
              const low = String(s || '').toLowerCase()
              if (low === 'done' || low === 'delivered') return 'DELIVERED'
              if (low === 'ready') return 'READY'
              if (low === 'prep' || low === 'preparing') return 'PREPARING'
              return 'NEW'
            }
            const byIdStatus: Record<string,string> = {}
            for (const e of tickets){
              const r = e.row || {}
              const oid = r.order_id ?? r.orderId ?? null
              if (!oid) continue
              const id = String(oid)
              const st = mapToOrderStatus(String(r.status ?? e.status ?? 'queued'))
              byIdStatus[id] = st
            }
            setOrders(prev => prev.map(o => {
              const oid = String(o.id)
              const st = byIdStatus[oid]
              if (!st) return o
              if (st==='DELIVERED') return { ...o, status: 'DELIVERED', deliveredAt: o.deliveredAt ?? new Date() }
              if (st==='READY') return { ...o, status: 'READY', readyAt: o.readyAt ?? new Date() }
              if (st==='PREPARING') return { ...o, status: 'PREPARING', updatedAt: o.updatedAt ?? new Date() }
              if (st==='NEW') return { ...o, status: 'NEW', updatedAt: undefined, readyAt: undefined }
              return o
            }))
          }
          const ordEvents = events.filter((e:any)=> String(e.table)==='orders' && (e.row || e.rows))
          if (ordEvents.length){
            const incoming: Record<string, any> = {}
            for (const e of ordEvents){
              const r = e.row || {}
              const id = String(r.id ?? '')
              if (!id) continue
              incoming[id] = r
            }
            setOrders(prev => {
              const map: Record<string, Order> = {}
              for (const o of prev) map[String(o.id)] = o
              for (const [id, r] of Object.entries(incoming)){
                const existing = map[id]
                if (existing){
                  map[id] = {
                    ...existing,
                    ...r,
                    createdAt: r.createdAt ? new Date(r.createdAt) : existing.createdAt,
                    updatedAt: r.updatedAt ? new Date(r.updatedAt) : (existing.updatedAt ?? new Date()),
                    readyAt: r.readyAt ? new Date(r.readyAt) : existing.readyAt,
                    deliveredAt: r.deliveredAt ? new Date(r.deliveredAt) : existing.deliveredAt,
                  } as any
                } else {
                  map[id] = {
                    ...(r as any),
                    createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
                    updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
                    readyAt: r.readyAt ? new Date(r.readyAt) : undefined,
                    deliveredAt: r.deliveredAt ? new Date(r.deliveredAt) : undefined,
                  }
                }
              }
              return Object.values(map)
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
        // handler unificado com backoff; removido ws2 duplicado
      } catch {}
    })()
    return () => { mounted = false }
  }, [setOrders])

  


  const displayAlert = (title: string, message: string, variant: 'error' | 'info' | 'success' = 'error') => {
    setAlertMessage({ title, message, variant });
    setShowAlertModal(true);
  };

  // --- Lógica de Sessão Operacional (MOVIDA PARA CÁ) ---
  
  const handleStartSession = () => {
    if (!user || !store) {
      displayAlert('Erro', 'Usuário ou loja não identificados.', 'error');
      return;
    }
    
    const newSession: OperationalSession = {
      id: Date.now().toString(),
      pin: generateSessionPin(sessionCounter),
      storeId: store.id,
      storeName: store.name,
      openedByUserId: user.id,
      openedByUserName: user.name,
      openingTime: new Date(),
      status: 'OPEN',
    };
    
    setOperationalSession(newSession);
    setSessionCounter(prev => prev + 1);
    showSuccess(`Sessão operacional ${newSession.pin} iniciada!`);
    setShowCashOpening(true); // Abre o modal de abertura de caixa automaticamente
  };
  
  const handleEndSessionConfirmation = () => {
    if (!operationalSession) return;
    
    // 1. Verificar se o caixa está fechado
    // 2. Verificar pedidos ativos (NEW, PREPARING, READY)
    if (activeOrders.length > 0) {
      displayAlert(
        'Ação Bloqueada', 
        `Ainda existem ${activeOrders.length} pedidos em produção (Novo, Preparando ou Pronto). Marque-os como Entregue ou Cancelado antes de encerrar a sessão.`, 
        'info'
      );
      return;
    }
    
    // 3. Sempre mostrar confirmação de encerramento
    setShowEndSessionConfirmation(true);
  };
  
  const handleEndSession = () => {
    if (!operationalSession) return;
    
    // 1. Encerrar a sessão
    const closedSession: OperationalSession = {
      ...operationalSession,
      closingTime: new Date(),
      status: 'CLOSED',
    };
    
    // 2. Mover a sessão para o histórico e limpar a sessão atual
    setOperationalSessionsHistory(prev => [...prev, closedSession]);
    setOperationalSession(null);
    
    // 3. Limpar pedidos ATIVOS, mantendo os DELIVERED e CANCELLED para relatórios
    setOrders(prevOrders => prevOrders.filter(o => 
      o.status === 'DELIVERED' || o.status === 'CANCELLED'
    ));
    
    // 4. Limpar carrinhos salvos (NOVO)
    setSavedCarts([]);
    
    showSuccess(`Sessão operacional ${closedSession.pin} encerrada com sucesso! Pedidos ativos foram limpos.`);
  };

  // --- Funções de Manipulação do Carrinho ---

  const handleAddToCart = (item: MenuItem, observations?: string, discountPercentage: number = 0) => {
    if (!isCashOpen) {
      displayAlert('Caixa Fechado', 'É necessário abrir o caixa para registrar vendas.', 'info');
      setShowCashOpening(true);
      return;
    }

    // Gerar a unidade de produção inicial
    const initialUnit: ProductionUnit = {
      unitId: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      unitStatus: 'PENDING',
      operatorName: undefined,
      completedObservations: [],
    };

    const existingItemIndex = cartItems.findIndex(
      (cartItem) => cartItem.menuItem.id === item.id && cartItem.observations === observations && Math.round((cartItem.discountPercentage || 0)) === Math.round(discountPercentage || 0)
    );

    if (existingItemIndex > -1) {
      // Se o item já existe com a mesma observação
      const newCartItems = [...cartItems];
      newCartItems[existingItemIndex].quantity += 1;

      // Apenas gera unidade de produção se não for item que pula a cozinha
      const shouldCreateUnit = !item.skipKitchen;
      if (shouldCreateUnit) {
        newCartItems[existingItemIndex].productionUnits.push({
          unitId: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          unitStatus: 'PENDING',
          operatorName: undefined,
          completedObservations: [],
        });
      }
      // Propagar flag direta no OrderItem para facilitar filtros
      newCartItems[existingItemIndex].skipKitchen = !!item.skipKitchen;
      setCartItems(newCartItems);
    } else {
      // Adiciona novo item com quantity: 1 e unidades de produção condicionais
      const effectiveUnitPrice = Math.max(0, item.price * (1 - Math.max(0, Math.min(100, discountPercentage || 0)) / 100))
      const newItem: OrderItem = {
        id: Date.now().toString(),
        menuItem: item,
        quantity: 1,
        unitPrice: effectiveUnitPrice,
        observations,
        productionUnits: item.skipKitchen ? [] : [initialUnit],
        skipKitchen: !!item.skipKitchen,
        discountPercentage: Math.max(0, Math.min(100, discountPercentage || 0)),
      };
      setCartItems([...cartItems, newItem]);
    }
    // REMOVIDO: showSuccess(`${item.name} adicionado ao carrinho.`);
  };

  const handleUpdateItem = (itemId: string, quantity: number) => {
    const itemToUpdate = cartItems.find(item => item.id === itemId);
    if (!itemToUpdate) return;

    if (quantity <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    
    // Ajustar o array de productionUnits (somente para itens que passam pela cozinha)
    const isSkip = !!itemToUpdate.skipKitchen || !!itemToUpdate.menuItem.skipKitchen;
    let newUnits = isSkip ? [] : [...itemToUpdate.productionUnits];
    
    if (!isSkip && quantity > itemToUpdate.quantity) {
      // Adicionar novas unidades (PENDING)
      const unitsToAdd = quantity - itemToUpdate.quantity;
      for (let i = 0; i < unitsToAdd; i++) {
        newUnits.push({
          unitId: Date.now().toString() + i, // Garantir ID único
          unitStatus: 'PENDING',
          operatorName: undefined,
          completedObservations: [],
        });
      }
    } else if (!isSkip && quantity < itemToUpdate.quantity) {
      // Remover as últimas unidades (apenas se estiverem PENDING)
      const unitsToRemove = itemToUpdate.quantity - quantity;
      
      // Filtra as unidades que não estão prontas
      const pendingUnits = newUnits.filter(unit => unit.unitStatus === 'PENDING');
      
      if (pendingUnits.length < unitsToRemove) {
        displayAlert('Ação Bloqueada', 'Não é possível reduzir a quantidade pois algumas unidades já estão em preparo ou prontas.', 'error');
        return;
      }
      
      // Remove as últimas unidades PENDING
      newUnits = newUnits.slice(0, quantity);
    }

    setCartItems(cartItems.map(item => 
      item.id === itemId ? { ...item, quantity, productionUnits: newUnits, skipKitchen: isSkip } : item
    ));
  };

  const handleRemoveItem = (itemId: string) => {
    setCartItems(cartItems.filter(item => item.id !== itemId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleUpdateObservations = (itemId: string, observations: string) => {
    setCartItems(cartItems.map(item => 
      item.id === itemId ? { ...item, observations: observations || undefined } : item
    ));
  };

  const handleLoadCart = (items: OrderItem[]) => {
    // Ao carregar, garantir que productionUnits exista e esteja correto
    const itemsWithUnits = items.map(item => {
      const isSkip = !!item.skipKitchen || !!item.menuItem.skipKitchen;
      if (!item.productionUnits || item.productionUnits.length !== item.quantity) {
        // Recriar unidades apenas para itens que passam pela cozinha
        if (!isSkip) {
          const newUnits: ProductionUnit[] = [];
          for (let i = 0; i < item.quantity; i++) {
            newUnits.push({
              unitId: Date.now().toString() + i, // Garantir ID único
              unitStatus: 'PENDING',
              operatorName: undefined,
              completedObservations: [],
            });
          }
          return { ...item, productionUnits: newUnits, skipKitchen: false };
        }
        // Itens que pulam cozinha não têm unidades de produção
        return { ...item, productionUnits: [], skipKitchen: true };
      }
      // Garantir flag e unidades vazias para itens com entrega direta
      return isSkip ? { ...item, productionUnits: [], skipKitchen: true } : { ...item, skipKitchen: false };
    });
    
    // CORREÇÃO: Atualizar o estado do carrinho
    setCartItems(itemsWithUnits);
    showSuccess('Carrinho carregado com sucesso.');
  };

  // --- Lógica de Busca Rápida ---
  const handleQuickSearch = async (code: string) => {
    try {
      const forceOptions = /\+/g.test(code)
      const pureCode = code.replace(/\+/g, '').trim()
      const rows = await productsService.searchProducts(pureCode);
      const p = (rows || []).find((r: any) => String(r.sku ?? '').toLowerCase() === pureCode.toLowerCase() && !!r.isActive);
      const itemFromService: MenuItem | undefined = p
        ? (() => {
            const base: MenuItem = {
              id: p.id,
              name: p.name,
              price: ((p.priceCents ?? p.price_cents ?? 0) as number) / 100,
              sla: 15,
              categoryId: (p.categoryId ?? p.category_id) as string,
              observations: [],
              requiredModifierGroups: [],
              image: undefined,
              active: Boolean(p.isActive ?? p.is_active ?? true),
              code: p.sku ?? undefined,
            }
            const fromLs = (menuItemsLS || []).find(mi => mi.id === p.id || (mi.code && mi.code === p.sku))
            return fromLs
              ? {
                  ...base,
                  sla: typeof fromLs.sla === 'number' ? fromLs.sla : base.sla,
                  observations: Array.isArray(fromLs.observations) ? fromLs.observations : base.observations,
                  requiredModifierGroups: Array.isArray(fromLs.requiredModifierGroups) ? fromLs.requiredModifierGroups : base.requiredModifierGroups,
                  image: fromLs.image ?? base.image,
                  skipKitchen: Boolean(fromLs.skipKitchen ?? false),
                  unitDeliveryCount: Math.max(1, Number(fromLs.unitDeliveryCount ?? 1)),
                }
              : base
          })()
        : undefined;

      const item = itemFromService ?? menuItems.find(it => it.code?.toLowerCase() === pureCode.toLowerCase() && it.active);

      if (item) {
        const activeRequiredGroups = (item.requiredModifierGroups || []).filter(group => group.active);
        if (forceOptions || activeRequiredGroups.length > 0) {
          setSelectedItemForOptions(item);
          setSelectedRequiredModifiers({});
          setSelectedOptionalObservations([]);
          setCustomObservation('');
          setShowOptionsModal(true);
        } else {
          handleAddToCart(item);
        }
        setQuickSearchCode('');
      } else {
        showError(`Item com código "${pureCode}" não encontrado ou inativo.`);
        setQuickSearchCode('');
      }
    } catch (err) {
      showError('Falha na busca offline por produtos.');
    }
    quickSearchRef.current?.blur();
  };
  
  const handleSelectCode = (code: string) => {
    // Reutiliza a mesma lógica da busca rápida
    handleQuickSearch(code);
    setShowCodeListModal(false);
  };


  // --- Lógica de Reordenação de Categoria ---
  const handleReorderCategory = (categoryId: string, direction: 'up' | 'down') => {
    const activeCategories = categories
      .filter(category => category.active)
      .sort((a, b) => a.order - b.order);

    const index = activeCategories.findIndex(cat => cat.id === categoryId);
    if (index === -1) return;

    const newCategories = [...categories];
    const currentCategory = newCategories.find(cat => cat.id === categoryId)!;
    
    let targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < activeCategories.length) {
      const targetCategory = activeCategories[targetIndex];
      
      // Trocar as ordens
      const tempOrder = currentCategory.order;
      currentCategory.order = targetCategory.order;
      targetCategory.order = tempOrder;
      
      // Atualizar o estado global de categorias
      setCategories(newCategories.map(cat => {
        if (cat.id === currentCategory.id) return currentCategory;
        if (cat.id === targetCategory.id) return targetCategory;
        return cat;
      }));
    }
  };

  // --- Lógica de Sessão de Caixa ---

  const handleOpenCashOpeningWrapper = () => {
    if (!isOperationalSessionOpen) {
      displayAlert('Sessão Fechada', 'É necessário iniciar uma sessão operacional para abrir o caixa.', 'info');
      return;
    }
    setShowCashOpening(true);
  };

  const handleConfirmCashOpening = async (openingData: CashOpeningData, inputMode: 'total' | 'breakdown') => {
    try {
      const id = await cashService.openSession({
        openedBy: openingData.operatorName,
        openingAmountCents: Math.round((openingData.initialAmount ?? 0) * 100),
      });
      // Atualiza imediatamente o estado local para refletir abertura sem esperar SELECT
      setCashSession({
        id,
        operatorName: openingData.operatorName,
        initialAmount: openingData.initialAmount ?? 0,
        openingTime: new Date(),
        notes: openingData.notes ?? '',
        cashBreakdown: openingData.cashBreakdown ?? {},
        status: 'OPEN',
        initialAmountInputMode: inputMode,
        finalAmountInputMode: 'total',
      });
      setShowCashOpening(false);
      setCashMovements([]);
      // Recarregar do banco para garantir consistência
      const current = await cashService.getCurrentSession();
      const history = await cashService.listSessions();
      if (current) setCashSession(mapDbSession(current));
      setCashSessions((history || []).map(mapDbSession));
      showSuccess(`Caixa aberto por ${openingData.operatorName} com R$ ${openingData.initialAmount.toFixed(2)}.`);
    } catch (err) {
      showError('Falha ao abrir caixa no banco offline.');
    }
  };

  const handleOpenCashMovement = (type: 'IN' | 'OUT') => {
    if (!isCashOpen) {
      displayAlert('Caixa Fechado', 'É necessário abrir o caixa para registrar movimentos.', 'info');
      return;
    }
    setMovementType(type);
    setShowCashMovement(true);
  };

  const handleConfirmMovement = async (movement: CashMovementType) => {
    if (!cashSession) {
      displayAlert('Caixa Fechado', 'Abra o caixa para registrar movimentos.', 'info');
      return;
    }
    try {
      await cashService.addMovement({
        sessionId: cashSession.id,
        type: movement.type === 'IN' ? 'in' : 'out',
        reason: movement.description,
        amountCents: Math.round((movement.amount ?? 0) * 100),
      });
      setCashMovements(prev => [...prev, movement]);
      setConfirmedMovement(movement);
      setShowMovementConfirmation(true);
      showSuccess(`${movement.type === 'IN' ? 'Entrada' : 'Retirada'} de R$ ${movement.amount.toFixed(2)} registrada.`);
    } catch (err) {
      showError('Falha ao registrar movimento no banco offline.');
    }
  };

  const handleOpenCashClosing = () => {
    // CORREÇÃO: Verificar se cashSession existe E se está aberto
    if (!cashSession || cashSession.status !== 'OPEN') {
      displayAlert('Caixa Fechado', 'Não há sessão ativa para fechar.', 'info');
      return;
    }
    setShowCashClosing(true);
  };

  const handleConfirmCashClosing = async (closingData: CashClosingData, inputMode: 'total' | 'breakdown') => {
    try {
      await cashService.closeSession(cashSession!.id, {
        closedBy: closingData.operatorName,
        closingAmountCents: Math.round((closingData.finalAmount ?? 0) * 100),
      });
      // Recarregar do banco para refletir fechamento
      const history = await cashService.listSessions();
      setCashSessions((history || []).map(mapDbSession));
      setCashSession(null);
      // Limpar carrinhos salvos após fechar o caixa
      setSavedCarts([]);
      setShowCashClosing(false);
      const diff = closingData.difference ?? 0;
      showSuccess(`Caixa fechado com sucesso. Diferença: R$ ${diff.toFixed(2)}.`);
    } catch (err) {
      showError('Falha ao fechar caixa no banco offline.');
    }
  };
  
  const handleConfirmEndSession = () => {
    setShowEndSessionConfirmation(false);
    if (isCashOpen) {
      // Redireciona para o fechamento de caixa se ainda estiver aberto
      handleOpenCashClosing();
    } else {
      // Encerrar sessão diretamente quando o caixa já estiver fechado
      handleEndSession();
    }
  };

  // --- Lógica de Pedidos ---
  const handleMarkAsDelivered = (orderId: string, mode: 'all' | 'directOnly' = 'all') => {
    // Abrir sempre checklist por item/unidade para confirmação de entrega
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const itemsForChecklist = (order.items || []).filter(it => mode === 'directOnly' ? (it.skipKitchen || it.menuItem?.skipKitchen) : true);
    const initialChecks: Record<string, boolean> = {};
    const initialLocked: Record<string, boolean> = {};
    itemsForChecklist.forEach(it => {
      const totalUnits = Math.max(1, (it.quantity || 1) * Math.max(1, it.menuItem?.unitDeliveryCount || 1));
      const delivered = Math.max(0, it.directDeliveredUnitCount || 0);
      for (let i = 0; i < totalUnits; i++) {
        const key = `${it.id}-${i}`;
        const isDelivered = i < delivered;
        initialChecks[key] = isDelivered ? true : false;
        if (isDelivered) initialLocked[key] = true;
      }
    });
    setChecklistUnitChecks(initialChecks);
    setLockedUnitKeys(initialLocked);
    setChecklistOrder({ ...order, items: itemsForChecklist });
    setChecklistMode(mode);
    setShowDirectDeliveryChecklist(true);
  };
  
  // Estado para o ConfirmationModal genérico
  const [confirmationData, setConfirmationData] = useState<{
    title: string;
    message: string | React.ReactNode;
    onConfirm: () => void;
    variant: 'danger' | 'warning' | 'info' | 'success';
    confirmText?: string;
  } | null>(null);

  // --- Renderização ---
  
  const totalCart = cartItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const totalActiveOrders = activeOrders.length;

  return (
    // O pai (ProtectedRoute) agora define h-screen e overflow-hidden.
    // Este componente deve usar flex-col e flex-1 para preencher o espaço restante.
    <div className="flex flex-col h-full flex-1"> 
      
      {/* HEADER PRINCIPAL (Fixo) */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="px-4 lg:px-6 py-3 flex items-center justify-between">
          
          {/* Lado Esquerdo: Título e Status do Caixa */}
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-900">
              Caixa PDV
            </h1>
            
            {isOperationalSessionOpen ? (
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 rounded-md text-sm font-medium bg-gray-100 text-gray-800">
                  Sessão {operationalSession?.pin}
                </span>
                {isCashOpen ? (
                  <span className="px-3 py-1 rounded-md text-sm font-medium bg-green-100 text-green-800">
                    Caixa aberto por {cashSession?.operatorName}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-md text-sm font-medium bg-red-100 text-red-800">
                    Caixa fechado
                  </span>
                )}
                <div className="flex items-center space-x-2 ml-2">
                  <Button 
                    variant="danger" 
                    size="md"
                    onClick={handleOpenCashClosing}
                    disabled={!isCashOpen}
                    aria-label="Fechar Caixa"
                    title="Fechar Caixa"
                    className="!rounded-full w-9 h-9 flex items-center justify-center"
                  >
                    <i className="ri-lock-line"></i>
                  </Button>
                  <Button 
                    variant="danger" 
                    size="md"
                    onClick={handleEndSessionConfirmation}
                    disabled={!operationalSession}
                    aria-label="Encerrar Sessão"
                    title="Encerrar Sessão"
                    className="!rounded-full w-9 h-9 flex items-center justify-center"
                  >
                    <i className="ri-logout-box-line"></i>
                  </Button>
                  <Button 
                    variant="info" 
                    size="md" 
                    onClick={() => handleOpenCashMovement('IN')}
                    disabled={!isCashOpen}
                    aria-label="Entrada de Dinheiro"
                    title="Entrada de Dinheiro"
                    className="!rounded-full w-9 h-9 flex items-center justify-center"
                  >
                    <i className="ri-add-line"></i>
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="md" 
                    onClick={() => handleOpenCashMovement('OUT')}
                    disabled={!isCashOpen}
                    aria-label="Retirada de Dinheiro"
                    title="Retirada de Dinheiro"
                    className="!rounded-full w-9 h-9 flex items-center justify-center"
                  >
                    <i className="ri-subtract-line"></i>
                  </Button>
                  {isOperationalSessionOpen && !isCashOpen && (
                    <Button 
                      variant="success" 
                      size="md" 
                      onClick={handleOpenCashOpeningWrapper}
                    >
                      Abrir Caixa
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Button 
                  variant="success" 
                  size="md"
                  onClick={handleStartSession}
                >
                  Iniciar Sessão
                </Button>
              </div>
            )}
          </div>

          {/* Lado Direito: Ações e Navegação */}
          <div className="flex items-center space-x-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowStationModal(true)}
              className="hidden md:flex"
            >
              <i className="ri-computer-line mr-2"></i>
              {currentStationId ? (stations.find(s => s.id === currentStationId)?.name || 'Caixa') : 'Selecionar Caixa'}
            </Button>
            <OperationModeBadge />
            {/* Botões movidos para a esquerda; mantém aqui ações gerais */}
            {/* Removido: Iniciar Sessão agora fica ao lado do status à esquerda */}

            {/* Botão de Acompanhamento de Pedidos */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowOrderTrackerModal(true)}
              disabled={totalActiveOrders === 0}
              className={`relative ${unseenReadyOrdersCount > 0 ? 'animate-subtle-pulse bg-blue-100 text-blue-800 hover:bg-blue-200' : ''}`}
            >
              <i className="ri-time-line mr-2"></i>
              Pedidos Ativos ({totalActiveOrders})
              {unseenReadyOrdersCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center ring-2 ring-white">
                  {unseenReadyOrdersCount}
                </span>
              )}
            </Button>

            {/* Removido: Abrir Caixa do lado direito; permanece à esquerda com status */}
            
            {/* Tabs PDV / Pedidos */}
            <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
              <Button
                size="sm"
                variant={activeTab === 'pdv' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('pdv')}
                className="!rounded-md"
              >
                <i className="ri-shopping-cart-line mr-2"></i>
                PDV
              </Button>
              <Button
                size="sm"
                variant={activeTab === 'orders' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('orders')}
                className="!rounded-md"
              >
                <i className="ri-list-check-line mr-2"></i>
                Pedidos
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { navigate('/caixa/configuracoes') }}
              title="Configurações do PDV"
            >
              <i className="ri-settings-3-line mr-2"></i>
              Configurações
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal (3 Colunas no PDV) - Usa flex-1 para preencher a altura restante */}
      <div className="flex-1 flex overflow-hidden" tabIndex={0} ref={navScopeRef}>
        
        {activeTab === 'pdv' && (
          <div className="flex-1 flex flex-row overflow-hidden">
            {/* Sidebar de Categorias */}
            <div className="order-1 xl:order-1 flex-shrink-0">
              <CategorySidebar
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={(id) => { setAutoSelectCategory(true); setSelectedCategory(id); }}
                onReorderCategory={handleReorderCategory}
                kitchens={kitchens}
                selectedKitchenId={selectedKitchenId}
                onKitchenChange={setSelectedKitchenId}
                categoryIdsByKitchen={categoryIdsByKitchen}
              />
            </div>

            {/* Área Central: Busca e Menu Grid */}
            <div className="order-2 flex-1 min-w-0 flex flex-col overflow-hidden">
              {/* Busca Rápida */}
              <div className="h-16 px-4 border-b border-gray-200 flex items-center flex-shrink-0 bg-white">
                <div className="flex items-center space-x-3 w-full">
                  <Input
                    ref={quickSearchRef}
                    type="text"
                    value={quickSearchCode}
                    onChange={(e) => setQuickSearchCode(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleQuickSearch(quickSearchCode);
                      }
                    }}
                    placeholder="Buscar item por código (Ex: XB001) ou use ESPAÇO"
                    className="flex-1"
                  />
                  <Button 
                    onClick={() => handleQuickSearch(quickSearchCode)}
                    disabled={!quickSearchCode.trim()}
                  >
                    <i className="ri-search-line"></i>
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={() => setShowCodeListModal(true)}
                  >
                    <i className="ri-list-check-line mr-2"></i>
                    Lista
                  </Button>
                </div>
              </div>

              {/* Menu Grid com área scrollável que não colapsa em janelas menores */}
              <div className="mt-3 lg:mt-4 flex-1 min-h-0 overflow-y-auto">
                <MenuGrid
                  items={filteredMenuItems}
                  onAddToCart={handleAddToCart}
                  selectedIndex={selectedItemIndex}
                  onSelectIndex={setSelectedItemIndex}
                />
              </div>
            </div>

            {/* Carrinho: permanece à direita em todas as larguras */}
            <div className="order-3 flex-shrink-0">
              <Cart
                items={cartItems}
                onUpdateItem={handleUpdateItem}
                onRemoveItem={handleRemoveItem}
                onClearCart={handleClearCart}
                onUpdateObservations={handleUpdateObservations}
                onLoadCart={handleLoadCart}
                onSaveOrders={setOrders}
                operationalSession={operationalSession}
                onSetCashMovements={setCashMovements}
              />
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="flex-1 overflow-y-auto">
            <OrderListTab
              orders={orders}
              onMarkAsDelivered={handleMarkAsDelivered}
            />
          </div>
        )}
      </div>
      
      {/* Removido: Rodapé de Checkout em telas menores, o Carrinho passa a ser sempre visível */}

      {/* Modals */}
      <CashOpening
        isOpen={showCashOpening && isOperationalSessionOpen} // Só abre se a sessão estiver aberta
        onClose={() => setShowCashOpening(false)}
        onConfirm={handleConfirmCashOpening}
      />

      <CashMovementComponent
        isOpen={showCashMovement}
        onClose={() => setShowCashMovement(false)}
        type={movementType}
        cashSession={cashSession} // PASSANDO O CASH SESSION AQUI
        cashMovements={cashMovements} // PASSANDO MOVIMENTOS PARA VALIDAÇÃO DE SALDO
        onConfirmMovement={handleConfirmMovement}
      />
      
      <CashClosing
        isOpen={showCashClosing}
        onClose={() => setShowCashClosing(false)}
        onConfirm={handleConfirmCashClosing}
        activeCashSession={cashSession}
        cashMovements={cashMovements} // PASSANDO O ARRAY DE MOVIMENTOS
      />

      <MovementConfirmationModal
        isOpen={showMovementConfirmation}
        onClose={() => setShowMovementConfirmation(false)}
        movementData={confirmedMovement}
      />

      <OrderTrackerModal
        isOpen={showOrderTrackerModal}
        onClose={() => setShowOrderTrackerModal(false)}
        activeOrders={activeOrders}
        onMarkAsDelivered={handleMarkAsDelivered}
      />

      {/* Checklist de Entrega por item/unidade */}
      <Modal
        isOpen={showDirectDeliveryChecklist}
        onClose={() => {
          setShowDirectDeliveryChecklist(false);
          setChecklistOrder(null);
          setChecklistUnitChecks({});
        }}
        title="Confirmar Entrega"
        size="lg"
      >
        {checklistOrder && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-purple-800">
                  Pedido <span className="font-bold">#{checklistOrder.pin}</span> • Senha <span className="font-bold">{checklistOrder.password}</span>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  <i className="ri-check-double-line mr-1"></i>
                  Conferência de Entrega
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {(checklistOrder.items || []).map(it => (
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
                      const checked = !!checklistUnitChecks[key];
                      const locked = !!lockedUnitKeys[key];
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => {
                            if (locked) return;
                            setChecklistUnitChecks(prev => ({ ...prev, [key]: !prev[key] }));
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${checked ? 'bg-green-50 border-green-400 text-green-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'} ${locked ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          <span>Unidade {idx + 1}</span>
                          <i className={checked ? 'ri-check-line' : 'ri-checkbox-blank-line'}></i>
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
                  setShowDirectDeliveryChecklist(false);
                  setChecklistOrder(null);
                  setChecklistUnitChecks({});
                  setLockedUnitKeys({});
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!checklistOrder) return;
                  // Persistir no estado dos pedidos com timestamps por unidade
                  setOrders(orders.map(o => {
                    if (o.id !== checklistOrder.id) return o;
                    const newItems = o.items.map(it => {
                      const totalUnits = Math.max(1, (it.quantity || 1) * Math.max(1, it.menuItem?.unitDeliveryCount || 1));
                      const now = new Date();
                      const prevTimesRaw = Array.isArray((it as any).directDeliveredUnitTimes) ? (it as any).directDeliveredUnitTimes : [];
                      // Normaliza para tamanho totalUnits, mantendo índices
                      const prevTimes: (Date | undefined)[] = Array.from({ length: totalUnits }, (_, idx) => {
                        const val = prevTimesRaw[idx];
                        return val ? new Date(val) : undefined;
                      });
                      const newTimes: (Date | undefined)[] = [];
                      for (let i = 0; i < totalUnits; i++) {
                        const key = `${it.id}-${i}`;
                        const wasDelivered = !!prevTimes[i];
                        const isChecked = !!checklistUnitChecks[key];
                        if (isChecked) {
                          // Se não tinha horário, registra agora; senão mantém
                          newTimes[i] = wasDelivered ? prevTimes[i] : now;
                        } else {
                          newTimes[i] = undefined;
                        }
                      }
                      const delivered = newTimes.filter(Boolean).length;
                      return { ...it, directDeliveredUnitCount: delivered, directDeliveredUnitTimes: newTimes } as any;
                    });
                    return { ...o, items: newItems };
                  }));
                  ;(async () => {
                    try {
                      const orderId = checklistOrder.id;
                      for (const it of checklistOrder.items || []) {
                        const totalUnits = Math.max(1, (it.quantity || 1) * Math.max(1, it.menuItem?.unitDeliveryCount || 1));
                        const prevTimesRaw = Array.isArray((it as any).directDeliveredUnitTimes) ? (it as any).directDeliveredUnitTimes : [];
                        const now = new Date();
                        for (let i = 0; i < totalUnits; i++) {
                          const key = `${it.id}-${i}`;
                          const isChecked = !!checklistUnitChecks[key];
                          const deliveredAt = isChecked ? (prevTimesRaw[i] ? new Date(prevTimesRaw[i]).toISOString() : now.toISOString()) : undefined;
                          const unitId = `${it.id}-${i+1}`;
                          await kdsService.setUnitDelivered(orderId, it.id, unitId, deliveredAt as any);
                        }
                      }
                    } catch {}
                  })()
                  ;(async () => {
                    try {
                      const envUrl = (import.meta as any)?.env?.VITE_LAN_HUB_URL
                      const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost'
                      const hubUrl = (envUrl || `http://${host}:4000`).replace(/\/$/, '')
                      const secret = (import.meta as any)?.env?.VITE_LAN_SYNC_SECRET || ''
                      const dp = await getDeviceProfile()
                      const unitId = dp?.unitId || 'default'
                      const headers: Record<string,string> = { 'Content-Type': 'application/json' }
                      if (secret) headers['Authorization'] = `Bearer ${secret}`
                      const builtItems = (checklistOrder.items || []).map(it => {
                        const totalUnits = Math.max(1, (it.quantity || 1) * Math.max(1, it.menuItem?.unitDeliveryCount || 1));
                        const prevTimesRaw = Array.isArray((it as any).directDeliveredUnitTimes) ? (it as any).directDeliveredUnitTimes : [];
                        const prevTimes: (Date | undefined)[] = Array.from({ length: totalUnits }, (_, idx) => {
                          const val = prevTimesRaw[idx];
                          return val ? new Date(val) : undefined;
                        });
                        const now = new Date();
                        const newTimes: (Date | undefined)[] = [];
                        for (let i = 0; i < totalUnits; i++) {
                          const key = `${it.id}-${i}`;
                          const wasDelivered = !!prevTimes[i];
                          const isChecked = !!checklistUnitChecks[key];
                          newTimes[i] = isChecked ? (wasDelivered ? prevTimes[i] : now) : undefined
                        }
                        const delivered = newTimes.filter(Boolean).length;
                        return { ...it, directDeliveredUnitCount: delivered, directDeliveredUnitTimes: newTimes } as any
                      })
                      const row = { ...checklistOrder, items: builtItems }
                      const events = [{ table: 'orders', row, unit_id: unitId }]
                      await fetch(hubUrl + '/push', { method: 'POST', headers, body: JSON.stringify({ events }) })
                    } catch {}
                  })()

                  // Se todos estiverem completos, marcar como entregue
                  const allItemsCompleted = (checklistOrder.items || []).every(it => {
                    const total = Math.max(1, (it.quantity || 1) * Math.max(1, it.menuItem?.unitDeliveryCount || 1));
                    let deliveredCount = 0;
                    for (let i = 0; i < total; i++) {
                      const key = `${it.id}-${i}`;
                      if (checklistUnitChecks[key]) deliveredCount++;
                    }
                    return deliveredCount >= total;
                  });
                  if (checklistMode === 'all') {
                    if (allItemsCompleted) {
                      const now = new Date()
                      setOrders(orders.map(o => o.id === checklistOrder.id ? { ...o, status: 'DELIVERED', deliveredAt: now } : o));
                      ;(async () => {
                        try {
                          const envUrl = (import.meta as any)?.env?.VITE_LAN_HUB_URL
                          const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost'
                          const hubUrl = (envUrl || `http://${host}:4000`).replace(/\/$/, '')
                          const secret = (import.meta as any)?.env?.VITE_LAN_SYNC_SECRET || ''
                          const dp = await getDeviceProfile()
                          const unitId = dp?.unitId || 'default'
                          const headers: Record<string,string> = { 'Content-Type': 'application/json' }
                          if (secret) headers['Authorization'] = `Bearer ${secret}`
                          const row = { ...checklistOrder, status: 'DELIVERED', deliveredAt: now }
                          const events = [{ table: 'orders', row, unit_id: unitId }]
                          await fetch(hubUrl + '/push', { method: 'POST', headers, body: JSON.stringify({ events }) })
                        } catch {}
                      })()
                      showSuccess(`Pedido #${checklistOrder.pin} marcado como entregue.`);
                    } else {
                      showInfo('Entrega parcial registrada. Conclua as unidades restantes depois.');
                    }
                  } else {
                    const originalOrder = orders.find(o => o.id === checklistOrder.id)
                    const hasKitchenItems = !!originalOrder && (originalOrder.items || []).some(it => !(it.skipKitchen || it.menuItem?.skipKitchen))
                    if (!hasKitchenItems && allItemsCompleted) {
                      const now = new Date()
                      setOrders(orders.map(o => o.id === checklistOrder.id ? { ...o, status: 'DELIVERED', deliveredAt: now } : o));
                      ;(async () => {
                        try {
                          const envUrl = (import.meta as any)?.env?.VITE_LAN_HUB_URL
                          const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost'
                          const hubUrl = (envUrl || `http://${host}:4000`).replace(/\/$/, '')
                          const secret = (import.meta as any)?.env?.VITE_LAN_SYNC_SECRET || ''
                          const dp = await getDeviceProfile()
                          const unitId = dp?.unitId || 'default'
                          const headers: Record<string,string> = { 'Content-Type': 'application/json' }
                          if (secret) headers['Authorization'] = `Bearer ${secret}`
                          const row = { ...checklistOrder, status: 'DELIVERED', deliveredAt: now }
                          const events = [{ table: 'orders', row, unit_id: unitId }]
                          await fetch(hubUrl + '/push', { method: 'POST', headers, body: JSON.stringify({ events }) })
                        } catch {}
                      })()
                      showSuccess(`Pedido #${checklistOrder.pin} marcado como entregue.`);
                    } else {
                      showSuccess('Entrega direta registrada. Os itens de cozinha seguem em preparo.');
                    }
                  }
                  setShowDirectDeliveryChecklist(false);
                  setChecklistOrder(null);
                  setChecklistUnitChecks({});
                  setLockedUnitKeys({});
                  setChecklistMode('all');
                }}
                className="flex-1"
                disabled={Object.values(checklistUnitChecks).every(v => !v)}
              >
                Confirmar Entrega
              </Button>
            </div>
          </div>
        )}
      </Modal>
      
      <CodeListModal
        isOpen={showCodeListModal}
        onClose={() => setShowCodeListModal(false)}
        menuItems={menuItems}
        categories={categories}
        onSelectCode={handleSelectCode}
      />

      {/* Modal de Opções e Observações (Fluxo de Busca/Lista) */}
      <Modal
        isOpen={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        title={`Opções e Observações - ${selectedItemForOptions?.name ?? ''}`}
        size="lg"
      >
        <div
          className="space-y-6"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              if (!selectedItemForOptions) return;
              const activeRequiredGroups = (selectedItemForOptions.requiredModifierGroups || []).filter(g => g.active);
              const allRequiredSelected = activeRequiredGroups.every(group => !!selectedRequiredModifiers[group.id]);
              if (activeRequiredGroups.length > 0 && !allRequiredSelected) {
                return; // Não confirma sem completar obrigatórios
              }
              const requiredPrefix = activeRequiredGroups.map(group => {
                const selectedOption = selectedRequiredModifiers[group.id];
                return selectedOption ? `[OBRIGATÓRIO] ${group.name}: ${selectedOption}` : '';
              }).filter(p => p.length > 0).join(', ');
              const optionalText = selectedOptionalObservations.join(', ');
              const customText = customObservation.trim();
              const allParts = [requiredPrefix, optionalText, customText].filter(p => p.length > 0);
              const observationsText = allParts.length > 0 ? allParts.join(', ') : undefined;
              handleAddToCart(selectedItemForOptions, observationsText);
              setShowOptionsModal(false);
              setSelectedItemForOptions(null);
              setSelectedRequiredModifiers({});
              setSelectedOptionalObservations([]);
              setCustomObservation('');
            }
          }}
        >
          {/* Modificadores Obrigatórios */}
          {selectedItemForOptions && (selectedItemForOptions.requiredModifierGroups || []).filter(g => g.active).length > 0 && (
            <div className="p-4 border border-red-300 rounded-lg bg-red-50 space-y-4">
              <h4 className="font-bold text-red-800 flex items-center">
                <i className="ri-alert-line mr-2"></i>
                Opções Obrigatórias (Selecione 1 por grupo): *
              </h4>
              {(selectedItemForOptions.requiredModifierGroups || []).filter(group => group.active).map(group => (
                <div key={group.id} className="border border-red-200 rounded-lg p-3">
                  <h5 className="font-medium text-red-700 mb-2">{group.name}:</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {group.options.map(option => (
                      <button
                        key={option}
                        onClick={() => setSelectedRequiredModifiers(prev => ({ ...prev, [group.id]: prev[group.id] === option ? '' : option }))}
                        className={`p-3 text-sm rounded-lg border-2 transition-colors cursor-pointer whitespace-nowrap ${selectedRequiredModifiers[group.id] === option ? 'bg-red-100 border-red-500 text-red-800 font-medium' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  {!selectedRequiredModifiers[group.id] && (
                    <p className="text-xs text-red-600 mt-2">Seleção obrigatória.</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Observações Opcionais */}
          {selectedItemForOptions && ([...(selectedItemForOptions.observations || []), ...globalObservations].length > 0) && (
            <div className="p-4 border border-amber-300 rounded-lg bg-amber-50">
              <h4 className="font-medium text-amber-800 mb-3">Observações Opcionais:</h4>
              <div className="grid grid-cols-2 gap-2">
                {[...new Set([...(selectedItemForOptions.observations || []), ...globalObservations])].map(observation => (
                  <button
                    key={observation}
                    onClick={() => setSelectedOptionalObservations(prev => prev.includes(observation) ? prev.filter(o => o !== observation) : [...prev, observation])}
                    className={`p-2 text-sm rounded-lg border transition-colors text-left ${selectedOptionalObservations.includes(observation) ? 'bg-amber-100 border-amber-500 text-amber-900' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                  >
                    <i className={`mr-2 ${selectedOptionalObservations.includes(observation) ? 'ri-check-line' : 'ri-add-line'}`}></i>
                    {observation}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Observação Personalizada */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Observação personalizada:</label>
            <Input
              type="text"
              value={customObservation}
              onChange={(e) => setCustomObservation(e.target.value)}
              placeholder="Ex: sem pimenta, sem cebola..."
            />
          </div>

          {/* Ações */}
          <div className="flex items-center space-x-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowOptionsModal(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!selectedItemForOptions) return;
                const activeRequiredGroups = (selectedItemForOptions.requiredModifierGroups || []).filter(g => g.active);
                const allRequiredSelected = activeRequiredGroups.every(group => !!selectedRequiredModifiers[group.id]);
                if (activeRequiredGroups.length > 0 && !allRequiredSelected) {
                  alert('Selecione uma opção para todos os campos obrigatórios.');
                  return;
                }
                const requiredPrefix = activeRequiredGroups.map(group => {
                  const selectedOption = selectedRequiredModifiers[group.id];
                  return selectedOption ? `[OBRIGATÓRIO] ${group.name}: ${selectedOption}` : '';
                }).filter(p => p.length > 0).join(', ');
                const optionalText = selectedOptionalObservations.join(', ');
                const customText = customObservation.trim();
                const allParts = [requiredPrefix, optionalText, customText].filter(p => p.length > 0);
                const observationsText = allParts.length > 0 ? allParts.join(', ') : undefined;
                handleAddToCart(selectedItemForOptions, observationsText);
                setShowOptionsModal(false);
                setSelectedItemForOptions(null);
                setSelectedRequiredModifiers({});
                setSelectedOptionalObservations([]);
                setCustomObservation('');
              }}
              className="flex-1"
              disabled={selectedItemForOptions && (selectedItemForOptions.requiredModifierGroups || []).filter(g => g.active).some(group => !selectedRequiredModifiers[group.id])}
            >
              Adicionar ao Carrinho
            </Button>
          </div>
        </div>
      </Modal>

      <AlertModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        title={alertMessage.title}
        message={alertMessage.message}
        variant={alertMessage.variant}
      />
      
      {/* Confirmação de Fechamento de Caixa (se a sessão operacional estiver sendo encerrada) */}
      <ConfirmationModal
        isOpen={showEndSessionConfirmation}
        onClose={() => setShowEndSessionConfirmation(false)}
        onConfirm={handleConfirmEndSession}
        title="Encerrar Sessão Operacional"
        message={
          isCashOpen ? (
            <>
              O caixa ainda está aberto. Você deve fechá-lo antes de encerrar a sessão operacional.
              <p className="mt-2 text-sm text-gray-600">
                Ao clicar em "Fechar Caixa", você será redirecionado para a tela de fechamento.
              </p>
            </>
          ) : (
            <>
              Tem certeza que deseja encerrar a sessão operacional?
              <p className="mt-2 text-sm text-gray-700">
                Pedidos entregues serão limpos das listas visuais do PDV/Cozinha. Não é possível encerrar a sessão com pedidos ativos.
              </p>
            </>
          )
        }
        variant={isCashOpen ? 'warning' : 'danger'}
        confirmText={isCashOpen ? 'Fechar Caixa' : 'Sim, Encerrar Sessão'}
      />
      
      {/* Confirmação de Entrega (Genérico) - RENDERIZADO NO FINAL PARA Z-INDEX ALTO */}
      {confirmationData && (
        <ConfirmationModal
          isOpen={!!confirmationData}
          onClose={() => setConfirmationData(null)}
          onConfirm={confirmationData.onConfirm}
          title={confirmationData.title}
          message={confirmationData.message}
          variant={confirmationData.variant}
          confirmText={confirmationData.confirmText}
        />
      )}
      {/* Modal de Seleção de Estação */}
      <Modal
        isOpen={showStationModal}
        onClose={() => setShowStationModal(false)}
        title="Selecionar Caixa / Estação"
      >
        <div className="space-y-4">
          <p className="text-gray-600">Selecione qual caixa este dispositivo está operando:</p>
          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
            {stations.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setCurrentStationId(s.id);
                  setShowStationModal(false);
                  window.location.reload();
                }}
                className={`p-3 rounded-lg border text-left flex justify-between items-center ${currentStationId === s.id ? 'bg-amber-50 border-amber-500 text-amber-900' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
              >
                <span className="font-medium">{s.name}</span>
                {currentStationId === s.id && <i className="ri-check-line text-amber-600"></i>}
              </button>
            ))}
            {stations.length === 0 && (
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-500 text-sm">Nenhuma estação cadastrada.</p>
                <p className="text-xs text-gray-400 mt-1">Cadastre 'stations' no banco de dados.</p>
              </div>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="secondary" onClick={() => setShowStationModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
