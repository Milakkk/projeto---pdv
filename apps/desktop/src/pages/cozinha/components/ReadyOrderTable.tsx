import { useMemo, useState } from 'react';
import type { Order, MenuItem } from '../../../types';
import Button from '../../../components/base/Button';
import { useTimer } from '../../../hooks/useTimer'; // Importando useTimer
import { printOrder } from '../../../utils/print'; // Importando a função de impressão
import { useAuth } from '../../../context/AuthContext';
import Modal from '../../../components/base/Modal';

interface ReadyOrderTableProps {
  readyOrders: Order[];
  // Ação agora pode ser para marcar como entregue (embora o Caixa seja o principal) ou voltar
  onUpdateStatus: (orderId: string, status: Order['status']) => void; 
  // NOVO: Persistir progresso de entrega direta por item
  onUpdateDirectDelivery: (orderId: string, updates: { itemId: string; deliveredCount: number }[]) => void;
  // NOVO: Confirmar entrega diretamente na Cozinha sem abrir checklist do Caixa
  onConfirmDelivery?: (orderId: string) => void;
}

// Função auxiliar para formatar a duração (copiada de DeliveredOrderList)
const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  if (mins === 0 && secs === 0) return '0s';
  
  const parts = [];
  if (mins > 0) parts.push(`${mins.toString().padStart(2, '0')}m`);
  if (secs > 0) parts.push(`${secs.toString().padStart(2, '0')}s`);
  
  return parts.join(' ');
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

// Componente auxiliar para exibir o tempo de espera (tempo desde que ficou pronto)
function ReadyTimeStatus({ order }: { order: Order }) {
  // O timer deve medir o tempo desde que o status mudou para READY (usando readyAt ou updatedAt)
  const readyTime = order.readyAt ? new Date(order.readyAt) : (order.updatedAt ? new Date(order.updatedAt) : new Date(order.createdAt));
  
  // O timer é sempre ativo para medir o tempo de espera
  const { timeElapsed, formatTime } = useTimer(readyTime, 99999, true); 

  return (
    <div className="text-sm font-medium flex flex-col space-y-1">
      <span className="text-gray-600">Aguardando:</span>
      <span className="font-bold text-blue-700 text-lg">{formatTime(timeElapsed)}</span>
    </div>
  );
}

// Componente auxiliar para exibir o tempo de produção e SLA
function KitchenTimeStatus({ order }: { order: Order }) {
  const { totalTimeSeconds, wasLate, newTimeSeconds, preparingTimeSeconds } = useMemo(() => {
    const createdAt = new Date(order.createdAt).getTime();
    
    // Tempo de saída de NEW (início do preparo)
    const preparingStartTime = order.updatedAt && order.status !== 'NEW' 
      ? new Date(order.updatedAt).getTime() 
      : createdAt;
      
    // Tempo que ficou pronto (fim do preparo)
    // Usamos readyAt se existir, senão o tempo de início do preparo (se o pedido foi marcado como pronto imediatamente)
    const readyAtTime = order.readyAt ? new Date(order.readyAt).getTime() : preparingStartTime;
      
    // 1. Tempo Cozinha (Total NEW + PREPARING)
    const totalTimeSeconds = Math.floor((readyAtTime - createdAt) / 1000);
    const wasLate = (totalTimeSeconds / 60) > order.slaMinutes;
    
    // 2. Tempo de Espera (NEW)
    const newTimeSeconds = Math.floor((preparingStartTime - createdAt) / 1000);
    
    // 3. Tempo de Preparo (PREPARING Time): Tempo Cozinha - Tempo de Espera
    const preparingTimeSeconds = totalTimeSeconds - newTimeSeconds;
    
    return { 
      totalTimeSeconds: Math.max(0, totalTimeSeconds), 
      wasLate, 
      newTimeSeconds: Math.max(0, newTimeSeconds),
      preparingTimeSeconds: Math.max(0, preparingTimeSeconds),
    };
  }, [order]);

  return (
    <div className="text-sm font-medium flex flex-col space-y-1">
      <span className="text-gray-600">Tempo Cozinha:</span>
      <span className={`font-bold text-lg ${wasLate ? 'text-red-600' : 'text-green-600'}`}>
        {formatDuration(totalTimeSeconds)}
      </span>
      <span className="text-xs text-gray-500">
        Espera: {formatDuration(newTimeSeconds)}
      </span>
      <span className="text-xs text-gray-500">
        Preparo: {formatDuration(preparingTimeSeconds)}
      </span>
      <span className="text-xs text-gray-500">SLA: {order.slaMinutes}m</span>
    </div>
  );
}


