import { useState, useMemo, useEffect, useRef, memo } from 'react';
import { Order, KitchenOperator, Category, OrderItem, ProductionUnit } from '../../../types';
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
      const allAssigned = order.items.every(item => 
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

  // Estilos CSS rígidos para card ultra-compacto
  const cardStyle: React.CSSProperties = {
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'white',
    borderRadius: '3px',
    border: `1px solid ${isCurrentlyOverdue ? '#f87171' : '#d1d5db'}`,
    fontSize: '9px',
  };

  const headerStyle: React.CSSProperties = {
    padding: '2px 3px',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    overflow: 'hidden',
    backgroundColor: isCurrentlyOverdue ? '#fee2e2' : '#f3f4f6',
    cursor: 'pointer',
  };

  const itemStyle = (isReady: boolean, isNew: boolean, assigned: boolean): React.CSSProperties => ({
    borderRadius: '2px',
    overflow: 'hidden',
    backgroundColor: isNew 
      ? (assigned ? '#3b82f6' : '#9ca3af')
      : (isReady ? '#22c55e' : '#f59e0b'),
    color: 'white',
  });

  return (
    <>
      <div style={cardStyle}>
        {/* Header: #PIN SENHA OP ▼ */}
        <div style={headerStyle} onClick={() => setIsCollapsed(prev => !prev)}>
          <span style={{ fontWeight: 'bold', color: '#374151' }}>#{order.pin}</span>
          <span style={{ backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', padding: '0 2px', borderRadius: '2px' }}>{order.password}</span>
          {assignedOperators.length > 0 && (
            <span style={{ color: '#b45309', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '25px' }}>{assignedOperators[0]}</span>
          )}
          <span style={{ marginLeft: 'auto', color: '#9ca3af' }}>{isCollapsed ? '▼' : '▲'}</span>
        </div>

        {/* Timer: 00:05 [OK] */}
        <div style={{ padding: '1px 3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e7eb' }}>
          <span style={{ fontWeight: 'bold', color: isCurrentlyOverdue ? '#dc2626' : '#2563eb' }}>{timeToDisplay}</span>
          <span style={{ backgroundColor: isCurrentlyOverdue ? '#dc2626' : '#22c55e', color: 'white', fontWeight: 'bold', padding: '0 2px', borderRadius: '2px' }}>
            {isCurrentlyOverdue ? '!' : '✓'}
          </span>
        </div>
        
        {/* Conteúdo expandido */}
        {!isCollapsed && (
          <div style={{ padding: '2px 3px', borderTop: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {/* Operadores (apenas para NEW) */}
            {operators.length > 0 && !isOperatorAssignmentDisabled && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px', marginBottom: '2px' }}>
                {operators.map(op => (
                  <button
                    key={op.id}
                    type="button"
                    style={{ 
                      fontSize: '8px', 
                      padding: '0 3px', 
                      borderRadius: '2px', 
                      border: 'none', 
                      cursor: 'pointer',
                      backgroundColor: allUnitsOperator === op.name ? '#f59e0b' : '#e5e7eb',
                      color: allUnitsOperator === op.name ? 'white' : '#4b5563',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAssignOperatorToAll(order.id, allUnitsOperator === op.name ? '' : op.name);
                    }}
                  >
                    {op.name}
                  </button>
                ))}
              </div>
            )}

            {/* Itens */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {kitchenItems.map((item) => {
                const isSingleUnit = item.quantity === 1;
                const isItemExpanded = expandedItemsRef.current[item.id];
                const totalUnits = item.productionUnits.length;
                const readyUnits = item.productionUnits.filter(unit => unit.unitStatus === 'READY').length;
                const pendingUnits = totalUnits - readyUnits;
                const isItemReady = pendingUnits === 0;
                const assignedUnits = item.productionUnits.filter(unit => !!unit.operatorName).length;
                const allChecklistItems = getAllChecklistItems(item.observations);
                
                return (
                  <div key={item.id} style={itemStyle(isItemReady, order.status === 'NEW', assignedUnits === totalUnits)}>
                    <div 
                      style={{ display: 'flex', alignItems: 'center', padding: '1px 3px', cursor: 'pointer', overflow: 'hidden' }}
                      onClick={() => toggleItemCollapse(item.id)}
                    >
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{item.menuItem.name}</span>
                      <span style={{ flexShrink: 0, marginLeft: '2px' }}>x{item.quantity}</span>
                      {!isItemReady && order.status !== 'NEW' && (
                        <span style={{ backgroundColor: 'white', color: '#d97706', padding: '0 2px', borderRadius: '2px', marginLeft: '2px', flexShrink: 0 }}>{pendingUnits}P</span>
                      )}
                      <span style={{ marginLeft: '2px', flexShrink: 0 }}>{isItemExpanded ? '▲' : '▼'}</span>
                    </div>
                      
                    {isItemExpanded && (
                      <div style={{ backgroundColor: 'white', padding: '1px 3px' }}>
                        {(item.productionUnits || []).map((unit, unitIndex) => {
                          const isUnitReady = unit.unitStatus === 'READY';
                          const allChecklistItemsUnit = getAllChecklistItems(item.observations);
                          const allChecklistCompleted = allChecklistItemsUnit.length === 0 || 
                            (unit.completedObservations && unit.completedObservations.length === allChecklistItemsUnit.length);
                          const disableReadyButton = !isUnitReady && allChecklistItemsUnit.length > 0 && !allChecklistCompleted;

                          return (
                            <div key={unit.unitId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1px 0' }}>
                              <span style={{ color: isUnitReady ? '#16a34a' : '#6b7280' }}>
                                {isSingleUnit ? 'Un' : `#${unitIndex + 1}`} {isUnitReady ? '✓' : '○'}
                              </span>
                              {showUnitReadyButton && (
                                <button
                                  type="button"
                                  onClick={(e) => handleUnitReadyToggle(e, item.id, unit.unitId, !isUnitReady)}
                                  style={{ 
                                    padding: '0 3px', 
                                    borderRadius: '2px', 
                                    border: 'none', 
                                    cursor: disableReadyButton ? 'not-allowed' : 'pointer',
                                    backgroundColor: isUnitReady ? '#22c55e' : '#dcfce7',
                                    color: isUnitReady ? 'white' : '#15803d',
                                    opacity: disableReadyButton ? 0.5 : 1,
                                  }}
                                  disabled={disableReadyButton}
                                >
                                  ✓
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Botões de ação */}
        {isActiveOrder && order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
          <div style={{ display: 'flex', gap: '2px', padding: '2px 3px', borderTop: '1px solid #e5e7eb' }}>
            {nextStatusAction && (
              <button
                type="button"
                onClick={handleMainAction}
                style={{ 
                  flex: 1, 
                  padding: '2px 0', 
                  borderRadius: '2px', 
                  border: 'none', 
                  cursor: 'pointer',
                  backgroundColor: order.status === 'PREPARING' ? '#22c55e' : '#3b82f6',
                  color: 'white',
                  fontWeight: 'bold',
                  opacity: ((order.status === 'NEW' && (operators.length === 0 || !allUnitsAssignedStatus)) || (order.status === 'PREPARING' && !isOrderReadyForNextStepStatus)) ? 0.4 : 1,
                }}
                disabled={(order.status === 'NEW' && (operators.length === 0 || !allUnitsAssignedStatus)) || (order.status === 'PREPARING' && !isOrderReadyForNextStepStatus)} 
              >
                ✓ Pronto
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowCancelModal(true); }}
              style={{ 
                flex: 1, 
                padding: '2px 0', 
                borderRadius: '2px', 
                border: 'none', 
                cursor: 'pointer',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                fontWeight: 'bold',
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Modal de entrega direta */}
      <Modal
        isOpen={showDirectDeliveryModal}
        onClose={() => setShowDirectDeliveryModal(false)}
        title="Itens de Entrega Direta"
        size="md"
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
          <Button variant="secondary" onClick={() => setShowDirectDeliveryModal(false)} className="w-full">Fechar</Button>
        </div>
      </Modal>

      <Modal
        isOpen={showCancelModal}
        onClose={handleCloseCancelModal}
        title="Cancelar Pedido"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Tem certeza que deseja cancelar o pedido #{order.pin}?
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
