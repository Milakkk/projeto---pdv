import { useState, useRef, useEffect, useCallback } from 'react';
import type { OrderItem, Order, SavedCart, KitchenOperator, ProductionUnit, OperationalSession, Category, RequiredModifierGroup } from '../../../types';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';
import Modal from '../../../components/base/Modal';
import { useLocalStorage } from '../../../hooks/useLocalStorage';
import { mockPaymentMethods, mockCategories } from '../../../mocks/data'; // Importando mockCategories
import OrderConfirmationModal from './OrderConfirmationModal';
import ConfirmationModal from '../../../components/base/ConfirmationModal'; // Importando o novo modal
import { DEFAULT_PAYMENT_SHORTCUTS, DEFAULT_GLOBAL_OBSERVATIONS } from '../../../utils/constants';
import type { CashMovement as CashMovementType } from './CashMovement';
import { useAuth } from '../../../context/AuthContext'; // IMPORTAÇÃO CORRIGIDA
// Serviços offline: pedidos e caixa
import { createOrder, addItem, addPayment, closeOrder, setOrderDetails } from '../../../offline/services/ordersService'
import { enqueueTicket } from '@/offline/services/kdsService'
import { addMovement, getCurrentSession } from '@/offline/services/cashService'

interface CartProps {
  items: OrderItem[];
  onUpdateItem: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  onUpdateObservations: (itemId: string, observations: string) => void;
  onLoadCart: (items: OrderItem[]) => void;
  onSaveOrders: (updater: (prevOrders: Order[]) => Order[]) => void; // Novo prop para setOrders
  operationalSession: OperationalSession | null; // NOVO PROP: Recebe o objeto completo
  onSetCashMovements: (updater: (prev: CashMovementType[]) => CashMovementType[]) => void; // NOVO PROP
}

// Definindo o tipo mínimo para a sessão de caixa ativa (lido via useLocalStorage no CaixaPage)
interface ActiveCashSession {
  id: string;
  operatorName: string;
  initialAmount: number;
  openingTime: Date;
}

// Função para obter ícone da forma de pagamento
const getPaymentIcon = (method: string): string => {
  switch (method.toLowerCase()) {
    case 'pix':
      return 'ri-qr-code-line';
    case 'dinheiro':
    case 'dinheiro (1)':
    case 'dinheiro (2)':
      return 'ri-money-dollar-circle-line';
    case 'cartão de débito':
    case 'débito':
    case 'debito':
      return 'ri-bank-card-line';
    case 'cartão de crédito':
    case 'crédito':
    case 'credito':
      return 'ri-bank-card-2-line';
    default:
      return 'ri-money-dollar-circle-line';
  }
};

// Função auxiliar para separar opções obrigatórias e observações opcionais
// RECEBE globalObservations como argumento
const parseObservations = (observationsString: string | undefined, item: OrderItem, globalObservations: string[]) => {
    if (!observationsString) {
        return { required: [], optional: [], custom: '' };
    }
    
    const allParts = observationsString.split(', ').map(p => p.trim()).filter(p => p.length > 0);
    
    // Modificadores Obrigatórios: [OBRIGATÓRIO] Nome do Grupo: Opção Selecionada
    const required = allParts
        .filter(p => p.startsWith('[OBRIGATÓRIO]'))
        .map(p => p.replace('[OBRIGATÓRIO]', '').trim());
        
    const optionalAndCustom = allParts.filter(p => !p.startsWith('[OBRIGATÓRIO]'));
    
    // Lista de todas as observações opcionais disponíveis (item + global)
    const availableOptional = [...(item.menuItem.observations || []), ...globalObservations];
    
    // Filtra as observações opcionais que correspondem às opções disponíveis
    const optional = optionalAndCustom.filter(p => availableOptional.includes(p));
    
    // O que sobrar é customizado
    const custom = optionalAndCustom.filter(p => !availableOptional.includes(p)).join(', ');
    
    return { required, optional, custom };
};


