import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';
import type { Order } from '../../../types';
import { useMemo, useState } from 'react';
import { useTimer } from '../../../hooks/useTimer'; // Importando useTimer
import ActiveOrderDetailModal from './ActiveOrderDetailModal'; // Importando o novo modal

interface OrderTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOrders: Order[];
  onMarkAsDelivered: (orderId: string, mode?: 'all' | 'directOnly') => void;
}

const statusInfo = {
  NEW: { text: 'Novo', color: 'bg-gray-100 text-gray-800', icon: 'ri-file-list-line', order: 1 },
  PREPARING: { text: 'Preparando', color: 'bg-yellow-100 text-yellow-800', icon: 'ri-loader-4-line animate-spin', order: 2 },
  READY: { text: 'Pronto para Retirada', color: 'bg-green-100 text-green-800', icon: 'ri-check-line', order: 3 },
};

// Componente auxiliar para exibir o status do tempo
function OrderTimeStatus({ order }: { order: Order }) {
  const isTimerActive = order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
  
  // 1. Determinar o ponto de início e o tempo de atraso (SLA)
  let startTime: Date;
  let slaMinutes: number;
  let label: string;
  let baseTime: 'creation' | 'ready' = 'creation';

  if (order.status === 'READY') {
    // Tempo de espera para entrega (desde que ficou pronto)
    startTime = order.readyAt ? new Date(order.readyAt) : (order.updatedAt ? new Date(order.updatedAt) : new Date(order.createdAt));
    slaMinutes = 99999; // Não há SLA para esta fase, apenas contagem
    label = 'Aguardando:';
    baseTime = 'ready';
  } else {
    // Tempo total de cozinha (desde a criação)
    startTime = new Date(order.createdAt);
    slaMinutes = order.slaMinutes;
    label = order.status === 'NEW' ? 'Em Espera:' : 'Tempo Cozinha:';
    baseTime = 'creation';
  }
  
  // 2. Usar o useTimer com o ponto de início correto
  const { timeElapsed, isOverdue, formatTime } = useTimer(startTime, slaMinutes, isTimerActive);

  // 3. Calcular o status de atraso (sempre baseado no tempo total de cozinha)
  const { isOverdueTotal, totalKitchenTimeSeconds } = useMemo(() => {
    if (order.status === 'READY') {
      // Se está pronto, o tempo total de cozinha é fixo (até readyAt)
      const readyTimeMs = order.readyAt ? new Date(order.readyAt).getTime() : new Date(order.updatedAt || order.createdAt).getTime();
      const totalTimeSeconds = Math.floor((readyTimeMs - new Date(order.createdAt).getTime()) / 1000);
      const isOverdueTotal = (totalTimeSeconds / 60) > order.slaMinutes;
      return { isOverdueTotal, totalKitchenTimeSeconds: totalTimeSeconds };
    }
    // Se está NEW ou PREPARING, o tempo total de cozinha é o tempo decorrido do timer (que começa em createdAt)
    return { isOverdueTotal: isOverdue, totalKitchenTimeSeconds: timeElapsed };
  }, [order, isOverdue, timeElapsed]);


  // Se o pedido estiver pronto, mostramos o tempo total de cozinha (fixo) e o tempo de espera (correndo)
  if (order.status === 'READY') {
    return (
      <div className="text-xs font-medium flex flex-col space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Cozinha:</span>
          <span className={`font-bold ${isOverdueTotal ? 'text-red-600' : 'text-green-600'}`}>
            {formatTime(totalKitchenTimeSeconds)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{label}</span>
          <span className="font-bold text-blue-600">
            {formatTime(timeElapsed)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">SLA:</span>
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">{order.slaMinutes}m</span>
            {isOverdueTotal && (
              <span className="px-1 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                ATRASADO
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Se estiver em NEW ou PREPARING, mostramos o tempo decorrido em tempo real
  return (
    <div className={`text-xs font-medium flex flex-col space-y-1`}>
      <div className="flex justify-between">
        <span className="text-gray-500">{label}</span>
        <span className={`font-bold ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
          {formatTime(timeElapsed)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-500">SLA:</span>
        <div className="flex items-center space-x-2">
          <span className="text-gray-500">{order.slaMinutes}m</span>
          {isOverdue && (
            <span className="px-1 py-0.5 rounded-full bg-red-100 text-red-600">
              ATRASADO
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


export default function OrderTrackerModal({ isOpen, onClose, activeOrders, onMarkAsDelivered }: OrderTrackerModalProps) {
  
  const [sortBy, setSortBy] = useState<'status' | 'time' | 'pin'>('status');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const trackableOrders = activeOrders;

  const sortedOrders = useMemo(() => {
    const sortable = [...trackableOrders];
    
    sortable.sort((a, b) => {
      let aValue, bValue;
      
      if (sortBy === 'status') {
        // Ordenar por status (NEW, PREPARING, READY)
        aValue = statusInfo[a.status as keyof typeof statusInfo]?.order || 99;
        bValue = statusInfo[b.status as keyof typeof statusInfo]?.order || 99;
      } else if (sortBy === 'time') {
        // Ordenar por tempo decorrido (mais antigo primeiro)
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
      } else { // sortBy === 'pin'
        // Ordenar por PIN (numérico, se possível, ou lexicográfico)
        const pinA = a.pin.replace(/[^0-9]/g, '');
        const pinB = b.pin.replace(/[^0-9]/g, '');
        aValue = parseInt(pinA) || 0;
        bValue = parseInt(pinB) || 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      
      // Desempate por tempo de criação (mais antigo primeiro)
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    
    return sortable;
  }, [trackableOrders, sortBy, sortDirection]);
  
  const handleSort = (key: 'status' | 'time' | 'pin') => {
    if (sortBy === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (key: 'status' | 'time' | 'pin') => {
    if (sortBy !== key) return 'ri-arrow-up-down-line';
    return sortDirection === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line';
  };
  
  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  // Destacar pedidos prontos cuja cozinha excedeu o SLA
  const isKitchenOverdue = (order: Order) => {
    if (order.status !== 'READY') return false;
    const readyTimeMs = order.readyAt 
      ? new Date(order.readyAt).getTime() 
      : new Date(order.updatedAt || order.createdAt).getTime();
    const totalTimeSeconds = Math.floor((readyTimeMs - new Date(order.createdAt).getTime()) / 1000);
    return (totalTimeSeconds / 60) > order.slaMinutes;
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Acompanhamento de Pedidos Ativos"
        size="3xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Total de pedidos em andamento: <span className="font-bold">{trackableOrders.length}</span>
          </p>

          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg bg-white">
            
            {/* Cabeçalho de Ordenação */}
            <div className="sticky top-0 bg-gray-50 grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <button 
                onClick={() => handleSort('pin')} 
                className="col-span-3 text-left hover:text-gray-800 flex items-center space-x-1"
              >
                <span>Pedido</span>
                <i className={getSortIcon('pin')}></i>
              </button>
              <div className="col-span-2 text-left flex items-center normal-case">entrega direta</div>
              <button 
                onClick={() => handleSort('status')} 
                className="col-span-3 text-left hover:text-gray-800 flex items-center space-x-1"
              >
                <span>Status</span>
                <i className={getSortIcon('status')}></i>
              </button>
              <button 
                onClick={() => handleSort('time')} 
                className="col-span-2 text-left hover:text-gray-800 flex items-center space-x-1"
              >
                <span>Tempo / SLA</span>
                <i className={getSortIcon('time')}></i>
              </button>
              <div className="col-span-2 text-right">Ações</div>
            </div>
            
            {sortedOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <i className="ri-inbox-line text-4xl mb-2"></i>
                <p className="text-sm">Nenhum pedido ativo no momento.</p>
              </div>
            ) : (
              sortedOrders.map(order => {
                const currentStatus = statusInfo[order.status as keyof typeof statusInfo];
                const isReady = order.status === 'READY';
                const directItems = order.items.filter(i => i.skipKitchen || i.menuItem?.skipKitchen);
                const hasDirectDelivery = directItems.length > 0;
                // Calcular progresso de entrega geral do pedido (x/y) considerando TODOS os itens
                const { deliveredUnitsSum, totalUnitsSum } = (() => {
                  let deliveredUnitsSum = 0;
                  let totalUnitsSum = 0;
                  order.items.forEach(di => {
                    const unitsPerItem = Math.max(1, di.menuItem?.unitDeliveryCount || 1);
                    const totalUnits = Math.max(1, di.quantity * unitsPerItem);
                    const delivered = Math.min(totalUnits, Math.max(0, di.directDeliveredUnitCount || 0));
                    deliveredUnitsSum += delivered;
                    totalUnitsSum += totalUnits;
                  });
                  return { deliveredUnitsSum, totalUnitsSum };
                })();
                const hasPartialDelivery = deliveredUnitsSum > 0 && deliveredUnitsSum < totalUnitsSum;
                
                return (
                  <div 
                    key={order.id} 
                    className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors cursor-pointer ${isKitchenOverdue(order) ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                    onClick={() => handleViewDetails(order)}
                  >
                    <div className="col-span-3 flex flex-col min-w-0">
                      <span className="text-lg font-bold text-gray-900 flex-shrink-0">#{order.pin}</span>
                      <span className="text-sm font-medium text-gray-900 block truncate">
                        Senha: <span className="font-bold text-blue-600">{order.password}</span>
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center space-x-2">
                      {hasDirectDelivery ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                          <i className="ri-truck-line mr-1"></i>
                          entrega direta
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                      {hasPartialDelivery && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
                          <i className="ri-time-line mr-1"></i>
                          entregue parcial {deliveredUnitsSum}/{totalUnitsSum}
                        </span>
                      )}
                    </div>
                    
                    <div className="col-span-3 flex items-center">
                      <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${currentStatus.color}`}>
                        <i className={`${currentStatus.icon} mr-1`}></i>
                        {currentStatus.text}
                      </span>
                    </div>
                    
                    <div className="col-span-2">
                      <OrderTimeStatus order={order} />
                    </div>
                    
                    <div className="col-span-2 flex justify-end">
                      {hasDirectDelivery && !isReady && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkAsDelivered(order.id, 'directOnly');
                          }}
                          title="Entregar itens diretos"
                          className="mr-2 bg-purple-50 text-purple-700 hover:bg-purple-100"
                        >
                          <i className="ri-truck-line mr-1"></i>
                          Entregar Diretos
                        </Button>
                      )}
                      {isReady && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={(e) => {
                            e.stopPropagation(); // Previne a abertura do modal de detalhes
                            onMarkAsDelivered(order.id);
                          }}
                        >
                          <i className="ri-check-double-line mr-1"></i>
                          Entregue
                        </Button>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(order);
                        }}
                        className="text-gray-500 hover:text-gray-700 ml-2"
                        title="Ver detalhes"
                      >
                        <i className="ri-eye-line"></i>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
      
      <ActiveOrderDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        order={selectedOrder}
        onMarkAsDelivered={onMarkAsDelivered}
      />
    </>
  );
}
