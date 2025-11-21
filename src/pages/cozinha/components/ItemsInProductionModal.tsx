import { useMemo, useState } from 'react';
import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';
import { Order, KitchenOperator } from '../../../types';

interface ItemsInProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  operators: KitchenOperator[];
}

export default function ItemsInProductionModal({ isOpen, onClose, orders, operators }: ItemsInProductionModalProps) {
  const [selectedOperator, setSelectedOperator] = useState<string | 'all'>('all');

  // Agrupar itens em produção por operador
  const productionData = useMemo(() => {
    const data: Record<string, { operatorName: string; items: { name: string; quantity: number; orderPin: string; unitStatus: 'PENDING' | 'READY' }[] }> = {};

    orders.forEach(order => {
      if (order.status === 'PREPARING' || order.status === 'NEW') {
        // Considerar somente itens que passam pela cozinha
        order.items.filter(item => !item.skipKitchen).forEach(item => {
          (item.productionUnits || []).forEach(unit => {
            const operatorName = unit.operatorName || 'Não Atribuído';
            
            if (!data[operatorName]) {
              data[operatorName] = { operatorName, items: [] };
            }
            
            // Verifica se o item já existe para este operador (para consolidar unidades)
            const existingItem = data[operatorName].items.find(i => i.name === item.menuItem.name && i.orderPin === order.pin);
            
            if (existingItem) {
              existingItem.quantity += 1;
            } else {
              data[operatorName].items.push({
                name: item.menuItem.name,
                quantity: 1,
                orderPin: order.pin,
                unitStatus: unit.unitStatus,
              });
            }
          });
        });
      }
    });
    
    // Converter para array e ordenar por nome do operador
    return Object.values(data).sort((a, b) => a.operatorName.localeCompare(b.operatorName));
  }, [orders]);
  
  const filteredData = useMemo(() => {
    if (selectedOperator === 'all') {
      return productionData;
    }
    return productionData.filter(group => group.operatorName === selectedOperator);
  }, [productionData, selectedOperator]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Itens em Preparo por Operador"
      size="xl"
    >
      <div className="space-y-4">
        
        {/* Filtro de Operador */}
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <Button
            size="sm"
            variant={selectedOperator === 'all' ? 'primary' : 'secondary'}
            onClick={() => setSelectedOperator('all')}
          >
            Todos ({productionData.reduce((sum, group) => sum + group.items.length, 0)})
          </Button>
          {operators.map(op => {
            const totalItems = productionData.find(g => g.operatorName === op.name)?.items.length || 0;
            if (totalItems === 0) return null;
            
            return (
              <Button
                key={op.id}
                size="sm"
                variant={selectedOperator === op.name ? 'primary' : 'secondary'}
                onClick={() => setSelectedOperator(op.name)}
              >
                {op.name} ({totalItems})
              </Button>
            );
          })}
          {/* Itens não atribuídos */}
          {productionData.find(g => g.operatorName === 'Não Atribuído') && (
            <Button
              size="sm"
              variant={selectedOperator === 'Não Atribuído' ? 'danger' : 'secondary'}
              onClick={() => setSelectedOperator('Não Atribuído')}
            >
              Não Atribuído ({productionData.find(g => g.operatorName === 'Não Atribuído')?.items.length})
            </Button>
          )}
        </div>

        {/* Lista de Itens Agrupados */}
        <div className="max-h-96 overflow-y-auto space-y-6">
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <i className="ri-restaurant-line text-4xl mb-2"></i>
              <p>Nenhum item em preparo para o filtro selecionado.</p>
            </div>
          ) : (
            filteredData.map(group => (
              <div key={group.operatorName} className="border border-gray-300 rounded-lg shadow-md">
                <h3 className={`p-3 font-bold text-lg rounded-t-lg ${
                  group.operatorName === 'Não Atribuído' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {group.operatorName} ({group.items.length} unidades)
                </h3>
                <div className="divide-y divide-gray-200 bg-white">
                  {group.items.map((item, index) => (
                    <div key={index} className="p-3 flex justify-between items-center hover:bg-gray-50">
                      <div className="flex-1 min-w-0 pr-4">
                        <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-gray-600">Pedido: <span className="font-bold text-blue-600">#{item.orderPin}</span></span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          item.unitStatus === 'READY' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.unitStatus === 'READY' ? 'Pronto' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