export default function Cart({ items, onUpdateItem, onRemoveItem, onClearCart, onUpdateObservations, onLoadCart, onSaveOrders, operationalSession, onSetCashMovements }: CartProps) {
  const { user } = useAuth(); // Adicionado useAuth para obter o usuário logado
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showEditObservations, setShowEditObservations] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showDeleteCartModal, setShowDeleteCartModal] = useState(false); // Novo estado
  const [cartToDelete, setCartToDelete] = useState<SavedCart | null>(null); // Carrinho a ser excluído
  const [confirmedOrderData, setConfirmedOrderData] = useState<OrderConfirmationModalProps['orderData']>(null);
  
  const [cartName, setCartName] = useState('');
  const [savedCarts, setSavedCarts] = useLocalStorage<SavedCart[]>('savedCarts', []);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  
  // Estados para Edição de Observações
  const [selectedRequiredModifiers, setSelectedRequiredModifiers] = useState<Record<string, string>>({}); // NOVO
  const [selectedOptionalObservations, setSelectedOptionalObservations] = useState<string[]>([]); // RENOMEADO
  const [customObservation, setCustomObservation] = useState('');
  
  const [globalObservations] = useLocalStorage<string[]>('globalObservations', DEFAULT_GLOBAL_OBSERVATIONS);
  const [selectedCartToReplace, setSelectedCartToReplace] = useState<string | null>(null);
  const [customerWhatsApp, setCustomerWhatsApp] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('');
  const [orderCounter, setOrderCounter] = useLocalStorage<number>('orderCounter', 1);
  const [orderPassword, setOrderPassword] = useState('');
 // Sessão de caixa ativa via serviço offline (com carregamento otimista)
 const [cashSession, setCashSession] = useState<ActiveCashSession | null>(null);
 const [cashLoaded, setCashLoaded] = useState(false);
 useEffect(() => {
   let cancelled = false;
   (async () => {
     try {
       const session = await getCurrentSession();
       if (!cancelled) {
       if (session) {
         // apps/desktop cashService retorna campos snake_case
         setCashSession({
           id: String(session.id),
           operatorName: String(session.opened_by || 'Operador'),
           openingTime: session.opened_at ? new Date(session.opened_at) : new Date(),
           initialAmount: Math.max(0, (session.opening_amount_cents || 0) / 100),
         });
       } else {
           setCashSession(null);
         }
       }
     } catch (error) {
       console.error('Erro ao obter sessão de caixa atual:', error);
       if (!cancelled) setCashSession(null);
     } finally {
       if (!cancelled) setCashLoaded(true);
     }
   })();
   return () => { cancelled = true; };
 }, []);
  const [config] = useLocalStorage<any>('appConfig', { 
    checkoutShortcut: 'F', 
    passwordFormat: 'numeric' // Valor padrão para evitar erro se a config ainda não foi salva
  }); 
  const [paymentShortcuts] = useLocalStorage<Record<string, string>>('paymentShortcuts', DEFAULT_PAYMENT_SHORTCUTS);
  const [categories] = useLocalStorage<Category[]>('categories', mockCategories); // CORREÇÃO: Usando mockCategories como fallback
  const [kitchenOperators] = useLocalStorage<KitchenOperator[]>('kitchenOperators', []); // Carregar operadores
  
  // CORREÇÃO P3: Carregar formas de pagamento do localStorage
  const [paymentMethods] = useLocalStorage<string[]>('paymentMethods', mockPaymentMethods);


  // Refs para foco
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const amountPaidInputRef = useRef<HTMLInputElement>(null);
  const saveCartInputRef = useRef<HTMLInputElement>(null);

  // Estados para pagamento em dinheiro
  const [amountPaid, setAmountPaid] = useState('');
  const [showChangeCalculation, setShowChangeCalculation] = useState(false);

  // Estados para pagamento múltiplo
  const [paymentBreakdown, setPaymentBreakdown] = useState<{[key: string]: number}>({});
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [isMultiplePayment, setIsMultiplePayment] = useState(false);

  // ESC: fecha modais do carrinho em ordem
  useEffect(() => {
    const handler = () => {
      if (showConfirmationModal) { setShowConfirmationModal(false); return }
      if (showCheckout) { setShowCheckout(false); return }
      if (showEditObservations) { setShowEditObservations(false); return }
      if (showDeleteCartModal) { setShowDeleteCartModal(false); return }
      if (showLoadModal) { setShowLoadModal(false); return }
      if (showSaveModal) { setShowSaveModal(false); return }
    }
    ;(window as any)?.api?.onEscape?.(handler)
    return () => {}
  }, [showConfirmationModal, showCheckout, showEditObservations, showDeleteCartModal, showLoadModal, showSaveModal])

  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const [globalDiscountPercentage, setGlobalDiscountPercentage] = useState<number>(0);
  const total = Math.max(0, subtotal * (1 - Math.max(0, Math.min(100, globalDiscountPercentage)) / 100));
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // Calcular troco
  const paidAmount = parseFloat(amountPaid) || 0;
  const changeAmount = paidAmount - total;

  // Verificar se é pagamento em dinheiro
  const isCashPayment = selectedPayment.toLowerCase().includes('dinheiro');
  const hasCashInBreakdown = Object.keys(paymentBreakdown).some(method => 
    method.toLowerCase().includes('dinheiro')
  );

  // Lógica de restrição de input
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    const format = config.passwordFormat || 'numeric'; // Default para numeric se não estiver configurado

    if (format === 'numeric') {
      value = value.replace(/[^0-9]/g, '');
    } else if (format === 'alphabetic') {
      value = value.replace(/[^a-zA-Z]/g, '');
    }
    // Se for 'alphanumeric', não há restrição

    setOrderPassword(value);
  };
  
  // Calcular valor restante quando breakdown mudar (Memoizado)
  const calculateRemainingAmount = useCallback(() => {
    const totalPaid = Object.values(paymentBreakdown).reduce((sum, amount) => sum + amount, 0);
    return Math.max(0, total - totalPaid);
  }, [paymentBreakdown, total]);


  // Função para verificar se há opções obrigatórias não selecionadas nos itens do carrinho
  const hasItemsWithMissingRequiredOptions = useCallback(() => {
    const dev = (import.meta as any)?.env?.DEV
    if (dev) console.log('=== DEBUG hasItemsWithMissingRequiredOptions ===')
    if (dev) console.log('Total de itens:', items.length)
    
    const result = items.some(item => {
      const requiredGroups = item.menuItem.requiredModifierGroups || [];
      if (dev) console.log(`Item: ${item.menuItem.name}, Grupos obrigatórios:`, requiredGroups.length)
      
      if (requiredGroups.length === 0) return false;
      
      // Parse das observações atuais do item para verificar quais opções obrigatórias estão selecionadas
      const { required: selectedRequiredOptions } = parseObservations(item.observations, item, globalObservations);
      if (dev) console.log(`Observações selecionadas:`, selectedRequiredOptions)
      
      // Verificar se todos os grupos obrigatórios têm uma opção selecionada
      const missingOption = requiredGroups.some(group => {
        // Verificar se alguma opção deste grupo está nas observações selecionadas
        // O formato após o parse é: "Nome do Grupo: Opção Selecionada" (sem [OBRIGATÓRIO])
        const hasSelectedOption = selectedRequiredOptions.some(obs => obs.startsWith(`${group.name}:`));
        if (dev) console.log(`Grupo: ${group.name}, tem opção selecionada: ${hasSelectedOption}`)
        return !hasSelectedOption;
      });
      
      if (dev) console.log(`Item ${item.menuItem.name} está faltando opção:`, missingOption)
      return missingOption;
    });
    
    if (dev) console.log('Resultado final (tem itens faltando opções):', result)
    return result;
  }, [items, globalObservations]);

  // Função auxiliar para determinar se o botão de confirmação deve ser desabilitado
  const isConfirmDisabled = useCallback(() => {
    // 0. Se for pagamento com dinheiro (único ou misto), bloqueia até sessão de caixa carregar/estar aberta
    const isCartCashOpen = cashLoaded ? !!cashSession : true; // otimista até carregar
    if ((isCashPayment || hasCashInBreakdown) && !isCartCashOpen) return true;

    // 1. Senha obrigatória
    if (!orderPassword.trim()) return true;
    
    // 2. Verificar se há itens com opções obrigatórias não selecionadas
    const hasMissingOptions = hasItemsWithMissingRequiredOptions();
    const dev = (import.meta as any)?.env?.DEV
    if (dev) console.log('=== DEBUG isConfirmDisabled ===')
    if (dev) console.log('hasItemsWithMissingRequiredOptions:', hasMissingOptions)
    if (hasMissingOptions) return true;
    
    if (isMultiplePayment) {
      // 3. Pagamento Misto: Deve estar totalmente pago (tolerância de 1 centavo)
      const remaining = calculateRemainingAmount();
      if (remaining > 0.01) return true; 
      
      // 4. Pagamento Misto: Se houver dinheiro, verificar se o valor pago cobre o valor em dinheiro
      if (hasCashInBreakdown) {
        const cashAmount = Object.entries(paymentBreakdown)
          .filter(([method]) => method.toLowerCase().includes('dinheiro'))
          .reduce((sum, [, amount]) => sum + amount, 0);
        
        // O campo amountPaid não pode estar vazio E o valor pago deve ser suficiente (com tolerância)
        if (!amountPaid.trim() || paidAmount < cashAmount - 0.001) {
          return true;
        }
      }
      return false;
    } else {
      // 5. Pagamento Único: Forma de pagamento deve ser selecionada
      if (!selectedPayment) return true;
      
      // 6. Pagamento Único: Se for dinheiro, o valor deve ser suficiente
      if (isCashPayment) {
        // O campo amountPaid não pode estar vazio E o valor pago deve ser suficiente (com tolerância)
        if (!amountPaid.trim() || paidAmount < total - 0.001) {
          return true;
        }
      }
      return false;
    }
  }, [cashLoaded, cashSession, orderPassword, hasItemsWithMissingRequiredOptions, isMultiplePayment, calculateRemainingAmount, hasCashInBreakdown, paymentBreakdown, amountPaid, paidAmount, selectedPayment, isCashPayment, total]);

  // Efeito para focar na senha ao abrir o checkout
  useEffect(() => {
    if (showCheckout) {
      passwordInputRef.current?.focus();
    }
  }, [showCheckout]);

  // Efeito para atalhos de pagamento e checkout
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      const isPasswordInputFocused = activeElement === passwordInputRef.current;
      const shortcutKey = event.key.toUpperCase();
      const checkoutShortcut = config.checkoutShortcut.toUpperCase();

      // Se estiver digitando em um campo de texto, e a tecla for o atalho de checkout, ignorar.
      if (isInput && shortcutKey === checkoutShortcut) {
        return;
      }

      if (showCheckout) {
        // Atalhos de pagamento
        const paymentMethod = Object.keys(paymentShortcuts).find(method => paymentShortcuts[method] === shortcutKey);
        
        // Só aciona atalhos de pagamento se o campo de senha NÃO estiver focado
        if (paymentMethod && !isMultiplePayment && !isPasswordInputFocused) {
          event.preventDefault();
          setSelectedPayment(paymentMethod);
          
          const isCash = paymentMethod.toLowerCase().includes('dinheiro');
          setShowChangeCalculation(isCash);
          
          if (!isCash) {
            setAmountPaid('');
          } else {
            // Focar no campo de valor pago se for dinheiro
            setTimeout(() => amountPaidInputRef.current?.focus(), 0);
          }
        }

        // Atalho de confirmação (configurável)
        if (shortcutKey === checkoutShortcut && !event.shiftKey && !event.ctrlKey) {
          event.preventDefault();
          
          // CORREÇÃO: Usar a função de validação centralizada
          if (!isConfirmDisabled()) {
            handleCheckout();
          }
        }
      }
      
      // Atalho para abrir checkout (configurável)
      if (!showCheckout && items.length > 0 && shortcutKey === checkoutShortcut && !event.shiftKey && !event.ctrlKey) {
        // Só abre se não estiver em um campo de input/textarea
        if (!isInput) {
          event.preventDefault();
          setShowCheckout(true);
        }
      }
    };

    // Dependências simplificadas para evitar re-execuções desnecessárias e bugs de estado
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCheckout, items.length, isMultiplePayment, selectedPayment, orderPassword, config.checkoutShortcut, paymentShortcuts, isConfirmDisabled]); 

  // Função para gerar o número do pedido no formato P + mês + últimos 2 dígitos do ano + sequencial (4 dígitos)
  const generateOrderPin = () => {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString().slice(-2);
    const sequential = orderCounter.toString().padStart(4, '0');
    return `P${month}${year}${sequential}`;
  };

  // Atualizar valor restante quando breakdown mudar
  const updatePaymentBreakdown = (method: string, amount: number) => {
    const newBreakdown = { ...paymentBreakdown };
    
    // Se o valor for 0 ou NaN, mantemos a chave, mas definimos o valor como 0
    if (isNaN(amount) || amount <= 0) {
      newBreakdown[method] = 0;
    } else {
      // Arredondar para 2 casas decimais ao salvar
      newBreakdown[method] = parseFloat(amount.toFixed(2));
    }
    
    setPaymentBreakdown(newBreakdown);
    
    // Recalcular remainingAmount usando a função memoizada
    const totalPaid = Object.values(newBreakdown).reduce((sum, amount) => sum + amount, 0);
    setRemainingAmount(Math.max(0, total - totalPaid));
  };

  // Resetar pagamento múltiplo
  const resetMultiplePayment = () => {
    setPaymentBreakdown({});
    setRemainingAmount(total);
    setIsMultiplePayment(false);
  };

  // Função para adicionar forma de pagamento no pagamento múltiplo
  const addPaymentMethod = (method: string) => {
    // Verificar se já existe essa forma de pagamento
    const existingMethods = Object.keys(paymentBreakdown);
    let methodKey = method;
    
    // Se já existe, adicionar numeração
    if (existingMethods.includes(method)) {
      let counter = 2;
      while (existingMethods.includes(`${method} (${counter})`)) {
        counter++;
      }
      methodKey = `${method} (${counter})`;
    }
    
    // Adicionar com valor inicial igual ao valor restante (limitado ao total)
    const initialValue = Math.min(calculateRemainingAmount(), total);
    updatePaymentBreakdown(methodKey, initialValue);
    
    // Se for dinheiro, focar no campo de valor pago
    if (method.toLowerCase().includes('dinheiro')) {
      setShowChangeCalculation(true);
      setTimeout(() => amountPaidInputRef.current?.focus(), 0);
    }
  };

  // Resetar todos os dados do checkout
  const resetCheckoutData = () => {
    setShowCheckout(false);
    setCustomerWhatsApp('');
    setSelectedPayment('');
    setOrderPassword('');
    setAmountPaid('');
    setShowChangeCalculation(false);
    resetMultiplePayment();
  };

  // Usando useCallback para memoizar a função de checkout e garantir que 'operationalSession' seja capturado
  const handleCheckout = useCallback(async () => {
    let ticketEnqueued = false;
    // Recalcular paidAmount e total aqui para garantir que estamos usando os valores mais recentes
    const currentSubtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const currentTotal = Math.max(0, currentSubtotal * (1 - Math.max(0, Math.min(100, globalDiscountPercentage)) / 100));
    const currentPaidAmount = parseFloat(amountPaid) || 0;

    // Se a validação centralizada falhar, disparamos o alerta específico e retornamos.
    if (isConfirmDisabled()) {
      if (!orderPassword.trim()) {
        alert('Digite a senha do pedido');
        return;
      }
      if (!isMultiplePayment && !selectedPayment) {
        alert('Selecione uma forma de pagamento');
        return;
      }
      if (isMultiplePayment && calculateRemainingAmount() > 0.01) {
        alert(`Ainda falta R$ ${(calculateRemainingAmount()).toFixed(2)} para completar o pagamento`);
        return;
      }
      
      // Validação de dinheiro (único ou misto)
      if ((isCashPayment && !isMultiplePayment) || (isMultiplePayment && hasCashInBreakdown)) {
        let cashRequired = currentTotal;
        if (isMultiplePayment) {
          cashRequired = Object.entries(paymentBreakdown)
            .filter(([method]) => method.toLowerCase().includes('dinheiro'))
            .reduce((sum, [, amount]) => sum + amount, 0);
        }
        
        if (currentPaidAmount < cashRequired - 0.001) { // Usando tolerância
          alert(`Digite o valor pago pelo cliente (deve ser maior ou igual a R$ ${cashRequired.toFixed(2)})`);
          return;
        }
      }
      return; 
    }

    // --- Se a validação passou, prosseguimos com a criação do pedido ---
    setShowCheckout(false);

    const totalSla = items.reduce((sum, item) => sum + (item.menuItem.sla * item.quantity), 0);
    const orderPin = generateOrderPin();
    const now = new Date(); // Captura o tempo de criação

    // Os itens já vêm com productionUnits inicializados do CaixaPage.
    // Não precisamos mais de operatorName ou itemStatus no nível do OrderItem.
    const itemsForOrder = items;

    // Preparar dados de pagamento
    let paymentData: any = {};
    let finalChangeAmount = 0;
    let cashAmountForMovement = 0; // Valor que realmente entra no caixa

    if (isMultiplePayment) {
      paymentData = {
        paymentMethod: 'MÚLTIPLO',
        paymentBreakdown,
        totalPaid: Object.values(paymentBreakdown).reduce((sum, amount) => sum + amount, 0)
      };

      // Se houver dinheiro no breakdown, calcular troco e valor de movimento
      const cashPayments = Object.entries(paymentBreakdown).filter(([method]) => 
        method.toLowerCase().includes('dinheiro')
      );
      
      if (cashPayments.length > 0) {
        const cashAllocated = cashPayments.reduce((sum, [, amount]) => sum + amount, 0);
        finalChangeAmount = currentPaidAmount - cashAllocated;
        
        // O valor que entra no caixa é o valor alocado em dinheiro (cashAllocated)
        // Para fins de apuração, o valor que entra no caixa é o valor alocado para a venda.
        cashAmountForMovement = cashAllocated; 
        
        paymentData.amountPaid = currentPaidAmount;
        paymentData.changeAmount = finalChangeAmount;
      }
    } else {
      finalChangeAmount = isCashPayment ? currentPaidAmount - currentTotal : 0;
      paymentData = {
        paymentMethod: selectedPayment,
        amountPaid: isCashPayment ? currentPaidAmount : undefined,
        changeAmount: finalChangeAmount
      };
      
      // Se for pagamento único em dinheiro, o valor que entra no caixa é o total do pedido
      if (isCashPayment) {
        cashAmountForMovement = currentTotal;
      }
    }

    const onlyDirectDelivery = items.every(item => (item.skipKitchen || item.menuItem?.skipKitchen));
    const newOrder: Order = {
      id: Date.now().toString(),
      pin: orderPin,
      password: orderPassword.trim(),
      items: itemsForOrder, // Usar itens com productionUnits
      total: currentTotal, // Usar o total recalculado
      customerWhatsApp: customerWhatsApp || undefined,
      status: onlyDirectDelivery ? 'READY' : 'NEW',
      createdAt: now, // Usar o tempo de criação
      readyAt: onlyDirectDelivery ? now : undefined,
      slaMinutes: totalSla,
      createdBy: user?.name || 'Caixa', // Usar o nome do usuário logado
      operationalSessionId: operationalSession?.id, // USANDO A PROP operationalSession
      ...paymentData
    };

    onSaveOrders(prevOrders => [...prevOrders, newOrder]);
    setOrderCounter(orderCounter >= 9999 ? 1 : (orderCounter + 1));

    setConfirmedOrderData({
      pin: orderPin,
      password: orderPassword.trim(),
      total: currentTotal,
      changeAmount: finalChangeAmount,
      items,
      paymentMethod: newOrder.paymentMethod,
      createdAt: newOrder.createdAt,
      createdBy: newOrder.createdBy,
      amountPaid: newOrder.amountPaid,
      paymentBreakdown: newOrder.paymentBreakdown,
    });

    setShowCheckout(false);
    onClearCart();
    resetCheckoutData();
    setTimeout(() => setShowConfirmationModal(true), 0);

    // Persistência offline no SQLite via serviços
    let movementPersisted = false;
    let lastTicketId: string | undefined;
    try {
      const orderId = await createOrder({ openedAt: now.toISOString(), operationalSessionId: operationalSession?.id || null, notes: `CREATED_BY=${user?.name || 'Caixa'}` })
      try { await setOrderDetails(orderId, { pin: orderPin, password: orderPassword.trim() }) } catch {}
      // Itens
      for (const it of itemsForOrder) {
        const productId = (it.menuItem as any)?.id ? String((it.menuItem as any).id) : null
        await addItem({
          orderId,
          productId,
          qty: it.quantity,
          unitPriceCents: Math.max(0, Math.round((it.unitPrice ?? 0) * 100)),
          notes: it.observations ?? null,
        })
      }
      // Pagamentos
      if (isMultiplePayment) {
        for (const [method, amount] of Object.entries(paymentBreakdown)) {
          await addPayment({ orderId, method, amountCents: Math.max(0, Math.round(amount * 100)) })
        }
      } else {
        await addPayment({ orderId, method: selectedPayment, amountCents: Math.max(0, Math.round(currentTotal * 100)) })
      }
      // Enfileirar ticket na cozinha somente se houver itens que passam pela cozinha
      if (!onlyDirectDelivery) {
        try { const ticketId = await enqueueTicket({ orderId }); ticketEnqueued = true; lastTicketId = ticketId; try { onSaveOrders(prev => prev.map(o => o.id===newOrder.id ? ({ ...o, ticketId } as any) : o)) } catch {} } catch {}
      } else {
        try { await closeOrder(orderId) } catch {}
      }

      // Movimento de caixa (apenas dinheiro)
      if (cashSession && cashAmountForMovement > 0) {
        await addMovement({
          sessionId: cashSession.id,
          type: 'in',
          reason: `Venda - Pedido ${orderPin}`,
          amountCents: Math.max(0, Math.round(cashAmountForMovement * 100)),
        })
        movementPersisted = true
      }
    } catch (e) {
      // Não quebra a UI: continua com estado otimista
      console.warn('Falha ao persistir no SQLite, mantendo UI otimista:', e)
      
    }

    

    try {
      const unitId = (typeof localStorage !== 'undefined' && localStorage.getItem('unitId')) || 'default'
      const hubUrl = (import.meta as any)?.env?.VITE_LAN_HUB_URL || 'http://localhost:4000'
      const secret = (import.meta as any)?.env?.VITE_LAN_SYNC_SECRET || ''
      if (!secret) return
      const url = hubUrl.replace(/\/$/, '') + '/push'
      const headers: Record<string,string> = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` }
      const events: any[] = [{ table: 'orders', row: { ...newOrder, id: (typeof orderId!=='undefined' ? orderId : newOrder.id) }, unit_id: unitId }]
      if (cashSession && cashAmountForMovement > 0) {
        events.push({
          table: 'cashMovements',
          row: {
            id: String(Date.now()),
            type: 'IN',
            amount: cashAmountForMovement,
            description: `Venda - Pedido ${orderPin} (${newOrder.paymentMethod})`,
            timestamp: new Date().toISOString(),
            orderId: (typeof orderId!=='undefined' ? orderId : newOrder.id),
            sessionId: cashSession.id,
          },
          unit_id: unitId,
        })
      }
      await fetch(url, { method: 'POST', headers, body: JSON.stringify({ events }) })
    } catch {}

    // Registrar movimento de caixa para pagamentos em dinheiro
    if (cashSession && cashAmountForMovement > 0) {
      const cashMovement: CashMovementType = {
        id: Date.now().toString(),
        type: 'IN',
        amount: cashAmountForMovement,
        description: `Venda - Pedido ${orderPin} (${newOrder.paymentMethod})`,
        timestamp: new Date(),
        orderId: newOrder.id,
        sessionId: cashSession.id
      };
      onSetCashMovements(prev => [...prev, cashMovement]);
      // Tentativa extra de persistência do movimento caso o bloco anterior tenha falhado
      if (!movementPersisted) {
        try {
          await addMovement({
            sessionId: cashSession.id,
            type: 'in',
            reason: cashMovement.description,
            amountCents: Math.max(0, Math.round(cashAmountForMovement * 100)),
          })
        } catch (err) {
          console.warn('Falha ao registrar movimento de caixa (extra):', err)
        }
      }
    }

    try {
      const hasKitchenItems = items.some(it => !(it.skipKitchen || it.menuItem?.skipKitchen))
      if (hasKitchenItems && !ticketEnqueued) { enqueueTicket({ orderId: newOrder.id }).catch(()=>{}) }
      else if (!hasKitchenItems) { closeOrder(newOrder.id).catch(()=>{}) }
    } catch {}

    // Simular som de novo pedido
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8diJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
    audio.play().catch(() => {});
  }, [items, isConfirmDisabled, orderPassword, isMultiplePayment, calculateRemainingAmount, isCashPayment, hasCashInBreakdown, paymentBreakdown, amountPaid, total, generateOrderPin, onSaveOrders, setOrderCounter, cashSession, onSetCashMovements, customerWhatsApp, selectedPayment, operationalSession, user]); // Adicionando user como dependência

  // Função para lidar com ENTER no campo de senha
  const handlePasswordKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Tira o foco do campo de senha
      passwordInputRef.current?.blur();
      
      // Se for pagamento em dinheiro, foca no campo de valor pago
      if (isCashPayment || hasCashInBreakdown) {
        amountPaidInputRef.current?.focus();
      }
    }
  };

  // Função para lidar com ENTER no campo de valor pago
  const handleAmountPaidKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Tira o foco do campo de valor pago
      amountPaidInputRef.current?.blur();
    }
  };
  
  // NOVO: Função para lidar com a mudança de valor pago
  const handleAmountPaidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Apenas atualiza o estado com o valor, permitindo que seja vazio
    setAmountPaid(value);
    
    // Mantemos showChangeCalculation como true se o pagamento em dinheiro estiver ativo
    if (isCashPayment || hasCashInBreakdown) {
      setShowChangeCalculation(true);
    }
  };

  // Função para lidar com ENTER no modal de salvar carrinho
  const handleSaveCartKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveCart();
    }
  };

  const openEditObservations = (item: OrderItem) => {
    setEditingItem(item);
    
    // 1. Parse existing observations back to selected and custom
    const { required, optional, custom } = parseObservations(item.observations, item, globalObservations);
    
    // 2. Mapear as opções obrigatórias de volta para o formato Record<groupId, selectedOption>
    const initialModifiers: Record<string, string> = {};
    const requiredGroups = item.menuItem.requiredModifierGroups || [];
    
    required.forEach(modString => {
        // Esperamos o formato: "Nome do Grupo: Opção Selecionada"
        const parts = modString.split(':').map(p => p.trim());
        if (parts.length === 2) {
            const groupName = parts[0];
            const selectedOption = parts[1];
            
            const group = requiredGroups.find(g => g.name === groupName);
            if (group) {
                initialModifiers[group.id] = selectedOption;
            }
        }
    });
    
    // 3. Inicializar estados com os valores salvos
    setSelectedRequiredModifiers(initialModifiers);
    setSelectedOptionalObservations(optional); 
    setCustomObservation(custom);
    setShowEditObservations(true);
  };

  const getAllAvailableObservations = (item: OrderItem) => {
    const itemObservations = item.menuItem.observations || [];
    return [...new Set([...globalObservations, ...itemObservations])];
  };
  
  const getAllAvailableRequiredGroups = (item: OrderItem) => {
    return item.menuItem.requiredModifierGroups || [];
  };

  const toggleRequiredModifier = (groupId: string, option: string) => {
    setSelectedRequiredModifiers(prev => ({
      ...prev,
      [groupId]: prev[groupId] === option ? '' : option // Seleção única
    }));
  };
  
  const toggleOptionalObservation = (observation: string) => {
    setSelectedOptionalObservations(prev =>
      prev.includes(observation)
        ? prev.filter(obs => obs !== observation)
        : [...prev, observation]
    );
  };

  const handleSaveObservations = () => {
    if (editingItem) {
      
      const requiredGroups = getAllAvailableRequiredGroups(editingItem);
      
      // Validação: Todos os grupos obrigatórios devem ter uma opção selecionada
      const allRequiredSelected = requiredGroups.every(group => !!selectedRequiredModifiers[group.id]);
      
      if (requiredGroups.length > 0 && !allRequiredSelected) {
          alert('Selecione uma opção para todos os campos obrigatórios.');
          return;
      }
      
      // 1. Concatena Modificadores Obrigatórios (prefixados com [OBRIGATÓRIO] e o nome do grupo)
      const requiredPrefix = requiredGroups.map(group => {
          const selectedOption = selectedRequiredModifiers[group.id];
          return selectedOption ? `[OBRIGATÓRIO] ${group.name}: ${selectedOption}` : '';
      }).filter(p => p.length > 0).join(', ');
          
      // 2. Concatena Observações Opcionais
      const optionalText = selectedOptionalObservations.join(', ');
      
      // 3. Concatena Observação Personalizada
      const customText = customObservation.trim();

      // 4. Combina tudo, separando por vírgula e espaço
      const allParts = [requiredPrefix, optionalText, customText].filter(p => p.length > 0);
      const observationsText = allParts.length > 0 ? allParts.join(', ') : '';

      onUpdateObservations(editingItem.id, observationsText);
      setShowEditObservations(false);
      setEditingItem(null);
      setSelectedRequiredModifiers({});
      setSelectedOptionalObservations([]);
      setCustomObservation('');
    }
  };

  const loadCart = (savedCart: SavedCart) => {
    // Ao carregar, garantir que productionUnits exista e esteja correto
    const itemsWithUnits = savedCart.items.map(item => {
      // Itens de entrega direta não geram unidades de produção
      if (item.skipKitchen) {
        return { ...item, productionUnits: [] };
      }
      // Para itens que passam pela cozinha, recriar unidades pendentes se houver divergência
      if (!item.productionUnits || item.productionUnits.length !== item.quantity) {
        const newUnits: ProductionUnit[] = [];
        for (let i = 0; i < item.quantity; i++) {
          newUnits.push({
            unitId: Date.now().toString() + i,
            unitStatus: 'PENDING',
            operatorName: undefined,
            completedObservations: [],
          });
        }
        return { ...item, productionUnits: newUnits };
      }
      return item;
    });
    
    // CORREÇÃO: Atualizar o estado do carrinho
    // Nota: O Cart.tsx não tem acesso direto ao setCartItems, ele deve chamar o prop onLoadCart
    onLoadCart(itemsWithUnits);
    showSuccess('Carrinho carregado com sucesso.');
  };

  const openDeleteCartConfirmation = (cart: SavedCart) => {
    setCartToDelete(cart);
    setShowDeleteCartModal(true);
  };

  const deleteSavedCart = () => {
    if (cartToDelete) {
      setSavedCarts(prev => prev.filter(cart => cart.id !== cartToDelete.id));
      setShowDeleteCartModal(false);
      setCartToDelete(null);
    }
  };

  const handleSaveCart = () => {
    if (!cartName.trim()) {
      alert('Digite um nome para o carrinho');
      return;
    }

    // Verificar se já existe um carrinho com este nome
    const existingCart = savedCarts.find(cart => cart.name.toLowerCase() === cartName.toLowerCase());
    
    if (existingCart && !selectedCartToReplace) {
      if (confirm(`Já existe um carrinho com o nome "${cartName}". Deseja substituí-lo?`)) {
        setSelectedCartToReplace(existingCart.id);
        return;
      } else {
        return;
      }
    }

    const newSavedCart: SavedCart = {
      id: selectedCartToReplace || Date.now().toString(),
      name: cartName,
      items,
      total,
      createdAt: new Date()
    };

    if (selectedCartToReplace) {
      // Substituir carrinho existente
      setSavedCarts(prev => prev.map(cart => 
        cart.id === selectedCartToReplace ? newSavedCart : cart
      ));
      // Não mostrar alerta de confirmação
    } else {
      // Criar novo carrinho
      setSavedCarts([...savedCarts, newSavedCart]);
      // Não mostrar alerta de confirmação
    }

    setShowSaveModal(false);
    setCartName('');
    setSelectedCartToReplace(null);
  };

  const selectCartToReplace = (cart: SavedCart) => {
    setCartName(cart.name);
    setSelectedCartToReplace(cart.id);
  };

  const resetSaveModal = () => {
    setShowSaveModal(false);
    setCartName('');
    setSelectedCartToReplace(null);
  };

  const getCategoryName = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return '';
    // CORREÇÃO: A categoria deve ser buscada pelo categoryId do MenuItem
    const category = categories.find(c => c.id === item.menuItem.categoryId);
    return category ? category.name : 'Sem Categoria';
  };

  return (
    <div className="flex w-64 xl:w-80 bg-white border-l border-gray-200 flex-col xl:h-[calc(100vh-120px)] xl:max-h-[calc(100vh-120px)]">
      
      {/* Cabeçalho do Carrinho - altura uniforme e ações alinhadas */}
      <div className="h-16 px-4 border-b border-gray-200 flex items-center flex-shrink-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2">
            <h2 className="text-base lg:text-lg font-semibold text-gray-900">Carrinho</h2>
            <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-1 rounded-full">
              {totalItems} {totalItems === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowSaveModal(true)}
              className="text-green-500 hover:text-green-700 cursor-pointer p-2"
              title="Salvar carrinho"
              disabled={items.length === 0}
            >
              <i className="ri-save-line text-lg"></i>
            </button>
            <button
              onClick={() => setShowLoadModal(true)}
              className="text-blue-500 hover:text-blue-700 cursor-pointer p-2"
              title="Carregar carrinho salvo"
              disabled={savedCarts.length === 0}
            >
              <i className="ri-download-line text-lg"></i>
            </button>
            <button
              onClick={onClearCart}
              className="text-red-500 hover:text-red-700 cursor-pointer p-2"
              title="Limpar carrinho"
              disabled={items.length === 0}
            >
              <i className="ri-delete-bin-line text-lg"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Lista de itens do carrinho - área com scroll limitado */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4 min-h-[200px]">
            <i className="ri-shopping-cart-line text-3xl lg:text-4xl mb-2"></i>
            <p className="text-sm lg:text-base">Carrinho vazio</p>
          </div>
        ) : (
          <div className="p-3 lg:p-4 space-y-3">
            {items.map((item) => {
              const { required } = parseObservations(item.observations, item, globalObservations);
              
              // Verificar se este item tem opções obrigatórias não selecionadas
              const hasMissingRequiredOptions = (() => {
                const requiredGroups = item.menuItem.requiredModifierGroups || [];
                if (requiredGroups.length === 0) return false;
                
                return requiredGroups.some(group => {
                  // O formato após o parse é: "Nome do Grupo: Opção Selecionada" (sem [OBRIGATÓRIO])
                  const hasSelectedOption = required.some(obs => obs.startsWith(`${group.name}:`));
                  return !hasSelectedOption;
                });
              })();
              
              return (
                <div key={item.id} className={`rounded-lg p-3 ${hasMissingRequiredOptions ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 font-medium mb-1">
                        {getCategoryName(item.id)}
                      </p>
                      <div className="flex items-center">
              <h4 className="font-medium text-gray-900 text-sm truncate flex items-center">
                {item.menuItem.name}
                {item.menuItem.code && (
                  <span className="ml-2 text-blue-600 text-xs font-semibold">#{item.menuItem.code}</span>
                )}
              </h4>
                        {hasMissingRequiredOptions && (
                          <i className="ri-error-warning-line text-amber-600 ml-2" title="Opções obrigatórias não selecionadas"></i>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">R$ {item.unitPrice.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-red-500 hover:text-red-700 cursor-pointer p-1 ml-2"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onUpdateItem(item.id, item.quantity - 1)}
                        className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center cursor-pointer"
                      >
                        <i className="ri-subtract-line text-xs"></i>
                      </button>
                      <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateItem(item.id, item.quantity + 1)}
                        className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center cursor-pointer"
                      >
                        <i className="ri-add-line text-xs"></i>
                      </button>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openEditObservations(item)}
                        className="text-amber-600 hover:text-amber-700 cursor-pointer p-1"
                        title="Editar observações"
                      >
                        <i className="ri-edit-line text-sm"></i>
                      </button>
                      <span className="text-sm font-medium">
                        R$ {(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  {item.observations && (
                    <div className="mt-2 text-xs text-gray-600 bg-white rounded p-2">
                      {required.length > 0 && (
                        <div className="text-red-600 font-medium mb-1">
                          <i className="ri-checkbox-circle-line mr-1"></i>
                          Opções: {required.join(', ')}
                        </div>
                      )}
                      {/* Exibe observações apenas se existir conteúdo */}
                      {(parseObservations(item.observations, item, globalObservations).optional.length > 0 || parseObservations(item.observations, item, globalObservations).custom) && (
                        <>
                          <i className="ri-information-line mr-1"></i>
                          {parseObservations(item.observations, item, globalObservations).optional.join(', ') || parseObservations(item.observations, item, globalObservations).custom}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Total e checkout - fixo na parte inferior */}
      {items.length > 0 && (
        <div className="p-3 lg:p-4 border-t border-gray-200 flex-shrink-0 bg-white sticky bottom-0">
          <div className="flex items-center justify-between mb-4">
            <span className="text-base lg:text-lg font-semibold text-gray-900">Total:</span>
            <span className="text-base lg:text-lg font-bold text-amber-600">R$ {total.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-700">Desconto global (%):</span>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                value={globalDiscountPercentage.toString()}
                onChange={(e)=> setGlobalDiscountPercentage(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                className="w-24"
                step="1"
                min="0"
                max="100"
              />
              <span className="text-sm">%</span>
            </div>
          </div>
          
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => setShowCheckout(true)}
            disabled={hasItemsWithMissingRequiredOptions()}
            variant={hasItemsWithMissingRequiredOptions() ? "secondary" : "primary"}
          >
            <i className="ri-shopping-cart-line mr-2"></i>
            Finalizar Pedido ({config.checkoutShortcut})
            {hasItemsWithMissingRequiredOptions() && (
              <i className="ri-error-warning-line ml-2" title="Complete as opções obrigatórias"></i>
            )}
          </Button>
        </div>
      )}

      {/* Modals (mantidos fora do fluxo principal para evitar problemas de layout) */}
      <Modal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        title="Finalizar Pedido"
        size="lg"
      >
        <div className="space-y-6">
          {/* Resumo do pedido */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Resumo do Pedido</h4>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.quantity}x {item.menuItem.name}</span>
                  <span>R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between">
                <span className="font-medium">Subtotal:</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              {globalDiscountPercentage > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm">Desconto ({globalDiscountPercentage}%)</span>
                  <span className="text-sm">- R$ {(subtotal - total).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span className="text-amber-600">R$ {total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Número do pedido */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <i className="ri-hashtag text-amber-600"></i>
              <span className="text-sm font-medium text-amber-800">
                Número do Pedido: <span className="font-bold text-lg">{generateOrderPin()}</span>
              </span>
            </div>
          </div>

          {/* Senha do pedido - MAIS EVIDENTE */}
          <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-md">
            <label className="block text-lg font-bold text-gray-900 mb-2 flex items-center">
              <i className="ri-key-line mr-2 text-amber-600"></i>
              Senha do Pedido: *
            </label>
            <Input
              ref={passwordInputRef}
              type={config.passwordFormat === 'numeric' ? 'tel' : 'text'}
              value={orderPassword}
              onChange={handlePasswordChange}
              onKeyPress={handlePasswordKeyPress}
              placeholder="Digite a senha do pedido"
              className="w-full text-2xl font-extrabold text-center py-3 border-amber-500 focus:ring-4 focus:ring-amber-200" // Aumentar fonte e destaque
              required
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              Senha obrigatória para identificação do pedido. Formato: 
              <span className="font-medium ml-1">
                {config.passwordFormat === 'numeric' ? 'Numérico' : 
                 config.passwordFormat === 'alphabetic' ? 'Alfabético' : 'Alfanumérico'}
              </span>
              (Pressione ENTER para continuar)
            </p>
          </div>

          {/* WhatsApp do cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              WhatsApp do Cliente (opcional):
            </label>
            <Input
              type="tel"
              value={customerWhatsApp}
              onChange={(e) => setCustomerWhatsApp(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Para notificações sobre o pedido
            </p>
          </div>

          {/* Tipo de pagamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tipo de Pagamento: *
            </label>
            <div className="flex space-x-3 mb-4">
              <button
                onClick={() => {
                  setIsMultiplePayment(false);
                  resetMultiplePayment();
                  setSelectedPayment('');
                }}
                className={`flex-1 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                  !isMultiplePayment
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <i className="ri-money-dollar-circle-line text-lg"></i>
                  <span className="font-medium">Pagamento Único</span>
                </div>
              </button>
              <button
                onClick={() => {
                  setIsMultiplePayment(true);
                  setSelectedPayment('');
                  setRemainingAmount(total);
                }}
                className={`flex-1 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                  isMultiplePayment
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <i className="ri-exchange-line text-lg"></i>
                  <span className="font-medium">Pagamento Misto</span>
                </div>
              </button>
            </div>
          </div>

          {/* Pagamento único */}
          {!isMultiplePayment && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Forma de Pagamento: *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {paymentMethods.map((method) => (
                  <button
                    key={method}
                    onClick={() => {
                      setSelectedPayment(method);
                      const isCash = method.toLowerCase().includes('dinheiro');
                      setShowChangeCalculation(isCash);
                      if (!isCash) {
                        setAmountPaid('');
                      } else {
                        // Focar no campo de valor pago se for dinheiro
                        setTimeout(() => amountPaidInputRef.current?.focus(), 0);
                      }
                    }}
                    className={`p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                      selectedPayment === method
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <i className={`${getPaymentIcon(method)} text-lg`}></i>
                        <span className="font-medium">{method}</span>
                      </div>
                      {paymentShortcuts[method] && (
                        <span className="text-xs font-bold bg-white px-2 py-0.5 rounded border" style={{ fontFamily: 'inherit' }}>
                          {paymentShortcuts[method]}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pagamento múltiplo */}
          {isMultiplePayment && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-3 flex items-center">
                  <i className="ri-exchange-line mr-2"></i>
                  Pagamento Misto
                </h4>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700">Total do pedido:</span>
                    <span className="font-medium text-blue-800">R$ {total.toFixed(2)}</span>
                  </div>
                  
                  {Object.keys(paymentBreakdown).length > 0 && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-blue-700">Formas selecionadas:</span>
                      {Object.entries(paymentBreakdown).map(([method, amount]) => (
                        <div key={method} className="flex items-center justify-between bg-white rounded p-2">
                          <div className="flex items-center space-x-2">
                            <i className={`${getPaymentIcon(method)} text-blue-600`}></i>
                            <span className="text-sm font-medium">{method}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Input
                              type="number"
                              value={amount === 0 ? '' : amount.toString()} 
                              onChange={(e) => {
                                const value = e.target.value;
                                // Se o valor for vazio, passa 0 para o breakdown, mas não remove a chave
                                updatePaymentBreakdown(method, parseFloat(value) || 0);
                              }}
                              className="w-24 text-sm"
                              step="0.01"
                              min="0"
                              max={total.toString()}
                            />
                            <button
                              // Ação de remover a forma de pagamento (agora remove a chave)
                              onClick={() => {
                                const newBreakdown = { ...paymentBreakdown };
                                delete newBreakdown[method];
                                setPaymentBreakdown(newBreakdown);
                                setRemainingAmount(Math.max(0, total - Object.values(newBreakdown).reduce((sum, amt) => sum + amt, 0)));
                              }}
                              className="text-red-500 hover:text-red-700 cursor-pointer"
                            >
                              <i className="ri-close-line"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="border-t border-blue-200 pt-3 flex justify-between items-center">
                    <span className="font-medium text-blue-800">Valor restante:</span>
                    <span className={`text-lg font-bold ${remainingAmount > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                      R$ {remainingAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {remainingAmount > 0.01 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Adicionar forma de pagamento:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {paymentMethods.map((method) => (
                      <button
                        key={method}
                        onClick={() => addPaymentMethod(method)}
                        className="p-3 rounded-lg border-2 border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <i className={`${getPaymentIcon(method)} text-lg`}></i>
                          <span className="font-medium">{method}</span> 
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Você pode adicionar a mesma forma de pagamento múltiplas vezes
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Cálculo de troco para pagamento em dinheiro */}
          {((isCashPayment && !isMultiplePayment) || (isMultiplePayment && hasCashInBreakdown)) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-800 mb-3 flex items-center">
                <i className="ri-money-dollar-circle-line mr-2"></i>
                Pagamento em Dinheiro
              </h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-green-700 mb-2">
                    Valor pago pelo cliente: *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600">
                      R$
                    </span>
                    <Input
                      ref={amountPaidInputRef}
                      type="number"
                      value={amountPaid}
                      onChange={handleAmountPaidChange} // Usando a nova função
                      onKeyPress={handleAmountPaidKeyPress}
                      placeholder="0,00"
                      className="w-full pl-10"
                      step="0.01"
                      min="0" 
                    />
                  </div>
                </div>

                {/* O bloco de cálculo de troco agora é exibido se showChangeCalculation for true, 
                    o que é garantido se o pagamento em dinheiro estiver ativo, mesmo que amountPaid seja vazio. */}
                {showChangeCalculation && (
                  <div className="bg-white rounded-lg p-3 border border-green-300">
                    {isMultiplePayment ? (
                      (() => {
                        const cashPayments = Object.entries(paymentBreakdown)
                          .filter(([method]) => method.toLowerCase().includes('dinheiro'))
                          .reduce((sum, [, amount]) => sum + amount, 0);
                        const troco = paidAmount - cashPayments;
                        
                        return (
                          <>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-green-700">Valor em dinheiro:</span>
                              <span className="font-medium text-green-800">R$ {cashPayments.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-green-700">Valor pago:</span>
                              <span className="font-medium text-green-800">R$ {paidAmount.toFixed(2)}</span>
                            </div>
                            <div className="border-t border-green-200 pt-2 flex justify-between items-center">
                              <span className="font-medium text-green-800">Troco:</span>
                              <span className={`text-lg font-bold ${troco >= -0.001 ? 'text-green-900' : 'text-red-600'}`}>
                                R$ {troco.toFixed(2)}
                              </span>
                            </div>
                            {troco < -0.001 && (
                              <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3">
                                <div className="flex items-center text-red-700">
                                  <i className="ri-error-warning-line mr-2"></i>
                                  <span className="text-sm">
                                    Valor insuficiente. Faltam R$ {Math.abs(troco).toFixed(2)}
                                  
                                  </span>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()
                    ) : (
                      <>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-green-700">Total do pedido:</span>
                          <span className="font-medium text-green-800">R$ {total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-green-700">Valor pago:</span>
                          <span className="font-medium text-green-800">R$ {paidAmount.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-green-200 pt-2 flex justify-between items-center">
                          <span className="font-medium text-green-800">Troco:</span>
                          <span className="text-lg font-bold text-green-900">
                            R$ {changeAmount.toFixed(2)}
                          </span>
                        </div>
                        {paidAmount < total - 0.001 && (
                          <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="flex items-center text-red-700">
                              <i className="ri-error-warning-line mr-2"></i>
                              <span className="text-sm">
                                Valor insuficiente. Faltam R$ {(total - paidAmount).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botões de ação */}
          <div className="space-y-3 pt-4 border-t">
            {/* Mensagem de aviso para opções obrigatórias não selecionadas */}
            {hasItemsWithMissingRequiredOptions() && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center text-amber-700">
                  <i className="ri-error-warning-line mr-2"></i>
                  <span className="text-sm">
                    Existem itens com opções obrigatórias não selecionadas
                  </span>
                </div>
              </div>
            )}
            
            {/* Botão de teste temporário removido */}
            
            <div className="flex space-x-3">
              <Button
                variant="secondary"
                onClick={resetCheckoutData}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCheckout}
                className="flex-1"
                disabled={isConfirmDisabled()}
              >
                <i className="ri-check-line mr-2"></i>
                Confirmar Pedido ({config.checkoutShortcut})
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal de Confirmação de Pedido */}
      <OrderConfirmationModal
        isOpen={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        orderData={confirmedOrderData}
      />

      {/* Modal para salvar carrinho */}
      <Modal
        isOpen={showSaveModal}
        onClose={resetSaveModal}
        title="Salvar Carrinho"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome do carrinho:
            </label>
            <Input
              ref={saveCartInputRef}
              value={cartName}
              onChange={(e) => setCartName(e.target.value)}
              onKeyPress={handleSaveCartKeyPress}
              placeholder="Digite um nome para identificar este carrinho..."
              autoFocus
            />
          </div>

          {selectedCartToReplace && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center mb-2">
                <i className="ri-information-line text-amber-600 mr-2"></i>
                <span className="text-sm font-medium text-amber-800">
                  Substituindo carrinho existente
                </span>
              </div>
              <p className="text-sm text-amber-700">
                O carrinho "{cartName}" será substituído pelo carrinho atual.
              </p>
            </div>
          )}

          {savedCarts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Carrinhos salvos ({savedCarts.length}):
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {savedCarts.map((savedCart) => (
                  <div
                    key={savedCart.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedCartToReplace === savedCart.id
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => selectCartToReplace(savedCart)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="font-medium text-gray-900 text-sm">{savedCart.name}</h5>
                      {selectedCartToReplace === savedCart.id && (
                        <i className="ri-check-line text-amber-600"></i>
                      )}
                    </div>
                    <div className="text-xs text-gray-600">
                      <span>{savedCart.items.reduce((sum, item) => sum + item.quantity, 0)} itens</span>
                      <span className="mx-2">•</span>
                      <span>R$ {savedCart.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0).toFixed(2)}</span>
                      <span className="mx-2">•</span>
                      <span>{new Date(savedCart.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Clique em um carrinho para substituí-lo ou digite um novo nome
              </p>
            </div>
          )}
          
          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={resetSaveModal}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCart}
              className="flex-1"
            >
              {selectedCartToReplace ? 'Substituir' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal para carregar carrinho */}
      <Modal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        title="Carregar Carrinho Salvo"
        size="md"
      >
        <div className="space-y-4">
          {savedCarts.length === 0 ? (
            <div className="text-center py-8">
              <i className="ri-shopping-cart-line text-4xl text-gray-400 mb-4"></i>
              <p className="text-gray-500">Nenhum carrinho salvo encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                Selecione um carrinho para carregar:
              </p>
              {savedCarts.map((savedCart) => (
                <div
                  key={savedCart.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{savedCart.name}</h4>
                    <button
                      onClick={() => openDeleteCartConfirmation(savedCart)}
                      className="text-red-500 hover:text-red-700 cursor-pointer"
                      title="Excluir carrinho salvo"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-3">
                    <p>Data: {new Date(savedCart.createdAt).toLocaleDateString('pt-BR')}</p>
                    <p>Itens: {savedCart.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
                    <p>Total: R$ {savedCart.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0).toFixed(2)}</p>
                  </div>
                  
                  <div className="space-y-1 mb-3">
                    {savedCart.items.slice(0, 3).map((item, index) => (
                      <div key={index} className="text-xs text-gray-500">
                        {item.quantity}x {item.menuItem.name}
                      </div>
                    ))}
                    {savedCart.items.length > 3 && (
                      <div className="text-xs text-gray-400">
                        +{savedCart.items.length - 3} itens...
                      </div>
                    )}
                  </div>
                  
                  <Button
                    onClick={() => loadCart(savedCart)}
                    size="sm"
                    className="w-full"
                  >
                    Carregar Carrinho
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex justify-end pt-4 border-top border-gray-200">
            <Button
              variant="secondary"
              onClick={() => setShowLoadModal(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Editar Observações */}
      <Modal
        isOpen={showEditObservations}
        onClose={() => setShowEditObservations(false)}
        title={`Opções e Observações - ${editingItem?.menuItem.name}`}
        size="lg"
      >
        <div className="space-y-6">
          
          {/* Opções Obrigatórias */}
          {editingItem && getAllAvailableRequiredGroups(editingItem).length > 0 && (
            <div className="p-4 border border-red-300 rounded-lg bg-red-50 space-y-4">
              <h4 className="font-bold text-red-800 flex items-center">
                <i className="ri-alert-line mr-2"></i>
                Opções Obrigatórias (Selecione 1 por grupo): *
              </h4>
              
              {getAllAvailableRequiredGroups(editingItem).map((group) => (
                <div key={group.id} className="border border-red-200 rounded-lg p-3">
                    <h5 className="font-medium text-red-700 mb-2">{group.name}:</h5>
                    <div className="grid grid-cols-2 gap-2">
                        {group.options.map((option) => (
                            <button
                                key={option}
                                onClick={() => toggleRequiredModifier(group.id, option)}
                                className={`p-3 text-sm rounded-lg border-2 transition-colors cursor-pointer whitespace-nowrap ${
                                    selectedRequiredModifiers[group.id] === option
                                        ? 'bg-red-100 border-red-500 text-red-800 font-medium'
                                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                                }`}
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
          {editingItem && getAllAvailableObservations(editingItem).length > 0 && (
            <div className="p-4 border border-amber-300 rounded-lg bg-amber-50">
              <h4 className="font-medium text-amber-800 mb-3">Observações Opcionais:</h4>
              <div className="grid grid-cols-2 gap-2">
                {getAllAvailableObservations(editingItem).map((observation) => (
                  <button
                    key={observation}
                    onClick={() => toggleOptionalObservation(observation)}
                    className={`p-2 text-sm rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                      selectedOptionalObservations.includes(observation)
                        ? 'bg-amber-100 border-amber-500 text-amber-800'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {observation}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Observação personalizada */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observação personalizada:
            </label>
            <textarea
              value={customObservation}
              onChange={(e) => setCustomObservation(e.target.value)}
              placeholder="Digite uma observação específica..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">
              Máximo 500 caracteres
            </p>
          </div>

          <div className="flex space-x-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => setShowEditObservations(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveObservations}
              className="flex-1"
              disabled={editingItem && getAllAvailableRequiredGroups(editingItem).length > 0 && getAllAvailableRequiredGroups(editingItem).some(group => !selectedRequiredModifiers[group.id])}
            >
              <i className="ri-check-line mr-2"></i>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Modal de Confirmação de Exclusão de Carrinho */}
      <ConfirmationModal
        isOpen={showDeleteCartModal}
        onClose={() => setShowDeleteCartModal(false)}
        onConfirm={deleteSavedCart}
        title="Excluir Carrinho Salvo"
        message={
          <>
            Tem certeza que deseja excluir permanentemente o carrinho salvo: 
            <span className="font-bold text-red-700 block mt-1">"{cartToDelete?.name}"</span>?
            Esta ação não pode ser desfeita.
          </>
        }
        confirmText="Excluir Permanentemente"
        variant="danger"
      />
    </div>
  );
}
