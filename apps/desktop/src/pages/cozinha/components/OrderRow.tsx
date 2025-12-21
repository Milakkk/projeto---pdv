import { useState, useMemo, memo } from 'react';
import type { Order, KitchenOperator, OrderItem, ProductionUnit } from '../../../types';
import Button from '../../../components/base/Button';
import { useTimer } from '../../../hooks/useTimer';
import Modal from '../../../components/base/Modal';
import Input from '../../../components/base/Input';
import AlertModal from '../../../components/base/AlertModal';

interface OrderRowProps {
  order: Order;
  operators: KitchenOperator[];
  categoryMap: Record<string, string>;
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
  onAssignOperator: (orderId: string, itemId: string, unitId: string, operatorName: string) => void;
  onAssignOperatorToAll: (orderId: string, operatorName: string) => void;
  onDisplayAlert: (title: string, message: string, variant?: 'error' | 'info' | 'success') => void;
  onUpdateItemStatus: (orderId: string, itemId: string, unitId: string, itemStatus: ProductionUnit['unitStatus'], completedObservations?: string[]) => void;
  onCancelOrder: (orderId: string, reason: string) => void;
}

// Função auxiliar para calcular o tempo total de produção e status de atraso (duplicada para evitar importação circular)
const calculateProductionTimeStatus = (order: Order) => {
  const startTime = new Date(order.createdAt).getTime();
  // O tempo final é o momento em que ficou pronto (updatedAt) ou o momento atual se ainda estiver em preparo
  const endTime = order.status === 'READY' || order.status === 'DELIVERED' ? new Date(order.updatedAt || order.createdAt).getTime() : Date.now();
  const totalTimeSeconds = Math.floor((endTime - startTime) / 1000);
  const wasLate = (totalTimeSeconds / 60) > order.slaMinutes;
  
  return { totalTimeSeconds, wasLate };
};

// Função auxiliar para extrair opções obrigatórias (agora com nome do grupo)
const extractRequiredOptions = (observations: string | undefined): string[] => {
    if (!observations) return [];
    return observations
        .split(', ')
        .filter(p => p.startsWith('[OBRIGATÓRIO]'))
        .map(p => p.replace('[OBRIGATÓRIO]', '').trim());
};

// Função auxiliar para extrair observações opcionais/customizadas
const extractOptionalObservations = (observations: string | undefined): string[] => {
    if (!observations) return [];
    return observations
        .split(', ')
        .filter(p => !p.startsWith('[OBRIGATÓRIO]'))
        .map(p => p.trim())
        .filter(p => p.length > 0);
};

// NOVO: Função para obter a lista completa de itens de checklist (Obrigatórios + Opcionais)
const getAllChecklistItems = (observations: string | undefined): { label: string; isRequired: boolean }[] => {
    const required = extractRequiredOptions(observations).map(label => ({ label, isRequired: true }));
    const optional = extractOptionalObservations(observations).map(label => ({ label, isRequired: false }));
    // Unificamos as listas
    return [...required, ...optional];
};

const statusInfo = {
  NEW: { text: 'Novo', color: 'bg-blue-100 text-blue-800', bgColor: 'bg-blue-50' },
  PREPARING: { text: 'Preparando', color: 'bg-yellow-100 text-yellow-800', bgColor: 'bg-yellow-50' },
  READY: { text: 'Pronto', color: 'bg-green-100 text-green-800', bgColor: 'bg-green-50' },
  DELIVERED: { text: 'Entregue', color: 'bg-gray-100 text-gray-800', bgColor: 'bg-gray-50' },
  CANCELLED: { text: 'Cancelado', color: 'bg-red-100 text-red-800', bgColor: 'bg-red-50' },
} as const;

const formatOrderPin = (pin: string) => {
  const raw = String(pin ?? '').trim()
  if (!raw) return '#-'
  return `#${raw.replace(/^#+/, '')}`
}