export default function ReadyOrderTable({ readyOrders, onUpdateStatus, onUpdateDirectDelivery, onConfirmDelivery }: ReadyOrderTableProps) {
  const { store } = useAuth();
  const [showDirectDeliveryModal, setShowDirectDeliveryModal] = useState(false);
  const [modalDirectItems, setModalDirectItems] = useState<{ itemId: string; quantity: number; menuItem: MenuItem; deliveredCount: number }[]>([]);
  const [pendingDeliverOrderId, setPendingDeliverOrderId] = useState<string | null>(null);
  const [checklistUnitChecks, setChecklistUnitChecks] = useState<Record<string, boolean>>({});
  const [lockedUnitKeys, setLockedUnitKeys] = useState<Record<string, boolean>>({});
  
  // Ordenar pedidos prontos pelo tempo de espera (mais antigo primeiro)
  const sortedOrders = useMemo(() => {
    return [...readyOrders].sort((a, b) => {
      const timeA = new Date(a.readyAt || a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.readyAt || b.updatedAt || b.createdAt).getTime();
      return timeA - timeB;
    });
  }, [readyOrders]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 text-xl flex items-center">
          <i className="ri-check-line mr-2 text-green-600"></i>
          Pedidos Prontos para Retirada ({readyOrders.length})
        </h2>
      </div>

      {sortedOrders.length === 0 ? (
        <div className="p-8 text-center">
          <i className="ri-emotion-happy-line text-4xl text-gray-400 mb-4"></i>
          <p className="text-gray-500">Nenhum pedido pronto no momento.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  Pedido
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  Senha
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Pronto Desde
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Tempo Entrega
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Tempo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-96">
                  Itens & Produção
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedOrders.map((order) => {
                // Usamos readyAt se existir, caso contrário, usamos updatedAt (que é o tempo que ficou pronto)
                const readyTime = order.readyAt ? new Date(order.readyAt) : (order.updatedAt ? new Date(order.updatedAt) : new Date(order.createdAt));
                // Cálculo de entrega parcial por pedido (todas unidades de todos os itens)
                const totalUnitsSum = order.items.reduce((acc, di) => {
                  const unitsPerItem = Math.max(1, di.menuItem.unitDeliveryCount || 1);
                  return acc + Math.max(1, di.quantity * unitsPerItem);
                }, 0);
                const deliveredUnitsSum = order.items.reduce((acc, di) => {
                  const units = Array.isArray(di.productionUnits) ? di.productionUnits : [];
                  const deliveredPerItem = units.filter(u => !!u.deliveredAt || order.status === 'DELIVERED').length;
                  return acc + deliveredPerItem;
                }, 0);
                const isPartiallyDelivered = deliveredUnitsSum > 0 && deliveredUnitsSum < totalUnitsSum;
                
                return (
                  <tr key={order.id} className="hover:bg-green-50/50">
                    <td className="px-4 py-4 align-top">
                      <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-bold inline-block w-fit">
                        #{order.pin}
                      </span>
                      {isPartiallyDelivered && (
                        <div className="mt-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          entregue parcial {deliveredUnitsSum}/{totalUnitsSum}
                        </div>
                      )}
                    </td>
                    
                    <td className="px-4 py-4 align-top">
                      <div className="text-lg font-bold text-green-600">
                        {order.password}
                      </div>
                    </td>
                    
                    <td className="px-4 py-4 align-top text-sm text-gray-900">
                      <div className="text-xs text-gray-600">
                        {readyTime.toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-sm font-medium">
                        {readyTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    
                    <td className="px-4 py-4 align-top">
                      <ReadyTimeStatus order={order} />
                    </td>
                    
                    <td className="px-4 py-4 align-top">
                      <KitchenTimeStatus order={order} />
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-gray-900">
                      <div className="space-y-2">
                        {order.items.map((item, index) => {
                          const requiredOptions = extractRequiredOptions(item.observations);
                          const optionalObservations = extractOptionalObservations(item.observations);
                          const deliveredCountForItem = Array.isArray(item.productionUnits)
                            ? item.productionUnits.filter(u => !!u.deliveredAt || order.status === 'DELIVERED').length
                            : Math.max(0, item.directDeliveredUnitCount || 0);
                          const totalUnitsForItem = Math.max(1, item.quantity * Math.max(1, item.menuItem.unitDeliveryCount || 1));
                          const isItemPartiallyDelivered = deliveredCountForItem > 0 && deliveredCountForItem < totalUnitsForItem;
                          
                          return (
                            <div key={index} className="border border-gray-200 rounded-lg p-2 bg-white">
                              <div className="text-sm font-medium mb-1">
                                {item.quantity}x {item.menuItem.name}
                                {item.skipKitchen && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200 align-middle">
                                    <i className="ri-truck-line mr-1"></i>
                                    Entrega Direta
                                  </span>
                                )}
                                {/* Removido: chip "entregue" no nível do item */}
                                {isItemPartiallyDelivered && order.status !== 'DELIVERED' && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 align-middle">
                                    <i className="ri-time-line mr-1"></i>
                                    entregue parcial {deliveredCountForItem}/{totalUnitsForItem}
                                  </span>
                                )}
                              </div>
                              
                              {/* Opções Obrigatórias */}
                              {requiredOptions.length > 0 && (
                                <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded p-1.5 flex items-start mb-2">
                                  <i className="ri-checkbox-circle-line mr-1 mt-0.5 flex-shrink-0"></i>
                                  <span className="flex-1 font-medium">Opções: {requiredOptions.join(' | ')}</span>
                                </div>
                              )}
                              
                              {/* Observações Opcionais/Customizadas */}
                              {optionalObservations.length > 0 && (
                                <div className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-1.5 flex items-start mb-2">
                                  <i className="ri-alert-line mr-1 mt-0.5 flex-shrink-0"></i>
                                  <span className="flex-1">Obs: {optionalObservations.join(' | ')}</span>
                                </div>
                              )}
                              
                              {/* Detalhes de Produção por Unidade */}
                              {true && (
                              <div className="space-y-1">
                                {((item.productionUnits && item.productionUnits.length > 0) ? item.productionUnits : Array.from({ length: totalUnitsForItem }).map((_, idx) => ({ unitId: `direct-${idx}`, completedAt: undefined, operatorName: undefined, unitStatus: undefined as any }))).map((unit: any, unitIndex: number) => {
                                  const unitOperator = unit.operatorName;
                                  // CORREÇÃO: Usar unit.completedAt se existir, senão N/A
                                  const completionTime = unit.completedAt
                                    ? new Date(unit.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                    : 'N/A';
                                  // Indicação de entrega por unidade: usar timestamp por índice quando existir; senão, entregue quando o pedido estiver DELIVERED
                                  const deliveredTimesArr = item.directDeliveredUnitTimes || [];
                                  const isUnitDelivered = !!unit.deliveredAt || !!deliveredTimesArr[unitIndex] || (order.status === 'DELIVERED');
                                  // Exibir horário de entrega:
                                  // - Entrega direta: quando a unidade está entregue, usar timestamp por unidade ou fallback do pedido
                                  // - Itens de cozinha: quando o pedido inteiro está entregue, usar order.deliveredAt
                                  const shouldShowDeliveredTime = isUnitDelivered;
                                  const deliveredDate = shouldShowDeliveredTime
                                    ? (unit.deliveredAt ? new Date(unit.deliveredAt) : (deliveredTimesArr[unitIndex] || (order.status === 'DELIVERED' && order.deliveredAt ? new Date(order.deliveredAt) : undefined)))
                                    : undefined;
                                  const deliveredTime = deliveredDate
                                    ? new Date(deliveredDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                    : undefined;
                                  // Cor da bolinha para itens de entrega direta
                                  const directDotColor = item.skipKitchen ? (isUnitDelivered ? 'bg-green-500' : 'bg-amber-500') : '';
                                  
                                return (
                                    <div key={unit.unitId} className="flex justify-between text-xs text-gray-600">
                                      <div className="flex items-center space-x-1">
                                        {item.skipKitchen && (
                                          <span className={`w-2 h-2 rounded-full ${directDotColor}`}></span>
                                        )}
                                        <span className="font-medium">Unidade {item.quantity === 1 ? '' : unitIndex + 1}</span>
                                        {unitOperator && (
                                          <span className="text-blue-600 bg-blue-50 px-1 rounded">
                                            {unitOperator}
                                          </span>
                                        )}
                                        {isUnitDelivered && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800 border border-green-200">
                                            <i className="ri-check-line mr-1"></i>
                                            entregue
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center space-x-4">
                                        {!item.skipKitchen && (
                                          <span className="text-green-700 font-medium">
                                            Pronto às {completionTime}
                                          </span>
                                        )}
                                        {deliveredTime && (
                                          <span className="text-gray-700 font-medium">
                                            Entregue às {deliveredTime}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                );
                                })}
                              </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    
                    <td className="px-4 py-4 align-top space-y-2">
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => {
                          // Sempre abrir checklist de confirmação incluindo TODOS os itens do pedido
                          const itemsForModal = order.items.map(di => ({
                            itemId: di.id,
                            quantity: di.quantity,
                            menuItem: di.menuItem,
                            deliveredCount: Math.max(0, di.directDeliveredUnitCount || 0)
                          }));
                          const initialChecks: Record<string, boolean> = {};
                          const initialLocked: Record<string, boolean> = {};
                          itemsForModal.forEach(di => {
                            const delivered = di.deliveredCount;
                            for (let i = 0; i < delivered; i++) {
                              const key = `${di.itemId}-${i}`;
                              initialChecks[key] = true;
                              initialLocked[key] = true;
                            }
                          });
                          setModalDirectItems(itemsForModal);
                          setChecklistUnitChecks(initialChecks);
                          setLockedUnitKeys(initialLocked);
                          setPendingDeliverOrderId(order.id);
                          setShowDirectDeliveryModal(true);
                        }}
                        className="w-full"
                      >
                        <i className="ri-check-double-line mr-1"></i>
                        Entregue
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          printOrder(order, undefined, store?.name); // Chama a função de impressão
                        }}
                        className="w-full"
                      >
                        <i className="ri-printer-line mr-1"></i>
                        Imprimir
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de confirmação de entrega com checklist por unidade (todos itens) */}
      <Modal
        isOpen={showDirectDeliveryModal}
        onClose={() => setShowDirectDeliveryModal(false)}
        title="Confirmar Entrega"
        size="md"
        overlayClassName="bg-transparent"
      >
        <div className="space-y-4">
          {modalDirectItems.map((di, idx) => {
            const totalUnits = Math.max(1, di.quantity * Math.max(1, di.menuItem.unitDeliveryCount || 1));
            return (
              <div key={idx}>
                <div className="flex items-center text-sm text-gray-800 mb-2">
                  {di.menuItem.skipKitchen ? (
                    <i className="ri-truck-line text-purple-600 mr-2"></i>
                  ) : (
                    <i className="ri-restaurant-line text-green-600 mr-2"></i>
                  )}
                  {di.quantity}x {di.menuItem.name}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {Array.from({ length: totalUnits }).map((_, uIdx) => {
                    const key = `${di.itemId}-${uIdx}`;
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
                        <span>Unidade {uIdx + 1}</span>
                        <i className={checked ? 'ri-check-line' : 'ri-checkbox-blank-line'}></i>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="flex items-center space-x-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDirectDeliveryModal(false);
                setPendingDeliverOrderId(null);
                setModalDirectItems([]);
                setChecklistUnitChecks({});
                setLockedUnitKeys({});
              }}
              className="flex-1"
            >
              Fechar
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                if (!pendingDeliverOrderId) return;
                // Calcular entregas por item
                const updates = modalDirectItems.map(di => {
                  const totalUnits = Math.max(1, di.quantity * Math.max(1, di.menuItem.unitDeliveryCount || 1));
                  let checkedCount = 0;
                  for (let i = 0; i < totalUnits; i++) {
                    const key = `${di.itemId}-${i}`;
                    if (checklistUnitChecks[key]) checkedCount++;
                  }
                  return { itemId: di.itemId, deliveredCount: checkedCount };
                });
                onUpdateDirectDelivery(pendingDeliverOrderId, updates);
                // Se todos itens estiverem totalmente entregues, concluir pedido
                const allItemsCompleted = updates.every((u, idx) => {
                  const di = modalDirectItems[idx];
                  const totalUnits = Math.max(1, di.quantity * Math.max(1, di.menuItem.unitDeliveryCount || 1));
                  return u.deliveredCount >= totalUnits;
                });
                if (allItemsCompleted) {
                  if (onConfirmDelivery) {
                    onConfirmDelivery(pendingDeliverOrderId);
                  } else {
                    onUpdateStatus(pendingDeliverOrderId, 'DELIVERED');
                  }
                }
                setShowDirectDeliveryModal(false);
                setPendingDeliverOrderId(null);
                setModalDirectItems([]);
                setChecklistUnitChecks({});
                setLockedUnitKeys({});
              }}
              disabled={Object.values(checklistUnitChecks).every(v => !v)}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
