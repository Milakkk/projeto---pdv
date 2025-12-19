import { useState, useMemo, useEffect, useRef, memo } from 'react';
import type { Order, KitchenOperator, Category, OrderItem, ProductionUnit } from '../../../types';
import Button from '../../../components/base/Button';
import Modal from '../../../components/base/Modal';
import Input from '../../../components/base/Input';
import { useTimer } from '../../../hooks/useTimer';
import AlertModal from '../../../components/base/AlertModal';

interface OrderCardProps {
  order: Order;
  operators: KitchenOperator[];
  categories: Category[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
  onCancelOrder: (orderId: string, reason: string) => void;
  onAssignOperator: (orderId: string, itemId: string, unitId: string, operatorName: string) => void;
  onAssignOperatorToAll: (orderId: string, operatorName: string) => void;
  onUpdateItemStatus: (orderId: string, itemId: string, unitId: string, itemStatus: ProductionUnit['unitStatus'], completedObservations?: string[]) => void;
}

// Função auxiliar para calcular o tempo total de produção e status de atraso
const calculateProductionTimeStatus = (order: Order) => {
  const startTime = new Date(order.createdAt).getTime();
  const endTime = order.status === 'READY' || order.status === 'DELIVERED' ? new Date(order.updatedAt || order.createdAt).getTime() : Date.now();
  const totalTimeSeconds = Math.floor((endTime - startTime) / 1000);
  const wasLate = (totalTimeSeconds / 60) > order.slaMinutes;
  return { totalTimeSeconds, wasLate };
};

const extractRequiredOptions = (observations: string | undefined): string[] => {
  if (!observations) return [];
  return observations
    .split(', ')
    .filter(p => p.startsWith('[OBRIGATÓRIO]'))
    .map(p => p.replace('[OBRIGATÓRIO]', '').trim());
};

const extractOptionalObservations = (observations: string | undefined): string[] => {
  if (!observations) return [];
  return observations
    .split(', ')
    .filter(p => !p.startsWith('[OBRIGATÓRIO]'))
    .map(p => p.trim())
    .filter(p => p.length > 0);
};

const getAllChecklistItems = (observations: string | undefined): { label: string; isRequired: boolean }[] => {
  const required = extractRequiredOptions(observations).map(label => ({ label, isRequired: true }));
  const optional = extractOptionalObservations(observations).map(label => ({ label, isRequired: false }));
  return [...required, ...optional];
};

const formatOrderPin = (pin: string) => {
  const raw = String(pin ?? '').trim()
  if (!raw) return '#-'
  return `#${raw.replace(/^#+/, '')}`
}

function OrderCardComponent({ 
  order, 
  operators, 
  categories,
  onUpdateStatus, 
  onCancelOrder, 
  onAssignOperator, 
  onAssignOperatorToAll,
  onUpdateItemStatus
}: OrderCardProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelPassword, setCancelPassword] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [showAssignOperatorAlert, setShowAssignOperatorAlert] = useState(false);
  const [alertModalMessage, setAlertModalMessage] = useState('');
  
