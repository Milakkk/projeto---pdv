import { useState, useMemo, memo } from 'react';
import { Order, KitchenOperator, Category, OrderItem, ProductionUnit } from '../../../types';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';
import OrderRow from './OrderRow'; // Importando o novo componente
import Modal from '../../../components/base/Modal';
import ReadyOrderTable from './ReadyOrderTable'; // Importando a tabela de prontos

interface OrderListProps {
  orders: Order[];
  operators: KitchenOperator[];
  categories: Category[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
  onCancelOrder: (orderId: string, reason: string) => void; // Adicionado onCancelOrder
  onAssignOperator: (orderId: string, itemId: string, unitId: string, operatorName: string) => void; // NOVO PROP
  onAssignOperatorToAll: (orderId: string, operatorName: string) => void;
  onDisplayAlert: (title: string, message: string, variant?: 'error' | 'info' | 'success') => void;
  onUpdateItemStatus: (orderId: string, itemId: string, unitId: string, itemStatus: ProductionUnit['unitStatus']) => void; // NOVO PROP
  onUpdateDirectDelivery: (orderId: string, updates: { itemId: string; deliveredCount: number }[]) => void; // NOVO PROP
  onConfirmDelivery?: (orderId: string) => void;
}

const statusOrderMap = { 'NEW': 1, 'PREPARING': 2, 'READY': 3 };

 function OrderListComponent({ 
  orders, 
  operators, 
  categories, 
  onUpdateStatus, 
  onCancelOrder, // Recebendo onCancelOrder
  onAssignOperator,
  onAssignOperatorToAll,
  onDisplayAlert,
  onUpdateItemStatus, // NOVO PROP
  onUpdateDirectDelivery, // NOVO PROP
  onConfirmDelivery,
}: OrderListProps) {
  const [sortConfig, setSortConfig] = useState<{ key: 'status' | 'delay'; direction: 'asc' | 'desc' }>({ key: 'status', direction: 'asc' });
  const [showReadyModal, setShowReadyModal] = useState(false); // NOVO ESTADO

  const categoryMap = useMemo(() => {
    return categories.reduce((map, category) => {
      map[category.id] = category.name;
      return map;
    }, {} as Record<string, string>);
  }, [categories]);

  // Filtra apenas NEW e PREPARING (recebidos via props)
  const activeOrders = orders; 
  const readyOrders = orders.filter(order => order.status === 'READY'); // Filtra os prontos para o modal

  const sortedOrders = useMemo(() => {
    const sortableItems = [...activeOrders];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;
        if (sortConfig.key === 'delay') {
          // Para fins de ordenação, o atraso é calculado em relação ao SLA
          const now = new Date();
          aValue = (now.getTime() - new Date(a.createdAt).getTime()) / 1000 - (a.slaMinutes * 60);
          bValue = (now.getTime() - new Date(b.createdAt).getTime()) / 1000 - (b.slaMinutes * 60);
        } else { // status
          aValue = statusOrderMap[a.status];
          bValue = statusOrderMap[b.status];
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    }
    return sortableItems;
  }, [activeOrders, sortConfig]);

  const handleSort = (key: 'status' | 'delay') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col min-h-0">
        <div className="p-4 border-b border-gray-200 flex-shrink-0 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Pedidos em Produção ({activeOrders.length})
          </h3>
          
          {/* Botão Ver Prontos na Lista */}
          <Button
            variant="secondary"
            onClick={() => setShowReadyModal(true)}
            className="bg-blue-50 text-blue-600 hover:bg-blue-100"
            size="sm"
          >
            <i className="ri-check-line mr-2"></i>
            Ver Prontos ({readyOrders.length})
          </Button>
        </div>

        {/* Cabeçalho das Colunas */}
        <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider flex-shrink-0">
          <div className="col-span-2">Pedido</div>
          <button 
            onClick={() => handleSort('status')} 
            className="col-span-2 text-left hover:text-gray-800 flex items-center space-x-1"
          >
            <span>Status</span>
            {sortConfig.key === 'status' && (
              <i className={sortConfig.direction === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}></i>
            )}
          </button>
          <div className="col-span-3">Itens / Operador</div>
          <button 
            onClick={() => handleSort('delay')} 
            className="col-span-2 text-left hover:text-gray-800 flex items-center space-x-1"
          >
            <span>Tempo / SLA</span>
            {sortConfig.key === 'delay' && (
              <i className={sortConfig.direction === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-s-line'}></i>
            )}
          </button>
          <div className="col-span-1">Total</div>
          <div className="col-span-2 text-center">Ação</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sortedOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <i className="ri-inbox-line text-4xl mb-2"></i>
              <p>Nenhum pedido ativo</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {sortedOrders.map(order => (
                <OrderRow
                  key={order.id}
                  order={order}
                  operators={operators}
                  categoryMap={categoryMap}
                  onUpdateStatus={onUpdateStatus}
                  onCancelOrder={onCancelOrder} // Passando onCancelOrder
                  onAssignOperator={onAssignOperator}
                  onAssignOperatorToAll={onAssignOperatorToAll}
                  onDisplayAlert={onDisplayAlert}
                  onUpdateItemStatus={onUpdateItemStatus} // NOVO PROP
                />
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Modal de Prontos (para visualização de lista) */}
      <Modal
        isOpen={showReadyModal}
        onClose={() => setShowReadyModal(false)}
        title="Pedidos Prontos para Retirada"
        size="full"
      >
        <ReadyOrderTable 
          readyOrders={readyOrders} 
          onUpdateStatus={onUpdateStatus} 
          onUpdateDirectDelivery={onUpdateDirectDelivery}
          onConfirmDelivery={onConfirmDelivery}
        />
        <div className="flex justify-end pt-4 border-t mt-4">
          <Button variant="secondary" onClick={() => setShowReadyModal(false)}>
            Fechar
          </Button>
        </div>
      </Modal>
    </>
  );
}

export default memo(OrderListComponent);
