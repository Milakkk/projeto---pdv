import { useState, useMemo, useRef, memo } from 'react';
import type { Order, KitchenOperator, ProductionUnit } from '../../../types';
import Button from '../../../components/base/Button';
import Modal from '../../../components/base/Modal';
import Input from '../../../components/base/Input';
import VirtualKeyboard from '../../../components/base/VirtualKeyboard';
import { useTimer } from '../../../hooks/useTimer';
import AlertModal from '../../../components/base/AlertModal';

interface OrderCardProps {
  order: Order;
  operators: KitchenOperator[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
  onCancelOrder: (orderId: string, reason: string) => void;
  onAssignOperator: (orderId: string, itemId: string, unitId: string, operatorName: string) => void;
  onAssignOperatorToAll: (orderId: string, operatorName: string) => void;
  onUpdateItemStatus: (orderId: string, itemId: string, unitId: string, itemStatus: ProductionUnit['unitStatus'], completedObservations?: string[]) => void;
}

const calculateProductionTimeStatus = (order: Order) => {
  const startTime = new Date(order.createdAt).getTime();
  const endTime = order.status === 'READY' || order.status === 'DELIVERED' ? new Date(order.updatedAt || order.createdAt).getTime() : Date.now();
  const totalTimeSeconds = Math.floor((endTime - startTime) / 1000);
  return { totalTimeSeconds };
};

const getAllChecklistItems = (observations: string | undefined): { label: string; isRequired: boolean }[] => {
  if (!observations) return [];
  const parts = observations.split(', ');
  return parts.map(p => ({
    label: p.replace('[OBRIGATÓRIO]', '').trim(),
    isRequired: p.startsWith('[OBRIGATÓRIO]')
  })).filter(p => p.label.length > 0);
};

const formatOrderPin = (pin: string) => {
  const raw = String(pin ?? '').trim();
  if (!raw) return '#-';
  return `#${raw.replace(/^#+/, '')}`;
}

function OrderCardComponent({
  order,
  operators,
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
  const [, setForceUpdate] = useState(false);

  // Teclado Virtual
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardField, setKeyboardField] = useState<'reason' | 'password' | null>(null);

  const toggleItemCollapse = (itemId: string) => {
    expandedItemsRef.current = {
      ...expandedItemsRef.current,
      [itemId]: !expandedItemsRef.current[itemId]
    };
    setForceUpdate(prev => !prev);
  };

  const isTimerActive = order.status === 'NEW' || order.status === 'PREPARING';
  const { timeElapsed, isOverdue, formatTime } = useTimer(order.createdAt, order.slaMinutes, isTimerActive);

  const kitchenItems = useMemo(() => order.items.filter(item => !item.skipKitchen), [order.items]);

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
    return allUnits.every(unit => unit.operatorName === firstOperator) ? firstOperator : null;
  }, [kitchenItems]);

  const allUnitsAssignedStatus = useMemo(() => {
    return kitchenItems.every(item =>
      (item.productionUnits || []).every(unit => !!unit.operatorName)
    );
  }, [kitchenItems]);

  const getNextStatus = (currentStatus: Order['status']): Order['status'] | null => {
    switch (currentStatus) {
      case 'NEW': return 'PREPARING';
      case 'PREPARING': return 'READY';
      case 'READY': return 'DELIVERED';
      default: return null;
    }
  };

  const getStatusAction = (status: Order['status']) => {
    if (status === 'NEW') return 'Iniciar';
    if (status === 'PREPARING') return 'Pronto';
    if (status === 'READY') return 'Entregue';
    return null;
  };

  const isOrderReadyForNextStep = useMemo(() => {
    return kitchenItems.every(item =>
      (item.productionUnits || []).every(unit => {
        const isReady = unit.unitStatus === 'READY';
        const checklist = getAllChecklistItems(item.observations);
        return isReady && (checklist.length === 0 || (unit.completedObservations?.length === checklist.length));
      })
    );
  }, [kitchenItems]);

  const handleMainAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = getNextStatus(order.status);
    if (!nextStatus) return;

    if (order.status === 'NEW') {
      if (operators.length === 0) {
        setAlertModalMessage('Adicione um operador antes de iniciar.');
        setShowAssignOperatorAlert(true);
        return;
      }
      if (!allUnitsAssignedStatus) {
        setAlertModalMessage('Atribua operadores a todas as unidades.');
        setShowAssignOperatorAlert(true);
        return;
      }
    }

    if (order.status === 'PREPARING' && !isOrderReadyForNextStep) {
      setAlertModalMessage('Conclua todas as unidades e checklists.');
      setShowAssignOperatorAlert(true);
      return;
    }

    onUpdateStatus(order.id, nextStatus);
  };

  const handleUnitReadyToggle = (e: React.MouseEvent, itemId: string, unitId: string, isReady: boolean) => {
    e.stopPropagation();
    const item = order.items.find(i => i.id === itemId);
    const unit = item?.productionUnits.find(u => u.unitId === unitId);
    if (isReady) {
      const checklist = getAllChecklistItems(item?.observations);
      if (checklist.length > 0 && (unit?.completedObservations?.length || 0) < checklist.length) {
        setAlertModalMessage('Complete o checklist primeiro.');
        setShowAssignOperatorAlert(true);
        return;
      }
    }
    onUpdateItemStatus(order.id, itemId, unitId, isReady ? 'READY' : 'PENDING', isReady ? unit?.completedObservations : []);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCancelError('');
    if (!cancelReason.trim()) {
      setCancelError('O motivo é obrigatório.');
      return;
    }
    if (cancelPassword !== '159753') {
      setCancelError('Senha incorreta!');
      setCancelPassword('');
      return;
    }
    onCancelOrder(order.id, cancelReason);
    setShowCancelModal(false);
    setCancelReason('');
    setCancelPassword('');
  };

  const { totalTimeSeconds } = calculateProductionTimeStatus(order);
  const timeToDisplay = order.status === 'READY' || order.status === 'DELIVERED' ? formatTime(totalTimeSeconds) : formatTime(timeElapsed);
  const isCurrentlyOverdue = (order.status === 'NEW' || order.status === 'PREPARING') && isOverdue;

  return (
    <>
      <div className={`bg-white rounded-xl border-2 shadow-sm transition-all flex flex-col overflow-hidden ${isCurrentlyOverdue ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-gray-100 hover:border-amber-200'
        }`}>
        {/* Header Compacto */}
        <div
          className="p-3 cursor-pointer flex items-center justify-between bg-white border-b border-gray-50"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-gray-400 leading-none mb-1">{formatOrderPin(order.pin)}</span>
              <span className="bg-amber-500 text-white text-lg font-black px-2 py-0.5 rounded-lg shadow-sm min-w-[40px] text-center">
                {order.password}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-lg font-black leading-none ${isCurrentlyOverdue ? 'text-red-600' : 'text-blue-600'}`}>
                  {timeToDisplay}
                </span>
                {isCurrentlyOverdue && <span className="bg-red-500 text-[10px] text-white font-bold px-1.5 py-0.5 rounded animate-pulse">ATRASADO</span>}
              </div>
              <div className="flex items-center gap-1 mt-1 overflow-hidden">
                {assignedOperators.length > 0 ? assignedOperators.map(op => (
                  <span key={op} className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap">
                    {op}
                  </span>
                )) : <span className="text-[9px] text-gray-400 font-medium">Sem operador</span>}
              </div>
            </div>
          </div>
          <i className={`ri-arrow-${isCollapsed ? 'down' : 'up'}-s-line text-xl text-gray-400`}></i>
        </div>

        {/* Conteúdo Expandido Compacto */}
        {!isCollapsed && (
          <div className="p-2 space-y-2 bg-gray-50/30">
            {/* Atربuição Rápida */}
            {order.status === 'NEW' && operators.length > 0 && (
              <div className="flex flex-wrap gap-1 p-1.5 bg-white rounded-lg border border-gray-100 shadow-sm">
                {operators.map(op => (
                  <button
                    key={op.id}
                    onClick={(e) => { e.stopPropagation(); onAssignOperatorToAll(order.id, allUnitsOperator === op.name ? '' : op.name); }}
                    className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${allUnitsOperator === op.name ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                  >
                    {op.name}
                  </button>
                ))}
              </div>
            )}

            {/* Lista de Itens */}
            <div className="space-y-1">
              {kitchenItems.map(item => {
                const isItemExpanded = expandedItemsRef.current[item.id];
                const totalUnits = item.productionUnits.length;
                const readyUnits = item.productionUnits.filter(u => u.unitStatus === 'READY').length;
                const checklist = getAllChecklistItems(item.observations);

                return (
                  <div key={item.id} className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                    <div
                      className={`p-2 flex items-center justify-between cursor-pointer ${readyUnits === totalUnits ? 'bg-green-50 text-green-700' : 'bg-white'
                        }`}
                      onClick={(e) => { e.stopPropagation(); toggleItemCollapse(item.id); }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-black text-xs text-gray-400">{item.quantity}x</span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold truncate pr-1">{item.menuItem.name}</span>
                          {checklist.length > 0 && !isItemExpanded && (
                            <span className="text-[9px] text-amber-600 font-bold">Checklist pendente</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {readyUnits === totalUnits ? (
                          <i className="ri-checkbox-circle-fill text-green-500 text-base"></i>
                        ) : (
                          <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-black">
                            {readyUnits}/{totalUnits}
                          </span>
                        )}
                      </div>
                    </div>

                    {isItemExpanded && (
                      <div className="p-2 border-t border-gray-50 space-y-2 bg-gray-50/50">
                        {checklist.length > 0 && (
                          <div className="space-y-1">
                            {checklist.map((obs, idx) => (
                              <div key={idx} className={`text-[10px] p-1.5 rounded-md flex items-center gap-2 ${obs.isRequired ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                                <i className={obs.isRequired ? 'ri-error-warning-fill' : 'ri-information-fill'}></i>
                                <span className="font-bold">{obs.label}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-1">
                          {item.productionUnits.map((unit, uIdx) => (
                            <div key={unit.unitId} className="flex items-center justify-between bg-white p-1.5 rounded-md border border-gray-50">
                              <span className="text-[10px] font-bold text-gray-400">U{uIdx + 1}</span>
                              <div className="flex gap-1">
                                {order.status === 'NEW' && operators.map(op => (
                                  <button
                                    key={op.id}
                                    onClick={(e) => { e.stopPropagation(); onAssignOperator(order.id, item.id, unit.unitId, unit.operatorName === op.name ? '' : op.name); }}
                                    className={`text-[9px] font-black px-1.5 py-0.5 rounded ${unit.operatorName === op.name ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400'
                                      }`}
                                  >
                                    {op.name}
                                  </button>
                                ))}
                                {order.status === 'PREPARING' && (
                                  <button
                                    onClick={(e) => handleUnitReadyToggle(e, item.id, unit.unitId, unit.unitStatus !== 'READY')}
                                    className={`text-[9px] font-black px-2 py-1 rounded shadow-sm transition-all ${unit.unitStatus === 'READY' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-green-100'
                                      }`}
                                  >
                                    {unit.unitStatus === 'READY' ? 'PRONTO' : 'MARCAR PRONTO'}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rodapé com Botões de Ação */}
        <div className="p-2 bg-white border-t border-gray-50 flex gap-1.5">
          {getStatusAction(order.status) && (
            <button
              onClick={handleMainAction}
              disabled={(order.status === 'NEW' && !allUnitsAssignedStatus) || (order.status === 'PREPARING' && !isOrderReadyForNextStep)}
              className={`flex-[2] py-2.5 rounded-lg text-xs font-black shadow-sm transition-all ${order.status === 'NEW' ? 'bg-blue-600 text-white active:bg-blue-700' : 'bg-green-600 text-white active:bg-green-700'
                } disabled:opacity-50 disabled:grayscale`}
            >
              <i className={`${order.status === 'NEW' ? 'ri-play-fill' : 'ri-check-fill'} mr-1`}></i>
              {getStatusAction(order.status)}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setShowCancelModal(true); }}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold text-red-500 bg-red-50 border border-red-100 active:bg-red-100"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Modal Cancelamento com Keyboard */}
      <Modal isOpen={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancelar Pedido" size="sm">
        <div className="p-2 space-y-4">
          <Input
            label="Motivo *"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            showKeyboard
            onKeyboardClick={() => { setKeyboardField('reason'); setShowKeyboard(true); }}
            placeholder="Ex: Erro no pedido"
          />
          <Input
            label="Senha *"
            type="password"
            value={cancelPassword}
            onChange={(e) => setCancelPassword(e.target.value)}
            showKeyboard
            onKeyboardClick={() => { setKeyboardField('password'); setShowKeyboard(true); }}
            error={cancelError}
            placeholder="*****"
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowCancelModal(false)} className="flex-1">Voltar</Button>
            <Button variant="danger" onClick={handleCancel} className="flex-1">Confirmar</Button>
          </div>
        </div>
      </Modal>

      <VirtualKeyboard
        isVisible={showKeyboard}
        onInput={(v) => {
          if (keyboardField === 'reason') setCancelReason(prev => prev + v);
          if (keyboardField === 'password') setCancelPassword(prev => prev + v);
        }}
        onBackspace={() => {
          if (keyboardField === 'reason') setCancelReason(prev => prev.slice(0, -1));
          if (keyboardField === 'password') setCancelPassword(prev => prev.slice(0, -1));
        }}
        onClear={() => {
          if (keyboardField === 'reason') setCancelReason('');
          if (keyboardField === 'password') setCancelPassword('');
        }}
        onClose={() => setShowKeyboard(false)}
        layout={keyboardField === 'password' ? 'numeric' : 'alphabetic'}
      />

      <AlertModal
        isOpen={showAssignOperatorAlert}
        onClose={() => setShowAssignOperatorAlert(false)}
        title="Atenção"
        message={alertModalMessage}
      />
    </>
  );
}

const OrderCard = memo(OrderCardComponent);
export default OrderCard;
