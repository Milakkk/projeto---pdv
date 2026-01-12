import { useState, memo } from 'react';
import type { Order, KitchenOperator, ProductionUnit } from '../../../types';
import OrderCard from './OrderCard';
import Button from '../../../components/base/Button';
import Modal from '../../../components/base/Modal';
import ReadyOrderTable from './ReadyOrderTable';
import DeliveredOrderList from './DeliveredOrderList';

interface OrderBoardProps {
  orders: Order[];
  operators: KitchenOperator[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
  onUpdateDirectDelivery?: (orderId: string, updates: { itemId: string; deliveredCount: number }[]) => void;
  onConfirmDelivery?: (orderId: string) => void;
  onCancelOrder: (orderId: string, reason: string) => void;
  onAssignOperator: (orderId: string, itemId: string, unitId: string, operatorName: string) => void;
  onAssignOperatorToAll: (orderId: string, operatorName: string) => void;
  onUpdateItemStatus: (orderId: string, itemId: string, unitId: string, itemStatus: ProductionUnit['unitStatus'], completedObservations?: string[]) => void;
}

const statusColumns = [
  { status: 'NEW' as const, title: 'Novos', color: 'bg-blue-50 border-blue-100' },
  { status: 'PREPARING' as const, title: 'Preparando', color: 'bg-amber-50 border-amber-100' },
];

const MemoizedOrderCard = memo(OrderCard);

export default function OrderBoard({
  orders,
  operators,
  onUpdateStatus,
  onCancelOrder,
  onAssignOperator,
  onAssignOperatorToAll,
  onUpdateItemStatus,
  onUpdateDirectDelivery,
  onConfirmDelivery
}: OrderBoardProps) {
  const [showCanceledModal, setShowCanceledModal] = useState(false);
  const [showDeliveredModal, setShowDeliveredModal] = useState(false);
  const [showReadyModal, setShowReadyModal] = useState(false);

  const handleUpdateStatusWrapper = (orderId: string, status: Order['status']) => {
    onUpdateStatus(orderId, status);
  };

  const productionOrders = orders.filter(order => ['NEW', 'PREPARING'].includes(order.status));
  const readyOrders = orders.filter(order => order.status === 'READY');
  const canceledOrders = orders.filter(order => order.status === 'CANCELLED');
  const deliveredOrders = orders.filter(order => order.status === 'DELIVERED');

  return (
    <>
      <div className="flex flex-nowrap gap-4 overflow-x-auto flex-1 min-h-0 p-2">
        {statusColumns.map(column => {
          const columnOrders = productionOrders.filter(order => order.status === column.status);

          return (
            <div
              key={column.status}
              className={`rounded-2xl border ${column.color} p-4 flex flex-col h-full min-h-0 flex-shrink-0 flex-grow min-w-[400px] lg:min-w-[48%] shadow-sm`}
            >
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.status === 'NEW' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`}></div>
                  <h2 className="font-black text-gray-800 text-lg uppercase tracking-tight">{column.title}</h2>
                </div>
                <span className="bg-white/80 backdrop-blur-sm shadow-sm px-3 py-1 rounded-full text-sm font-black text-gray-700 border border-gray-100">
                  {columnOrders.length}
                </span>
              </div>

              <div className="flex-1 overflow-hidden min-h-0">
                <div className="h-full overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {columnOrders.map(order => (
                    <MemoizedOrderCard
                      key={order.id}
                      order={order}
                      operators={operators}
                      onUpdateStatus={handleUpdateStatusWrapper}
                      onCancelOrder={onCancelOrder}
                      onAssignOperator={onAssignOperator}
                      onAssignOperatorToAll={onAssignOperatorToAll}
                      onUpdateItemStatus={onUpdateItemStatus}
                    />
                  ))}
                  {columnOrders.length === 0 && (
                    <div className="col-span-full h-40 flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-100 rounded-2xl">
                      <i className="ri-inbox-line text-4xl mb-2"></i>
                      <p className="text-xs font-bold uppercase tracking-widest">Aguardando Pedidos</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modais omitidos para brevidade se não forem alterados, mas mantidos para compatibilidade */}
      <Modal isOpen={showReadyModal} onClose={() => setShowReadyModal(false)} title="Prontos" size="full">
        <ReadyOrderTable readyOrders={readyOrders} onUpdateStatus={onUpdateStatus} onUpdateDirectDelivery={onUpdateDirectDelivery || (() => { })} onConfirmDelivery={onConfirmDelivery} />
      </Modal>

      <Modal isOpen={showDeliveredModal} onClose={() => setShowDeliveredModal(false)} title="Entregues" size="lg">
        <div className="space-y-4">
          {deliveredOrders.length === 0 ? <p className="text-center py-8 text-gray-400">Nenhum pedido</p> : <DeliveredOrderList deliveredOrders={deliveredOrders} />}
          <Button variant="secondary" onClick={() => setShowDeliveredModal(false)}>Fechar</Button>
        </div>
      </Modal>

      <Modal isOpen={showCanceledModal} onClose={() => setShowCanceledModal(false)} title="Cancelados" size="lg">
        <div className="space-y-4">
          {canceledOrders.length === 0 ? <p className="text-center py-8 text-gray-400">Nenhum pedido</p> : <DeliveredOrderList deliveredOrders={canceledOrders} />}
          <Button variant="secondary" onClick={() => setShowCanceledModal(false)}>Fechar</Button>
        </div>
      </Modal>
    </>
  );
}
