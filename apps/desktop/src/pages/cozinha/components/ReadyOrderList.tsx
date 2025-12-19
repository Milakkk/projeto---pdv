import type { Order } from '../../../types';
import Button from '../../../components/base/Button';
import { useTimer } from '../../../hooks/useTimer';

interface ReadyOrderListProps {
  readyOrders: Order[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
}

const formatOrderPin = (pin: string) => {
  const raw = String(pin ?? '').trim()
  if (!raw) return '#-'
  return `#${raw.replace(/^#+/, '')}`
}

// Componente auxiliar para exibir o tempo de espera (tempo desde que ficou pronto)
function ReadyTimeStatus({ order }: { order: Order }) {
  // O timer deve medir o tempo desde que o status mudou para READY (usando readyAt ou updatedAt)
  const readyTime = order.readyAt ? new Date(order.readyAt) : (order.updatedAt ? new Date(order.updatedAt) : new Date(order.createdAt));
  
  // O timer é sempre ativo para medir o tempo de espera
  const { timeElapsed, formatTime } = useTimer(readyTime, 99999, true); 

  return (
    <div className="text-xs font-medium flex items-center space-x-1 text-gray-600">
      <i className="ri-time-line"></i>
      <span>Aguardando há:</span>
      <span className="font-bold text-blue-700">{formatTime(timeElapsed)}</span>
    </div>
  );
}

export default function ReadyOrderList({ readyOrders, onUpdateStatus }: ReadyOrderListProps) {
  
  // Ordenar pedidos prontos pelo tempo de espera (mais antigo primeiro)
  const sortedOrders = readyOrders.sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt).getTime();
    return timeA - timeB;
  });

  return (
    <div className="bg-white rounded-lg border-2 border-green-200 p-4 flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="font-semibold text-gray-900 text-lg flex items-center">
          <i className="ri-check-line mr-2 text-green-600"></i>
          Pedidos Prontos para Retirada
        </h2>
        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-medium">
          {readyOrders.length}
        </span>
      </div>
      
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full overflow-y-auto space-y-3 pr-2">
          {sortedOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <i className="ri-emotion-happy-line text-3xl mb-2 block"></i>
              <p className="text-sm">Nenhum pedido pronto no momento.</p>
            </div>
          ) : (
            sortedOrders.map(order => (
              <div key={order.id} className="bg-green-50 border border-green-300 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-900">{formatOrderPin(order.pin)}</span>
                    <span className="bg-green-500 text-white text-xl font-bold px-3 py-1 rounded-lg">
                      {order.password}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onUpdateStatus(order.id, 'PREPARING')}
                    className="bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    <i className="ri-arrow-left-line mr-1"></i>
                    Voltar
                  </Button>
                </div>
                
                <ReadyTimeStatus order={order} />

                <div className="mt-3 pt-3 border-t border-green-200 space-y-1">
                  {order.items.map((item, index) => (
                    <div key={index} className="text-sm text-gray-700">
                      <div className="flex justify-between items-center">
                        <span>{item.quantity}x {item.menuItem.name}</span>
                        {/* Exibir operador responsável (se houver um único operador para todas as unidades) */}
                        {item.productionUnits.length > 0 && item.productionUnits.every(u => u.operatorName === item.productionUnits[0].operatorName) && item.productionUnits[0].operatorName && (
                          <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {item.productionUnits[0].operatorName}
                          </span>
                        )}
                      </div>
                      
                      {/* NOVO: Observações */}
                      {item.observations && (
                        <div className="text-xs text-yellow-800 bg-yellow-100 border border-yellow-300 rounded p-1.5 flex items-start mt-1">
                          <i className="ri-alert-line mr-1 mt-0.5 flex-shrink-0"></i>
                          <span className="flex-1 truncate">{item.observations}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
