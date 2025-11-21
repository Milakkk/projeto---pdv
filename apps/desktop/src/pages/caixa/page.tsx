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
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { Category, MenuItem, OrderItem, Order, SavedCart, ProductionUnit, OperationalSession } from '../../types';
import * as productsService from '../../offline/services/productsService';
import * as cashService from '../../offline/services/cashService';
import * as ordersService from '../../offline/services/ordersService';
import { useOffline } from '../../hooks/useOffline';
import Input from '../../components/base/Input';
import Button from '../../components/base/Button';
import { showReadyAlert, showSuccess, showError, showInfo } from '../../utils/toast';
import OrderListTab from './components/OrderListTab';
import { useAuth } from '../../context/AuthContext'; // Importação corrigida
import { ensureDeviceProfile } from '@/offline/services/deviceProfileService'
import OperationModeBadge from '@/components/OperationModeBadge'

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

export default function CaixaPage() {
  const { user, store } = useAuth();
  const [categories, setCategories] = useLocalStorage<Category[]>('categories', []);
  const [menuItemsLS] = useLocalStorage<MenuItem[]>('menuItems', []);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [autoSelectCategory, setAutoSelectCategory] = useState<boolean>(true);
  const [cashPromptSessionId, setCashPromptSessionId] = useLocalStorage<string | null>('cashPromptSessionId', null);
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [quickSearchCode, setQuickSearchCode] = useState('');
  
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
  
  // Acessando orders e savedCarts
  const [orders, setOrders] = useLocalStorage<Order[]>('orders', []);
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
  const previousOrdersRef = useRef<Order[]>(orders);

  const { isOnline, addPendingAction } = useOffline();

  // Pedidos da sessão atual (apenas os vinculados à sessão operacional aberta)
  const sessionOrders = useMemo(() => {
    if (!operationalSession || operationalSession.status !== 'OPEN') return [] as Order[];
    return orders.filter(o => o.operationalSessionId === operationalSession.id);
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
          }
        });

        if (mounted) {
          const finalCategories = (mappedCategories && mappedCategories.length > 0) ? mappedCategories : categories;
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
      const firstActive = categories.filter(cat => cat.active).sort((a, b) => a.order - b.order)[0]
      if (firstActive) setSelectedCategory(firstActive.id)
    }
  }, [categories, selectedCategory, autoSelectCategory])

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
      // Atalhos só funcionam quando a janela do navegador está focada
      if (!document.hasFocus()) return;
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

      if (activeTab === 'pdv') {
        // Foco na busca com Space quando não estiver em um input
        if (event.key === ' ' && !isInput) {
          event.preventDefault();
          quickSearchRef.current?.focus();
        }
        // ESC desmarca a categoria selecionada e limpa a grade
        if (event.key === 'Escape') {
          setAutoSelectCategory(false);
          setSelectedCategory('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  


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

  const handleAddToCart = (item: MenuItem, observations?: string) => {
    if (!isCashOpen) {
      displayAlert('Caixa Fechado', 'É necessário abrir o caixa para registrar vendas.', 'info');
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
      (cartItem) => cartItem.menuItem.id === item.id && cartItem.observations === observations
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
      const newItem: OrderItem = {
        id: Date.now().toString(),
        menuItem: item,
        quantity: 1,
        unitPrice: item.price,
        observations,
        productionUnits: item.skipKitchen ? [] : [initialUnit],
        skipKitchen: !!item.skipKitchen,
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

  // --- Lógica de Filtragem de Itens ---
  const filteredMenuItems = useMemo(() => {
    const activeItems = menuItems.filter(item => item.active)
    if (!selectedCategory) return []
    const byDb = activeItems.filter(item => item.categoryId === selectedCategory)
    if (byDb.length > 0) return byDb
    const lsItems = (menuItemsLS || []).filter(it => it.active)
    const byLs = lsItems.filter(it => it.categoryId === selectedCategory)
    return byLs
  }, [menuItems, selectedCategory, menuItemsLS])

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
  const [offlineActiveOrdersCount, setOfflineActiveOrdersCount] = useState<number>(0);
  useEffect(() => {
    (async () => {
      try {
        const rows = await ordersService.listOrders();
        const openCount = (rows || []).filter((r: any) => r.status === 'open').length;
        setOfflineActiveOrdersCount(openCount);
      } catch (error) {
        console.error('Erro ao carregar pedidos offline:', error);
      }
    })();
  }, []);

  const totalActiveOrders = Math.max(activeOrders.length, offlineActiveOrdersCount);

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
        </div>
      </div>

      {/* Conteúdo Principal (3 Colunas no PDV) - Usa flex-1 para preencher a altura restante */}
      <div className="flex-1 flex overflow-hidden">
        
        {activeTab === 'pdv' && (
          <div className="flex-1 flex flex-row overflow-hidden">
            {/* Sidebar de Categorias */}
            <div className="order-1 xl:order-1 flex-shrink-0">
              <CategorySidebar
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={(id) => { setAutoSelectCategory(true); setSelectedCategory(id); }}
                onReorderCategory={handleReorderCategory}
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
                    autoFocus
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
              orders={sessionOrders}
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
                      setOrders(orders.map(o => o.id === checklistOrder.id ? { ...o, status: 'DELIVERED', deliveredAt: new Date() } : o));
                      showSuccess(`Pedido #${checklistOrder.pin} marcado como entregue.`);
                    } else {
                      showInfo('Entrega parcial registrada. Conclua as unidades restantes depois.');
                    }
                  } else {
                    showSuccess('Entrega direta registrada. Os itens de cozinha seguem em preparo.');
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
    </div>
  );
}
