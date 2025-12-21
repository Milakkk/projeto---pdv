import { useState, useMemo, memo } from 'react';
import OrderCard from './OrderCard';
import Button from '../../../components/base/Button';
import Modal from '../../../components/base/Modal';
import ReadyOrderTable from './ReadyOrderTable'; // Importando o componente de tabela de prontos
import DeliveredOrderList from './DeliveredOrderList'; // Importar o novo componente
import AlertModal from '../../../components/base/AlertModal'; // Importando AlertModal

interface OrderBoardProps {
  orders: Order[];
  operators: KitchenOperator[];
  categories: Category[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
  onUpdateDirectDelivery?: (orderId: string, updates: { itemId: string; deliveredCount: number }[]) => void;
  onConfirmDelivery?: (orderId: string) => void;
  onCancelOrder: (orderId: string, reason: string) => void;
  onAssignOperator: (orderId: string, itemId: string, unitId: string, operatorName: string) => void; // NOVO PROP
  onAssignOperatorToAll: (orderId: string, operatorName: string) => void;
  onUpdateItemStatus: (orderId: string, itemId: string, unitId: string, itemStatus: ProductionUnit['unitStatus'], completedObservations?: string[]) => void; // NOVO PROP
}

const statusColumns = [
  { status: 'NEW' as const, title: 'Novos', color: 'bg-blue-50 border-blue-200' },
  { status: 'QUEUED' as const, title: 'Na Fila', color: 'bg-indigo-50 border-indigo-200' },
  { status: 'PREPARING' as const, title: 'Preparando', color: 'bg-yellow-50 border-yellow-200' },
];

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  if (mins === 0 && secs === 0) return '0s';
  
  const parts = [];
  if (mins > 0) parts.push(`${mins.toString().padStart(2, '0')}m`);
  if (secs > 0) parts.push(`${secs.toString().padStart(2, '0')}s`);
  
  return parts.join(' ');
};

// Memoizando OrderCard para melhor performance
const MemoizedOrderCard = memo(OrderCard);

export default function OrderBoard({ 
  orders, 
  operators, 
  categories,
  onUpdateStatus, 
  onCancelOrder, 
  onAssignOperator, 
  onAssignOperatorToAll,
  onUpdateItemStatus, // NOVO PROP
  onUpdateDirectDelivery,
  onConfirmDelivery
}: OrderBoardProps) {
  const [showCanceledModal, setShowCanceledModal] = useState(false);
  const [showDeliveredModal, setShowDeliveredModal] = useState(false);
  const [showReadyModal, setShowReadyModal] = useState(false); 
  
  // Função wrapper para atualizar o status (REMOVIDA A ABERTURA AUTOMÁTICA DO MODAL)
  const handleUpdateStatusWrapper = (orderId: string, status: Order['status']) => {
    onUpdateStatus(orderId, status);
  };
  
  // Filtra todos os pedidos, incluindo os prontos, para os modais
  const productionOrders = orders.filter(order => ['NEW', 'QUEUED', 'PREPARING'].includes(order.status));
  const readyOrders = orders.filter(order => order.status === 'READY');
  const canceledOrders = orders.filter(order => order.status === 'CANCELLED');
  const deliveredOrders = orders.filter(order => order.status === 'DELIVERED');

  return (
    <>
      {/* Botões de modais movidos para o componente pai (CozinhaPage) */}
      
      {/* Container principal do Kanban: flex-1 min-h-0 para preencher o espaço restante */}
      {/* Usamos flex-1 para que o container ocupe o espaço total e overflow-x-auto para rolagem horizontal */}
      <div className="flex flex-nowrap gap-6 overflow-x-auto flex-1 min-h-0"> 
        {statusColumns.map(column => {
          // Filtra apenas os pedidos da coluna (NEW ou PREPARING)
          const columnOrders = productionOrders.filter(order => order.status === column.status);
          
          return (
            <div
              key={column.status}
              // Usando flex-1 para que as colunas se expandam, mas min-w para garantir legibilidade
              className={`rounded-lg border-2 ${column.color} p-4 flex flex-col h-full min-h-0 flex-shrink-0 flex-grow min-w-[380px] lg:min-w-[45%]`}
            >
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="font-semibold text-gray-900 text-lg">{column.title}</h2>
                <span className="bg-white px-2 py-1 rounded-full text-sm font-medium text-gray-600">
                  {columnOrders.length}
                </span>
              </div>
              
              {/* Área de rolagem dos cards */}
              <div className="flex-1 overflow-hidden min-h-0">
                <div className="h-full overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {columnOrders.map(order => (
                    <MemoizedOrderCard
                      key={order.id}
                      order={order}
                      operators={operators}
                      categories={categories}
                      onUpdateStatus={handleUpdateStatusWrapper} // USANDO A FUNÇÃO WRAPPER
                      onCancelOrder={onCancelOrder}
                      onAssignOperator={onAssignOperator}
                      onAssignOperatorToAll={onAssignOperatorToAll}
                      onUpdateItemStatus={onUpdateItemStatus} // NOVO PROP
                    />
                  ))}
                  {columnOrders.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <i className="ri-inbox-line text-3xl mb-2 block"></i>
                      <p className="text-sm">Nenhum pedido</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Prontos (Mantido aqui, mas o botão de abertura está no pai) */}
      <Modal
        isOpen={showReadyModal}
        onClose={() => setShowReadyModal(false)}
        title="Pedidos Prontos para Retirada"
        size="full"
      >
        <ReadyOrderTable 
          readyOrders={readyOrders} 
          onUpdateStatus={onUpdateStatus} 
          onUpdateDirectDelivery={onUpdateDirectDelivery || (() => {})}
          onConfirmDelivery={onConfirmDelivery}
        />
        <div className="flex justify-end pt-4 border-t mt-4">
          <Button variant="secondary" onClick={() => setShowReadyModal(false)}>
            Fechar
          </Button>
        </div>
      </Modal>

      {/* Modal de Entregues */}
      <Modal
        isOpen={showDeliveredModal}
        onClose={() => setShowDeliveredModal(false)}
        title="Pedidos Entregues"
        size="lg"
      >
        <div className="space-y-4">
          {deliveredOrders.length === 0 ? (
            <div className="text-center py-8">
              <i className="ri-check-double-line text-4xl text-gray-400 mb-4"></i>
              <p className="text-gray-500">Nenhum pedido entregue</p>
            </div>
          ) : (
            <DeliveredOrderList deliveredOrders={deliveredOrders} />
          )}
          
          <div className="flex justify-end pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => setShowDeliveredModal(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Cancelados */}
      <Modal
        isOpen={showCanceledModal}
        onClose={() => setShowCanceledModal(false)}
        title="Pedidos Cancelados"
        size="lg"
      >
        <div className="space-y-4">
          {canceledOrders.length === 0 ? (
            <div className="text-center py-8">
              <i className="ri-close-circle-line text-4xl text-gray-400 mb-4"></i>
              <p className="text-gray-500">Nenhum pedido cancelado</p>
            </div>
          ) : (
            <DeliveredOrderList deliveredOrders={canceledOrders} />
          )}
          
          <div className="flex justify-end pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => setShowCanceledModal(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