  const [isCollapsed, setIsCollapsed] = useState(() => order.status === 'NEW' || order.status === 'READY'); 
  const expandedItemsRef = useRef<Record<string, boolean>>({});
  const [forceUpdate, setForceUpdate] = useState(false);
  // Botão para alternar exibição de itens de entrega direta
  const [showDirectItems, setShowDirectItems] = useState(false);
  // Modal de checklist para entrega direta antes de marcar como entregue
  const [showDirectDeliveryModal, setShowDirectDeliveryModal] = useState(false);
  const [directDeliveryChecks, setDirectDeliveryChecks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isCollapsed) {
      if (Object.keys(expandedItemsRef.current).length === 0) {
        const initialExpanded: Record<string, boolean> = {};
        // Expandir apenas itens que passam pela cozinha
        const kitchenItems = order.items.filter(i => !i.skipKitchen);
        kitchenItems.forEach(item => {
          // Expandir itens com observações ou múltiplas unidades por padrão quando o card é expandido
          if (item.observations || item.quantity > 1) {
            initialExpanded[item.id] = true;
          }
        });
        expandedItemsRef.current = initialExpanded;
      }
    }
  }, [isCollapsed, order.items]);

  const toggleItemCollapse = (itemId: string) => {
    expandedItemsRef.current = {
      ...expandedItemsRef.current,
      [itemId]: !expandedItemsRef.current[itemId]
    };
    setForceUpdate(prev => !prev); // Força a re-renderização
  };
  
  const isTimerActive = order.status === 'NEW' || order.status === 'PREPARING';
  const { timeElapsed, isOverdue, formatTime } = useTimer(order.createdAt, order.slaMinutes, isTimerActive);

  const categoryMap = useMemo(() => {
    return categories.reduce((map, category) => {
      map[category.id] = category.name;
      return map;
    }, {} as Record<string, string>);
  }, [categories]);
  
  // Considerar somente itens que passam pela cozinha
  const kitchenItems = useMemo(() => order.items.filter(item => !item.skipKitchen), [order.items]);
  
  // NOVO: Itens de entrega direta (não passam pela cozinha)
  const directItems = useMemo(() => {
    return order.items.filter(item => item.skipKitchen || item.menuItem?.skipKitchen);
  }, [order.items]);

  const assignedOperators = useMemo(() => {
    const operatorNames = new Set<string>();
    kitchenItems.forEach(item => {
      (item.productionUnits || []).forEach(unit => {
        if (unit.operatorName) operatorNames.add(unit.operatorName);
      });
    });
    return Array.from(operatorNames);
  }, [kitchenItems]);

  const allUnitsOperator = useMemo(() => {
    const allUnits = kitchenItems.flatMap(item => item.productionUnits || []);
    if (allUnits.length === 0) return null;
    const firstOperator = allUnits[0].operatorName;
    if (!firstOperator) return null;
    const allSame = allUnits.every(unit => unit.operatorName === firstOperator);
    return allSame ? firstOperator : null;
  }, [kitchenItems]);

  useEffect(() => {
    if (operators.length === 1 && order.status === 'NEW') {
      const needsAssignment = kitchenItems.some(item => 
        (item.productionUnits || []).some(unit => !unit.operatorName)
      );
      if (needsAssignment) {
        onAssignOperatorToAll(order.id, operators[0].name);
      }
    }
  }, [order.id, order.status, operators, kitchenItems, onAssignOperatorToAll]);
  
  const getNextStatus = (currentStatus: Order['status']): Order['status'] | null => {
    switch (currentStatus) {
      case 'NEW': return 'PREPARING';
      case 'PREPARING': return 'READY'; 
      case 'READY': return 'DELIVERED';
      default: return null;
    }
  };

  const getPreviousStatus = (currentStatus: Order['status']): Order['status'] | null => {
    switch (currentStatus) {
      case 'PREPARING': return 'NEW';
      case 'READY': return 'PREPARING';
      case 'DELIVERED': return 'READY';
      default: return null;
    }
  };

  const getStatusAction = (status: Order['status']) => {
    switch (status) {
      case 'NEW': return 'Iniciar Preparo';
      case 'PREPARING': return 'Pronto'; 
      case 'READY': return 'Entregue';
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

  const getPreviousStatusAction = (status: Order['status']) => {
    switch (status) {
      case 'PREPARING': return 'Voltar';
      case 'READY': return 'Voltar';
      case 'DELIVERED': return 'Voltar';
      default: return null;
    }
  };
  
  const isOrderReadyForNextStep = useMemo(() => {
    return kitchenItems.every(item => 
      (item.productionUnits || []).every(unit => {
          const isReady = unit.unitStatus === 'READY';
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

  const handleMainAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = getNextStatus(order.status);
    if (!nextStatus) return;

    if (order.status === 'NEW' && nextStatus === 'PREPARING') {
      if (operators.length === 0) {
        setAlertModalMessage('Não há operadores cadastrados. Adicione um operador para iniciar o preparo.');
        setShowAssignOperatorAlert(true);
        return;
      }
      const allAssigned = kitchenItems.every(item => 
        (item.productionUnits || []).every(unit => !!unit.operatorName)
      );
      if (!allAssigned) {
        setAlertModalMessage('É necessário atribuir um operador a todas as unidades antes de iniciar o preparo.');
        setShowAssignOperatorAlert(true);
        return;
      }
    }
    if (order.status === 'PREPARING' && nextStatus === 'READY') {
      if (!isOrderReadyForNextStep) {
        setAlertModalMessage('Todas as unidades de produção devem ser marcadas como "Pronto" e todos os itens do checklist (opções obrigatórias e observações) devem ser checados.');
        setShowAssignOperatorAlert(true);
        return;
      }
    }
    // Intercepta READY -> DELIVERED quando há entrega direta
    if (order.status === 'READY' && nextStatus === 'DELIVERED') {
      if (directItems.length > 0) {
        // Prepara checklist inicial (não marcado)
        const initialChecks: Record<string, boolean> = {};
        directItems.forEach(di => { initialChecks[di.id] = !!directDeliveryChecks[di.id]; });
        setDirectDeliveryChecks(initialChecks);
        setShowDirectDeliveryModal(true);
        return;
      }
    }
    onUpdateStatus(order.id, nextStatus);
  };
  
  const handleUnitReadyToggle = (e: React.MouseEvent, itemId: string, unitId: string, isReady: boolean) => {
    e.stopPropagation();
    const newStatus = isReady ? 'READY' : 'PENDING';
    const item = order.items.find(i => i.id === itemId);
    const unit = item?.productionUnits.find(u => u.unitId === unitId);
    if (isReady) {
      const allChecklistItems = getAllChecklistItems(item?.observations);
      const allChecklistCompleted = allChecklistItems.length === 0 || 
        (unit?.completedObservations && unit.completedObservations.length === allChecklistItems.length);
      if (allChecklistItems.length > 0 && !allChecklistCompleted) {
        setAlertModalMessage('Complete todos os itens do checklist (opções obrigatórias e observações) antes de marcar a unidade como pronta.');
        setShowAssignOperatorAlert(true);
        return;
      }
    }
    const completedObservations = isReady ? unit?.completedObservations : [];
    onUpdateItemStatus(order.id, itemId, unitId, newStatus, completedObservations);
  };
  
  const handleObservationToggle = (e: React.ChangeEvent<HTMLInputElement>, itemId: string, unitId: string, observationLabel: string, isChecked: boolean) => {
    e.stopPropagation();
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
    const allChecklistItems = getAllChecklistItems(item.observations);
    const allObsCompleted = allChecklistItems.length === newCompletedObservations.length;
    let newUnitStatus = unit.unitStatus;
    if (unit.unitStatus === 'READY' && !allObsCompleted) {
      newUnitStatus = 'PENDING';
    }
    onUpdateItemStatus(order.id, itemId, unitId, newUnitStatus, newCompletedObservations);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const formatTimeDisplay = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };
  
  const { totalTimeSeconds, wasLate } = calculateProductionTimeStatus(order);
  const timeToDisplay = order.status === 'READY' || order.status === 'DELIVERED' ? formatTime(totalTimeSeconds) : formatTime(timeElapsed);
  const isCurrentlyOverdue = order.status === 'READY' || order.status === 'DELIVERED' ? wasLate : isOverdue;

  const nextStatusAction = getStatusAction(order.status);
  const isActiveOrder = order.status === 'NEW' || order.status === 'PREPARING' || order.status === 'READY';
  const showPreviousButton = getPreviousStatus(order.status) && order.status !== 'PREPARING' && order.status !== 'READY';
  const isPreparingStatus = order.status === 'PREPARING';
  const showUnitReadyButton = isPreparingStatus;
  const isOperatorAssignmentDisabled = order.status !== 'NEW'; 
  const isChecklistDisabled = !isPreparingStatus;
  const hasObservations = kitchenItems.some(item => item.observations);
  const isOrderReadyForNextStepStatus = isOrderReadyForNextStep;

  return (
    <>
      <div className={`bg-white rounded-lg border-2 p-4 shadow-sm transition-all ${
        isCurrentlyOverdue && (order.status === 'NEW' || order.status === 'PREPARING')
          ? 'border-red-500 bg-red-50 shadow-lg ring-2 ring-red-200 animate-pulse' 
          : 'border-gray-200'
      }`}>
        <div 
          className="cursor-pointer pb-3" 
          onClick={() => setIsCollapsed(prev => !prev)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3 min-w-0">
              <span className="text-xs font-medium text-gray-600">{formatOrderPin(order.pin)}</span>
              <span className="bg-blue-500 text-white text-lg font-bold px-3 py-1 rounded-lg flex-shrink-0">
                {order.password}
              </span>
              {assignedOperators.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {assignedOperators.map(opName => (
                    <span key={opName} className="text-xs font-medium bg-amber-300 text-amber-900 px-2 py-0.5 rounded-full">
                      <i className="ri-user-line mr-1"></i>
                      {opName}
                    </span>
                  ))}
                </div>
              )}
              {order.customerWhatsApp && (
                <span className="text-green-600 text-sm hidden sm:inline truncate">
                  <i className="ri-whatsapp-line mr-1"></i>
                  {order.customerWhatsApp}
                </span>
              )}
            </div>
            <i className={`ri-arrow-${isCollapsed ? 'down' : 'up'}-s-line text-xl text-gray-500 flex-shrink-0`}></i>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <i className="ri-time-line text-gray-500"></i>
                <span className={`font-bold ${isCurrentlyOverdue ? 'text-red-600' : 'text-blue-600'}`}>
                  {timeToDisplay}
                </span>
              </div>
              <div className="text-gray-500">
                SLA: {formatTimeDisplay(order.slaMinutes)}
              </div>
              {directItems.length > 0 && (
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setShowDirectDeliveryModal(true);
                  }}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 hover:text-purple-800"
                  title={'Ver Entrega Direta'}
                >
                  <i className="ri-truck-line mr-1"></i>
                  {`Entrega Direta (${directItems.length})`}
                </button>
              )}
            </div>
            {(order.status === 'NEW' || order.status === 'PREPARING' || order.status === 'READY') && (
              <span className={`text-white text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                isCurrentlyOverdue ? 'bg-red-600' : 'bg-green-600'
              }`}>
                {isCurrentlyOverdue ? 'ATRASADO' : 'NO PRAZO'}
              </span>
            )}
          </div>
        </div>
        
        {!isCollapsed && (
          <div className="pt-3 border-t border-gray-200">
            {operators.length > 0 && !isOperatorAssignmentDisabled && (
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-600 block mb-2">Atribuir a todas as unidades</label>
                <div className="flex flex-wrap gap-2">
                  {operators.map(op => (
                    <Button
                      key={op.id}
                      size="md"
                      variant={allUnitsOperator === op.name ? 'primary' : 'secondary'}
                      className={`text-sm px-3 py-1.5 ${
                        allUnitsOperator === op.name 
                          ? '!bg-amber-500 !text-white !font-semibold hover:!bg-amber-600'
                          : ''
                      }`}
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

            <div className="space-y-3 mb-4">
              {kitchenItems.map((item) => {
                const categoryName = categoryMap[item.menuItem.categoryId] || 'Sem Categoria';
                const isSingleUnit = item.quantity === 1;
                const isItemExpanded = expandedItemsRef.current[item.id]; // Usar o estado real de expansão
                const totalUnits = item.productionUnits.length;
                const readyUnits = item.productionUnits.filter(unit => unit.unitStatus === 'READY').length;
                const pendingUnits = totalUnits - readyUnits;
                const isItemReady = pendingUnits === 0;
                const assignedUnits = item.productionUnits.filter(unit => !!unit.operatorName).length;
                const assignedPendingUnits = totalUnits - assignedUnits;
                const requiredOptions = extractRequiredOptions(item.observations);
                const optionalObservations = extractOptionalObservations(item.observations);
                const hasObservationsItem = requiredOptions.length > 0 || optionalObservations.length > 0;
                const allChecklistItems = getAllChecklistItems(item.observations);
                
              return (
                <div key={item.id} className={`border-l-4 pl-3 p-2 rounded-r-lg transition-colors border-amber-400`}>
                  <div 
                    className={`font-medium flex items-center justify-between cursor-pointer p-2 rounded-lg border transition-colors text-white ${
                      order.status === 'NEW' 
                        ? (assignedUnits === totalUnits ? 'bg-blue-500 hover:bg-blue-600 border-blue-500' : 'bg-gray-500 hover:bg-gray-600 border-gray-500')
                        : (isItemReady ? 'bg-green-500 hover:bg-green-600 border-green-500' : 'bg-amber-500 hover:bg-amber-600 border-amber-500')
                    }`}
                    onClick={() => toggleItemCollapse(item.id)} // Corrigido para expandir/recolher o item
                  >
                    <div className="flex-1 min-w-0 pr-2 flex items-center">
                      <span className="mx-1 text-amber-100 text-xs font-normal">[{categoryName}]</span>
                      <span className="text-sm">{item.menuItem.name}</span>
                      <span className="text-xs text-amber-100 ml-2">({item.quantity} {item.quantity === 1 ? 'unid.' : 'unid.'})</span>
                      {/* Ícone de entrega direta por item removido conforme solicitação */}
                      {order.status === 'NEW' ? (
                        assignedUnits === totalUnits ? (
                          <i className="ri-user-check-line text-white ml-3 text-base" title="Todas as unidades atribuídas"></i>
                        ) : (
                          <span className="text-xs font-bold bg-white text-gray-600 px-2 py-0.5 rounded-full ml-3 flex-shrink-0">
                            {assignedPendingUnits} PENDENTE{assignedPendingUnits > 1 ? 'S' : ''}
                          </span>
                        )
                      ) : (
                        isItemReady ? (
                          <i className="ri-check-double-line text-white ml-3 text-base" title="Todas as unidades prontas"></i>
                        ) : (
                          <span className="text-xs font-bold bg-white text-amber-600 px-2 py-0.5 rounded-full ml-3 flex-shrink-0">
                            {pendingUnits} PENDENTE{pendingUnits > 1 ? 'S' : ''}
                          </span>
                        )
                      )}
                      {!isItemExpanded && hasObservationsItem && (
                        <i className="ri-alert-line text-white ml-2 text-base"></i>
                      )}
                    </div>
                    <i className={`ri-arrow-${isItemExpanded ? 'up' : 'down'}-s-line text-xl text-white flex-shrink-0`}></i> {/* Seta dinâmica */}
                  </div>
                    
                    {isItemExpanded && requiredOptions.length > 0 && (
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
                    
                    {isItemExpanded && optionalObservations.length > 0 && (
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
                    
                    {isItemExpanded && (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        {!isSingleUnit && <h5 className="text-xs font-medium text-gray-700 mb-2">Rastreamento por Unidade:</h5>}
                        {(item.productionUnits || []).map((unit, unitIndex) => {
                          const isUnitReady = unit.unitStatus === 'READY';
                          const unitOperator = unit.operatorName;
                          const allChecklistItemsUnit = getAllChecklistItems(item.observations);
                          const allChecklistCompleted = allChecklistItemsUnit.length === 0 || 
                            (unit.completedObservations && unit.completedObservations.length === allChecklistItemsUnit.length);
                          const disableReadyButton = !isUnitReady && allChecklistItemsUnit.length > 0 && !allChecklistCompleted;

                          return (
                            <div key={unit.unitId} className={`p-2 rounded-lg border transition-colors ${isUnitReady ? 'bg-green-100 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">
                                  Unidade {isSingleUnit ? 'Única' : unitIndex + 1}: 
                                  <span className={`ml-1 font-bold ${isUnitReady ? 'text-green-700' : 'text-gray-700'}`}>
                                    {isUnitReady ? 'Pronto' : 'Pendente'}
                                  </span>
                                </span>
                                {showUnitReadyButton && (
                                  <Button
                                    size="md"
                                    variant={isUnitReady ? 'success' : 'primary'}
                                    onClick={(e) => handleUnitReadyToggle(e, item.id, unit.unitId, !isUnitReady)}
                                    className={`ml-2 flex-shrink-0 ${isUnitReady ? '' : 'bg-green-500 text-white hover:bg-green-600'}`}
                                    title={isUnitReady ? 'Marcar como Pendente' : 'Marcar como Pronto'}
                                    disabled={disableReadyButton}
                                  >
                                    <i className={`mr-1 ${isUnitReady ? 'ri-checkbox-circle-line' : 'ri-check-line'}`}></i>
                                    {isUnitReady ? 'Pronto' : 'Marcar Pronto'}
                                  </Button>
                                )}
                              </div>
                              
                              {allChecklistItemsUnit.length > 0 && (
                                <div className="mt-3 pt-2 border-t border-gray-200 space-y-1">
                                  <h6 className="text-xs font-medium text-gray-700 mb-2">Checklist de Conferência:</h6>
                                  {allChecklistItemsUnit.map((obs, obsIndex) => {
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
                              
                              <div className="mt-2 flex items-center space-x-2">
                                <i className="ri-user-line text-gray-500 flex-shrink-0"></i>
                                {isOperatorAssignmentDisabled ? (
                                  unitOperator ? (
                                    <span className="text-sm font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded">
                                      {unitOperator}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-gray-500">Não Atribuído</span>
                                  )
                                ) : (
                                  operators.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 min-w-0">
                                      {operators.map(op => (
                                        <button
                                          key={op.id}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (order.status !== 'NEW') return;
                                            const newOperatorName = unitOperator === op.name ? '' : op.name;
                                            onAssignOperator(order.id, item.id, unit.unitId, newOperatorName);
                                          }}
                                          className={`px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap pointer-events-auto ${
                                            unitOperator === op.name
                                              ? 'bg-amber-300 !text-amber-900 !font-semibold hover:!bg-amber-400'
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
                              
                              {unit.completedAt && (
                                <div className="mt-2 text-xs text-green-700 font-medium">
                                  Concluído às: {new Date(unit.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Removido: botão de toggle e lista informativa de entrega direta */}
            </div>

          </div>
        )}

        {/* Modal informativo de itens de entrega direta (sempre renderizado, independente do colapso) */}
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

        {(isActiveOrder || order.status === 'CANCELLED' || order.status === 'DELIVERED') ? (
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
              <div className="flex flex-wrap gap-3">
                {nextStatusAction && (
                  <Button
                    onClick={handleMainAction}
                    className="flex-1 min-w-[48%] text-base"
                    size="md"
                    variant={getActionVariant(order.status)}
                    disabled={(order.status === 'NEW' && (operators.length === 0 || !allUnitsAssignedStatus)) || (order.status === 'PREPARING' && !isOrderReadyForNextStepStatus)} 
                  >
                    {order.status === 'NEW' ? (<><i className="ri-play-line mr-2"></i>Iniciar Preparo</>) : order.status === 'PREPARING' ? (<><i className="ri-check-line mr-2"></i>Pronto</>) : (<><i className="ri-truck-line mr-2"></i>Entregue</>)}
                  </Button>
                )}
                {showPreviousButton && (
                  <Button
                    variant="secondary"
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(order.id, getPreviousStatus(order.status)!); }}
                    className="flex-1 min-w-[48%] text-base"
                    size="md"
                  >
                    {getPreviousStatusAction(order.status)}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={(e) => { e.stopPropagation(); setShowCancelModal(true); }}
                  className="flex-1 min-w-[48%] text-base bg-red-50 text-red-600 hover:bg-red-100"
                  size="md"
                >
                  <i className="ri-close-circle-line mr-2"></i>Cancelar
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

export default memo(OrderCardComponent);