function OrderRowComponent({ order, operators, categoryMap, onUpdateStatus, onAssignOperator, onAssignOperatorToAll, onDisplayAlert, onUpdateItemStatus, onCancelOrder }: OrderRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelPassword, setCancelPassword] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [showAssignOperatorAlert, setShowAssignOperatorAlert] = useState(false);
  const [alertModalMessage, setAlertModalMessage] = useState('');
  // Botão para alternar exibição de itens de entrega direta
  const [showDirectItems, setShowDirectItems] = useState(false);
  // Modal de checklist para entrega direta antes de marcar como entregue
  const [showDirectDeliveryModal, setShowDirectDeliveryModal] = useState(false);
  const [directDeliveryChecks, setDirectDeliveryChecks] = useState<Record<string, boolean>>({});
  
  // O timer deve estar ativo apenas em NEW e PREPARING.
  const isTimerActive = order.status === 'NEW' || order.status === 'PREPARING';
  const { timeElapsed, isOverdue, formatTime } = useTimer(order.createdAt, order.slaMinutes, isTimerActive);

  // NOVO: Itens que passam pela cozinha (ignora entrega direta)
  const kitchenItems = useMemo(() => {
    return order.items.filter(item => !(item.skipKitchen || item.menuItem?.skipKitchen));
  }, [order.items]);

  // NOVO: Itens de entrega direta (não passam pela cozinha)
  const directItems = useMemo(() => {
    return order.items.filter(item => item.skipKitchen || item.menuItem?.skipKitchen);
  }, [order.items]);

  // NOVO: Extrai nomes únicos dos operadores atribuídos (apenas itens de cozinha)
  const assignedOperators = useMemo(() => {
    const operatorNames = new Set<string>();
    kitchenItems.forEach(item => {
      (item.productionUnits || []).forEach(unit => {
        if (unit.operatorName) {
          operatorNames.add(unit.operatorName);
        }
      });
    });
    return Array.from(operatorNames);
  }, [kitchenItems]);

  // Verifica se todas as unidades têm o mesmo operador (para o botão 'Atribuir a todos')
  const allUnitsOperator = useMemo(() => {
    // CORREÇÃO: Garante que productionUnits seja um array antes de usar flatMap (apenas itens de cozinha)
    const allUnits = kitchenItems.flatMap(item => item.productionUnits || []);
    
    if (allUnits.length === 0) return null;
    const firstOperator = allUnits[0].operatorName;
    if (!firstOperator) return null;
    const allSame = allUnits.every(unit => unit.operatorName === firstOperator);
    return allSame ? firstOperator : null;
  }, [kitchenItems]);

  const getNextStatus = (currentStatus: Order['status']): Order['status'] | null => {
    switch (currentStatus) {
      case 'NEW': return 'PREPARING';
      case 'PREPARING': return 'READY'; 
      case 'READY': return 'DELIVERED';
      default: return null;
    }
  };

  // Adicionado: Função para obter o status anterior
  const getPreviousStatus = (currentStatus: Order['status']): Order['status'] | null => {
    switch (currentStatus) {
      case 'PREPARING': return 'NEW';
      case 'READY': return 'PREPARING';
      case 'DELIVERED': return 'READY';
      default: return null;
    }
  };

  const getStatusAction = (status: Order['status']) => {
    const s = String(status).toUpperCase();
    if (s === 'NEW') return 'Iniciar Preparo';
    if (s === 'PREPARING' || s === 'PREP') return 'Marcar como Pronto';
    if (s === 'READY') return 'Entregue';
    return null;
  };
  
  // Adicionado: Função para obter o texto da ação de status anterior
  const getPreviousStatusAction = (status: Order['status']) => {
    switch (status) {
      case 'PREPARING': return 'Voltar';
      case 'READY': return 'Voltar';
      case 'DELIVERED': return 'Voltar';
      default: return null;
    }
  };

  const getActionVariant = (status: Order['status']): 'info' | 'primary' | 'success' => {
    switch (status) {
      case 'NEW': return 'info'; 
      case 'PREPARING': return 'success'; 
      case 'READY': return 'success'; 
      default: return 'primary';
    }
  };

  // Verifica se TODAS as unidades de produção estão prontas E se todas as observações foram checadas
  const allUnitsReady = useMemo(() => {
    return kitchenItems.every(item => 
      (item.productionUnits || []).every(unit => {
          const isReady = unit.unitStatus === 'READY';
          
          // NOVO: Verifica se TODOS os itens do checklist (obrigatórios + opcionais) foram completados
          const allChecklistItems = getAllChecklistItems(item.observations);
          const allChecklistCompleted = allChecklistItems.length === 0 || 
                                           (unit.completedObservations && unit.completedObservations.length === allChecklistItems.length);
          
          return isReady && allChecklistCompleted;
      })
    );
  }, [kitchenItems]);

  // NOVO: Verifica se TODAS as unidades possuem operador atribuído (para habilitar "Iniciar Preparo")
  const allUnitsAssignedStatus = useMemo(() => {
    return kitchenItems.every(item =>
      (item.productionUnits || []).every(unit => !!unit.operatorName)
    );
  }, [kitchenItems]);

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation(); // ISOLANDO O CLIQUE DO BOTÃO PRINCIPAL
    
    const nextStatus = getNextStatus(order.status);
    if (!nextStatus) return;

    // Validação de atribuição de operador para NEW -> PREPARING (RELAXADA: Apenas alerta se não houver operadores)
    if ((order.status === 'NEW' || order.status === 'QUEUED') && nextStatus === 'PREPARING') {
      console.log('Iniciando preparo (sem validação estrita de operadores)');
    }
    
    // Validação para PREPARING -> READY
    if (order.status === 'PREPARING' && nextStatus === 'READY') {
      if (!allUnitsReady) {
        onDisplayAlert(
          'Ação Necessária', 
          'Todas as unidades de produção devem ser marcadas como "Pronto" e todos os itens do checklist (opções obrigatórias e observações) devem ser checados.', 
          'info'
        );
        return;
      }
    }
    
    // Removido: interceptação de READY -> DELIVERED para entrega direta (modal agora apenas informativo)
    onUpdateStatus(order.id, nextStatus);
  };
  
  // Função unificada para lidar com o toggle de pronto, seja para unidade única ou múltipla
  const handleUnitReadyToggle = (e: React.MouseEvent, itemId: string, unitId: string, isReady: boolean) => {
    e.stopPropagation(); // ISOLANDO O CLIQUE DO BOTÃO DE UNIDADE
    
    const newStatus = isReady ? 'READY' : 'PENDING';
    const item = order.items.find(i => i.id === itemId);
    const unit = item?.productionUnits.find(u => u.unitId === unitId);
    
    // Se estiver marcando como pronto, verifica requisitos
    if (isReady) {
        const allChecklistItems = getAllChecklistItems(item?.observations);
        const allChecklistCompleted = allChecklistItems.length === 0 || 
                                (unit?.completedObservations && unit.completedObservations.length === allChecklistItems.length);
        
        if (allChecklistItems.length > 0 && !allChecklistCompleted) {
            onDisplayAlert('Ação Necessária', 'Complete todos os itens do checklist (opções obrigatórias e observações) antes de marcar a unidade como pronta.', 'info');
            return;
        }
    }
    
    // Ao desmarcar como pronto, limpamos as observações completadas
    const completedObservations = isReady ? unit?.completedObservations : [];
    onUpdateItemStatus(order.id, itemId, unitId, newStatus, completedObservations);
  };
  
  // NOVO: Função para lidar com o checklist de observações (agora unificado)
  const handleObservationToggle = (e: React.ChangeEvent<HTMLInputElement>, itemId: string, unitId: string, observationLabel: string, isChecked: boolean) => {
    e.stopPropagation(); // ISOLANDO O CLIQUE DO CHECKBOX
    
    // Restringe a interação apenas para o status PREPARING
    if (order.status !== 'PREPARING') return;
    
    const item = order.items.find(i => i.id === itemId);
    const unit = item?.productionUnits.find(u => u.unitId === unitId);
    if (!unit) return;
    
    let newCompletedObservations = [...(unit.completedObservations || [])];
    
    if (isChecked) {
      if (!newCompletedObservations.includes(observationLabel)) {
        newCompletedObservations.push(observationLabel);
      }
    } else {
      newCompletedObservations = newCompletedObservations.filter(obs => obs !== observationLabel);
    }
    
    // 1. Determine if all checklist items are now completed
    const allChecklistItems = getAllChecklistItems(item!.observations);
    const allObsCompleted = allChecklistItems.length === newCompletedObservations.length;
    
    // 2. Determine the new unit status based on the user's request and the new rule
    let newUnitStatus = unit.unitStatus;
    
    // REGRA IMPLEMENTADA: Se a unidade está pronta E o checklist não está completo, reverte para PENDING.
    if (unit.unitStatus === 'READY' && !allObsCompleted) {
        newUnitStatus = 'PENDING';
    }
    
    // Atualiza o status da unidade, passando o novo array de observações
    onUpdateItemStatus(order.id, itemId, unitId, newUnitStatus, newCompletedObservations);
  };
  
  // CORREÇÃO: Função unificada para lidar com a atribuição de operador
  const handleAssignOperatorUnified = (e: React.MouseEvent, itemId: string, unitId: string, operatorName: string) => {
    e.stopPropagation(); // MANTIDO AQUI PARA BLOQUEAR O TOGGLE DA LINHA
    
    // Bloquear mudança de operador se o status for diferente de NEW
    if (order.status !== 'NEW') return;
    onAssignOperator(order.id, itemId, unitId, operatorName);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation(); // ISOLANDO O CLIQUE DO BOTÃO CANCELAR
    setCancelError('');
    if (!cancelReason.trim()) {
      setCancelError('O motivo do cancelamento é obrigatório.');
      return;
    }
    if (cancelPassword !== '159753') {
      setCancelError('Senha incorreta!');
      setCancelPassword('');
      return;
    }
    onCancelOrder(order.id, cancelReason);
    handleCloseCancelModal();
  };

  const handleCloseCancelModal = () => {
    setShowCancelModal(false);
    setCancelReason('');
    setCancelPassword('');
    setCancelError('');
  };

  const currentStatusInfo = statusInfo[order.status];
  
  // Lógica de tempo e atraso
  const { totalTimeSeconds, wasLate } = calculateProductionTimeStatus(order);
  const timeToDisplay = order.status === 'READY' || order.status === 'DELIVERED' ? formatTime(totalTimeSeconds) : formatTime(timeElapsed);
  const isCurrentlyOverdue = order.status === 'READY' || order.status === 'DELIVERED' ? wasLate : isOverdue;
  
  // Atraso só é relevante se o timer estiver ativo (NEW ou PREPARING)
  const isOverdueForHighlight = isCurrentlyOverdue && (order.status === 'NEW' || order.status === 'PREPARING');
  const bgColor = isOverdueForHighlight ? 'bg-red-50' : (currentStatusInfo?.bgColor || 'bg-white');
  
  // O botão de item pronto é visível se o pedido estiver em PREPARING
  const showUnitReadyButton = order.status === 'PREPARING';
  const isPreparingStatus = order.status === 'PREPARING';
  
  // Atribuição de operador só é permitida em NEW
  const isOperatorAssignmentDisabled = order.status !== 'NEW'; 
  
  const isChecklistDisabled = !isPreparingStatus;
  
  // Memoizar o status de todas as unidades prontas para evitar re-cálculo no render
  const allUnitsReadyStatus = useMemo(() => allUnitsReady, [allUnitsReady]);
  
  // Determine if the order is in an active state where actions are possible
  const isActiveOrder = order.status === 'NEW' || order.status === 'PREPARING' || order.status === 'READY';
  const showPreviousButton = order.status === 'READY'; // Apenas READY pode voltar para PREPARING

  const nextStatusAction = getStatusAction(order.status);
  const isOrderReadyForNextStepStatus = allUnitsReady; // Renomeado para clareza

  return (
    <>
      <div className={`p-4 ${bgColor} grid grid-cols-1 lg:grid-cols-12 gap-4 items-start border-b border-gray-200 cursor-pointer`} onClick={() => setIsExpanded(prev => !prev)}>
        {/* Coluna Pedido */}
        <div className="lg:col-span-2 min-w-0">
          <div className="text-xs font-medium text-gray-600">{formatOrderPin(order.pin)}</div>
          <div className="bg-blue-500 text-white text-lg font-bold px-3 py-1 rounded-lg inline-block mt-1 whitespace-nowrap">
            {order.password}
          </div>
          
          {/* NOVO: Operadores Atribuídos */}
          {assignedOperators.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {assignedOperators.map(opName => (
                <span key={opName} className="text-xs font-medium bg-amber-300 text-amber-900 px-2 py-0.5 rounded-full">
                  <i className="ri-user-line mr-1"></i>
                  {opName}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Coluna Status */}
        <div className="lg:col-span-2 min-w-0">
          {currentStatusInfo && (
            <span className={`inline-flex px-3 py-1.5 text-sm font-semibold rounded-full ${currentStatusInfo.color} whitespace-nowrap`}>
              {currentStatusInfo.text}
            </span>
          )}
        </div>

        {/* Coluna Itens / Operador (Resumo) */}
        <div className="lg:col-span-3 space-y-1 min-w-0">
          {kitchenItems.map(item => {
            // NOVO: Lógica de status de produção do item
            const totalUnits = item.productionUnits.length;
            const readyUnits = item.productionUnits.filter(unit => unit.unitStatus === 'READY').length;
            const pendingUnits = totalUnits - readyUnits;
            const isItemReady = pendingUnits === 0;
            
            // NOVO: Extrair opções obrigatórias
            const requiredOptions = extractRequiredOptions(item.observations);
            
            return (
              <div key={item.id} className="text-sm text-gray-900 flex flex-col">
                <span className="truncate max-w-full">
                  {item.quantity}x {item.menuItem.name}
                </span>
                
                {/* Indicadores de Status de Produção */}
                <div className="flex items-center space-x-2 mt-1">
                  {isItemReady ? (
                    <i className="ri-check-double-line text-green-600 flex-shrink-0" title="Todas as unidades prontas"></i>
                  ) : (
                    <span className="text-xs font-bold bg-amber-100 text-amber-600 px-1 py-0.5 rounded-full flex-shrink-0">
                      {pendingUnits} PENDENTE{pendingUnits > 1 ? 'S' : ''}
                    </span>
                  )}
                  
                  {requiredOptions.length > 0 && (
                      <span className="text-xs font-bold bg-red-100 text-red-600 px-1 py-0.5 rounded-full flex-shrink-0" title="Opções Obrigatórias">
                          {requiredOptions.length} OPÇÃO{requiredOptions.length > 1 ? 'ÕES' : ''}
                      </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Removido: botão para mostrar/ocultar itens de entrega direta */}

          {/* Removido: lista informativa de entrega direta controlada pelo botão */}
          <button 
            onClick={(e) => { e.stopPropagation(); setIsExpanded(prev => !prev); }}
            className="text-xs text-blue-600 hover:text-blue-800 mt-2 flex items-center"
          >
            <i className={`mr-1 ri-arrow-${isExpanded ? 'up' : 'down'}-s-line`}></i>
            {isExpanded ? 'Ocultar Detalhes' : 'Ver Detalhes'}
          </button>
        </div>

        {/* Coluna Tempo / SLA */}
        <div className="lg:col-span-2 space-y-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className={`font-bold text-xl ${isOverdueForHighlight ? 'text-red-600' : 'text-blue-600'} whitespace-nowrap`}>
              {timeToDisplay}
            </span>
            {/* Exibir status de atraso/prazo para todos os status ativos */}
            {(order.status === 'NEW' || order.status === 'PREPARING' || order.status === 'READY') && (
              <span className={`text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                isOverdueForHighlight ? 'bg-red-500' : 'bg-green-500'
              } whitespace-nowrap`}>
                {isOverdueForHighlight ? 'ATRASADO' : 'NO PRAZO'}
              </span>
            )}
          </div>
          <div className="text-gray-500 text-sm whitespace-nowrap">
            SLA: {order.slaMinutes} min
          </div>
        </div>

        {/* Coluna Total */}
        <div className="lg:col-span-1 font-medium text-gray-800 text-lg whitespace-nowrap min-w-0">
          R$ {order.total.toFixed(2)}
        </div>

        {/* Coluna Ação */}
        <div className="lg:col-span-2 flex items-center justify-center min-w-0">
          {/* O botão de ação principal só aparece para NEW -> PREPARING ou PREPARING -> READY */}
          {getStatusAction(order.status) && (
            <Button 
              size="sm" 
              onClick={handleAction} 
              className="w-full lg:w-auto whitespace-nowrap"
              variant={getActionVariant(order.status)}
              disabled={(order.status === 'PREPARING' && !allUnitsReadyStatus)}
            >
              {getStatusAction(order.status)}
            </Button>
          )}
        </div>
        
        {/* DETALHES EXPANDIDOS (Apenas em telas grandes) */}
        {isExpanded && (
          <div className="lg:col-span-12 pt-4 border-t border-gray-200 mt-4 space-y-4">
            <h4 className="text-sm font-bold text-gray-700">Detalhes do Pedido:</h4>
            
            {/* Atribuir operador a todos - SÓ VISÍVEL EM NEW */}
            {operators.length > 1 && !isOperatorAssignmentDisabled && (
              <div className="pb-3 border-b border-gray-200">
                <label className="text-xs font-medium text-gray-600 block mb-2">Atribuir a todas as unidades</label>
                <div className="flex flex-wrap gap-1">
                  {operators.map(op => (
                    <Button
                      key={op.id}
                      size="sm"
                      variant={allUnitsOperator === op.name ? 'primary' : 'secondary'}
                      className="!text-xs !px-2 !py-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newOperatorName = allUnitsOperator === op.name ? '' : op.name;
                        onAssignOperatorToAll(order.id, newOperatorName);
                      }}
                    >
                      {op.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            {kitchenItems.map(item => {
              const categoryName = categoryMap[item.menuItem.categoryId] || 'Sem Categoria';
              const isSingleUnit = item.quantity === 1;
              
              // NOVO: Extrair opções obrigatórias e opcionais
              const requiredOptions = extractRequiredOptions(item.observations);
              const optionalObservations = extractOptionalObservations(item.observations);
              
              // NOVO: Lista completa de checklist
              const allChecklistItems = getAllChecklistItems(item.observations);
              
              return (
                <div key={item.id} className="p-3 border border-gray-200 rounded-lg bg-white">
                  <div className="font-medium text-gray-900 text-sm mb-2">
                    <span className="mx-1">[{categoryName}]</span>
                    <span>{item.menuItem.name}</span>
                    <span className="text-xs text-gray-500 ml-2">({item.quantity} {item.quantity === 1 ? 'unid.' : 'unid.'})</span>
                  </div>
                  
                  {/* Opções Obrigatórias (INSTRUÇÃO) */}
                  {requiredOptions.length > 0 && (
                    <div className="mt-2 bg-red-100 border border-red-300 rounded-lg p-3">
                      <div className="flex items-start space-x-2">
                        <i className="ri-checkbox-circle-line text-red-600 mt-0.5 flex-shrink-0"></i>
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-1">
                            OPÇÕES:
                          </div>
                          <div className="text-sm font-medium text-red-900 leading-relaxed">
                            {requiredOptions.map((obs, obsIndex) => (
                              <div key={obsIndex} className="mb-1 last:mb-0">
                                • {obs}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Observações Opcionais/Customizadas */}
                  {optionalObservations.length > 0 && (
                    <div className="mt-2 bg-yellow-100 border border-yellow-300 rounded-lg p-3">
                      <div className="flex items-start space-x-2">
                        <i className="ri-alert-line text-yellow-600 mt-0.5 flex-shrink-0"></i>
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-yellow-800 uppercase tracking-wide mb-1">
                            OBSERVAÇÕES:
                          </div>
                          <div className="text-sm font-medium text-yellow-900 leading-relaxed">
                            {optionalObservations.map((obs, obsIndex) => (
                              <div key={obsIndex} className="mb-1 last:mb-0">
                                • {obs}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Rastreamento por Unidade */}
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {!isSingleUnit && <h5 className="text-xs font-medium text-gray-700 mb-2">Rastreamento por Unidade:</h5>}
                    {(item.productionUnits || []).map((unit, index) => {
                      const isUnitReady = unit.unitStatus === 'READY';
                      const unitOperator = unit.operatorName;
                      
                      // NOVO: Verifica se o checklist completo foi concluído
                      const allChecklistCompleted = allChecklistItems.length === 0 || 
                                                  (unit.completedObservations && unit.completedObservations.length === allChecklistItems.length);
                      
                      // NOVO: Condição para desabilitar o botão "Pronto" se for PENDING e observações estiverem incompletas
                      const disableReadyButton = !isUnitReady && allChecklistItems.length > 0 && !allChecklistCompleted;

                      return (
                        <div key={unit.unitId} className={`p-2 rounded-lg border transition-colors ${isUnitReady ? 'bg-green-100 border-green-300' : 'bg-white border-gray-200'}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">
                              Unidade {isSingleUnit ? 'Única' : index + 1}: 
                              <span className={`ml-1 font-bold ${isUnitReady ? 'text-green-700' : 'text-gray-700'}`}>
                                {isUnitReady ? 'Pronto' : 'Pendente'}
                              </span>
                            </span>
                            
                            {/* Botão de Pronto por Unidade - SÓ EM PREPARING */}
                            {showUnitReadyButton && (
                              <Button
                                size="sm"
                                variant={isUnitReady ? 'success' : 'secondary'}
                                onClick={(e) => handleUnitReadyToggle(e, item.id, unit.unitId, !isUnitReady)}
                                className={`!text-xs !px-2 !py-1 ml-2 flex-shrink-0 ${isUnitReady ? '' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                title={isUnitReady ? 'Marcar como Pendente' : 'Marcar como Pronto'}
                                disabled={disableReadyButton}
                              >
                                <i className={`mr-1 ${isUnitReady ? 'ri-check-line' : 'ri-check-line'}`}></i>
                                {isUnitReady ? 'Pronto' : 'Pronto'}
                              </Button>
                            )}
                          </div>
                          
                          {/* NOVO: Checklist Unificado (Obrigatórias + Opcionais) */}
                          {allChecklistItems.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-gray-200 space-y-1">
                                <h6 className="text-xs font-medium text-gray-700 mb-2">Checklist de Conferência:</h6>
                                {allChecklistItems.map((obs, obsIndex) => {
                                    const isChecked = unit.completedObservations?.includes(obs.label) || false;
                                    return (
                                        <label key={obsIndex} className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={(e) => handleObservationToggle(e, item.id, unit.unitId, obs.label, !isChecked)}
                                                className={`rounded border-gray-300 text-amber-600 focus:ring-amber-500 ${obs.isRequired ? 'border-red-500' : ''}`}
                                                disabled={isChecklistDisabled}
                                            />
                                            <span className={`${obs.isRequired ? 'font-bold text-red-700' : 'text-gray-700'}`}>
                                                {obs.label}
                                            </span>
                                        </label>
                                    );
              })}
                            </div>
                          )}
                          
                          {/* Seletor de operador por unidade - RENDERIZAÇÃO CONDICIONAL */}
                          <div className="mt-2 flex items-center space-x-2">
                            <i className="ri-user-line text-gray-500 flex-shrink-0"></i>
                            {isOperatorAssignmentDisabled ? (
                              // Se a atribuição estiver desabilitada (PREPARING/READY), mostra o nome do operador
                              unitOperator ? (
                                <span className="text-sm font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded">
                                  {unitOperator}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-500">Não Atribuído</span>
                              )
                            ) : (
                              // Se a atribuição estiver habilitada (NEW), mostra os botões
                              operators.length > 0 ? (
                                <div className="flex flex-wrap gap-1 min-w-0"> {/* Adicionado min-w-0 */}
                                  {operators.map(op => (
                                    <button
                                      key={op.id}
                                      onClick={(e) => {
                                        // CORREÇÃO: Passa o evento para a função unificada
                                        handleAssignOperatorUnified(e, item.id, unit.unitId, unitOperator === op.name ? '' : op.name);
                                      }}
                                      className={`px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                                        unitOperator === op.name
                                          ? 'bg-amber-300 !text-amber-900 !font-semibold hover:!bg-amber-400' // Laranja mais claro
                                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                      }`}
                                    >
                                      {op.name}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">Nenhum operador</span>
                              )
                            )}
                          </div>
                          
                          {/* Tempo de Conclusão da Unidade */}
                          {unit.completedAt && (
                            <div className="mt-2 text-xs text-green-700 font-medium">
                              Concluído às: {new Date(unit.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Removido: seção informativa de entrega direta controlada pelo botão */}
          </div>
        )}

        {/* Modal informativo de itens de entrega direta (somente visualização) */}
        <Modal
          isOpen={showDirectDeliveryModal}
          onClose={() => setShowDirectDeliveryModal(false)}
          title="Itens de Entrega Direta"
          size="md"
          overlayClassName="bg-transparent"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              {directItems.map(di => (
                <div key={di.id} className="flex items-center text-sm text-gray-800">
                  <i className="ri-truck-line text-purple-600 mr-2"></i>
                  {di.quantity}x {di.menuItem.name}
                </div>
              ))}
            </div>
            <div className="pt-2">
              <Button variant="secondary" onClick={() => setShowDirectDeliveryModal(false)} className="w-full">Fechar</Button>
            </div>
          </div>
        </Modal>

        {/* ACTIONS - Always visible if active order or final status */}
        {isActiveOrder || order.status === 'CANCELLED' || order.status === 'DELIVERED' ? (
          <div className={`space-y-2 pt-4 border-t border-gray-200`}>
            {order.status === 'CANCELLED' ? (
              <div className="text-center">
                <p className="text-sm text-red-600 font-medium">Cancelado</p>
                {order.cancelReason && (
                  <p className="text-xs text-red-500 mt-1">{order.cancelReason}</p>
                )}
              </div>
            ) : order.status === 'DELIVERED' ? (
              <div className="space-y-2">
                <div className="text-center">
                  <p className="text-sm text-green-600 font-medium">Entregue</p>
                </div>
                {showPreviousButton && (
                  <Button
                    variant="secondary"
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(order.id, getPreviousStatus(order.status)!); }}
                    className="w-full"
                    size="sm"
                  >
                    Voltar
                  </Button>
                )}
              </div>
            ) : (
              // Active Order Actions
              <div className="flex flex-wrap gap-2">
                {/* Main Action */}
                {nextStatusAction && (
                  <Button
                    onClick={handleAction}
                    className="flex-1 min-w-[45%]"
                    size="sm"
                    variant={getActionVariant(order.status)}
                    disabled={(order.status === 'PREPARING' && !isOrderReadyForNextStepStatus)} 
                  >
                    {nextStatusAction}
                  </Button>
                )}

                {/* Secondary Actions */}
                {showPreviousButton && (
                  <Button
                    variant="secondary"
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(order.id, getPreviousStatus(order.status)!); }}
                    className="flex-1 min-w-[45%]"
                    size="sm"
                  >
                    {getPreviousStatusAction(order.status)}
                  </Button>
                )}
                
                <Button
                  variant="secondary"
                  onClick={(e) => { e.stopPropagation(); setShowCancelModal(true); }}
                  className="flex-1 min-w-[45%] bg-red-50 text-red-600 hover:bg-red-100"
                  size="sm"
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <Modal
        isOpen={showCancelModal}
        onClose={handleCloseCancelModal}
        title="Cancelar Pedido"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Tem certeza que deseja cancelar o pedido {formatOrderPin(order.pin)}?
          </p>
          
          <Input
            label="Motivo do cancelamento *"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Ex: Cliente desistiu, falta de ingrediente..."
            required
          />

          <div>
            <Input
              label="Senha de confirmação *"
              type="password"
              value={cancelPassword}
              onChange={(e) => {
                setCancelPassword(e.target.value);
                if (cancelError) setCancelError('');
              }}
              placeholder="Digite a senha para confirmar"
              required
              error={cancelError ? ' ' : undefined}
            />
            {cancelError && (
              <p className="mt-1 text-sm text-red-600">{cancelError}</p>
            )}
          </div>

          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={handleCloseCancelModal}
              className="flex-1"
            >
              Voltar
            </Button>
            <Button
              variant="primary"
              onClick={handleCancel}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              Cancelar Pedido
            </Button>
          </div>
        </div>
      </Modal>

      <AlertModal
        isOpen={showAssignOperatorAlert}
        onClose={() => setShowAssignOperatorAlert(false)}
        title="Ação Necessária"
        message={alertModalMessage}
      />
    </>
  );
}

export default memo(OrderRowComponent);
