import { useState, useMemo } from 'react';
import type { Order } from '../../../types';
import Button from '../../../components/base/Button';

interface DeliveredOrderListProps {
  deliveredOrders: Order[];
}

// Função auxiliar para formatar a duração (copiada de OrderBoard)
const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  if (mins === 0 && secs === 0) return '0s';
  
  const parts = [];
  if (mins > 0) parts.push(`${mins.toString().padStart(2, '0')}m`);
  if (secs > 0) parts.push(`${secs.toString().padStart(2, '0')}s`);
  
  return parts.join(' ');
};

// Função auxiliar para extrair opções obrigatórias (igual às outras listas)
const extractRequiredOptions = (observations: string | undefined): string[] => {
  if (!observations) return [];
  return observations
    .split(', ')
    .filter(p => p.startsWith('[OBRIGATÓRIO]'))
    .map(p => p.replace('[OBRIGATÓRIO]', '').trim());
};

// Função auxiliar para extrair observações opcionais/customizadas (igual às outras listas)
const extractOptionalObservations = (observations: string | undefined): string[] => {
  if (!observations) return [];
  return observations
    .split(', ')
    .filter(p => !p.startsWith('[OBRIGATÓRIO]'))
    .map(p => p.trim())
    .filter(p => p.length > 0);
};

// Componente para um único item expansível
function DeliveredOrderItem({ order }: { order: Order }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { 
    totalTimeSeconds, 
    wasLate, 
    deliveredTime, 
    createdTime,
    newTimeSeconds,
    readyTimeSeconds,
    preparingTimeSeconds,
    preparationStartTimeMs // Mantido para referência, mas não usado para cálculo de tempo de unidade
  } = useMemo(() => {
    const createdAt = new Date(order.createdAt).getTime();
    
    // Tempo de saída de NEW (início do preparo)
    const preparingStartTime = order.updatedAt && order.status !== 'NEW' 
      ? new Date(order.updatedAt).getTime() 
      : createdAt;
      
    // Tempo que ficou pronto (fim do preparo)
    const readyAtTime = order.readyAt ? new Date(order.readyAt).getTime() : preparingStartTime;
    
    // Tempo de entrega (fim do READY)
    const deliveredTimeMs = order.status === 'DELIVERED' && (order.deliveredAt || order.updatedAt)
      ? new Date(order.deliveredAt || order.updatedAt!).getTime()
      : readyAtTime; // Se não foi entregue, usa o tempo de pronto

    // 1. Tempo Cozinha (NEW + PREPARING)
    const totalKitchenTimeMs = readyAtTime - createdAt;
    const totalKitchenTimeSeconds = Math.floor(totalKitchenTimeMs / 1000);
    const wasLate = (totalKitchenTimeMs / 60000) > order.slaMinutes;
    
    // 2. Tempo de Espera (NEW)
    const newTimeMs = preparingStartTime - createdAt;
    const newTimeSeconds = Math.floor(newTimeMs / 1000);
    
    // 3. Tempo de Preparo (PREPARING)
    const preparingTimeMs = readyAtTime - preparingStartTime;
    const preparingTimeSeconds = Math.floor(preparingTimeMs / 1000);
    
    // 4. Tempo para Entregar (READY)
    const readyTimeMs = deliveredTimeMs - readyAtTime;
    const readyTimeSeconds = Math.floor(readyTimeMs / 1000);

    // 5. Strings formatadas
    const deliveredTimeStr = (order.deliveredAt || order.updatedAt)
      ? new Date(order.deliveredAt || order.updatedAt!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : 'N/A';
    const createdTimeStr = new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });


    return { 
      totalTimeSeconds: Math.max(0, totalKitchenTimeSeconds), 
      wasLate, 
      deliveredTime: deliveredTimeStr, 
      createdTime: createdTimeStr,
      newTimeSeconds: Math.max(0, newTimeSeconds), 
      readyTimeSeconds: Math.max(0, readyTimeSeconds),
      preparingTimeSeconds: Math.max(0, preparingTimeSeconds),
      preparationStartTimeMs: preparingStartTime
    };
  }, [order]);
  
  // NOVO: Extrai nomes únicos dos operadores atribuídos
  const assignedOperators = useMemo(() => {
    const operatorNames = new Set<string>();
    order.items.forEach(item => {
      (item.productionUnits || []).forEach(unit => {
        if (unit.operatorName) {
          operatorNames.add(unit.operatorName);
        }
      });
    });
    return Array.from(operatorNames);
  }, [order.items]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      
      {/* Header Colapsável */}
      <div 
        className={`p-4 cursor-pointer transition-colors ${isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-900">#{order.pin}</span>
            <span className="bg-green-500 text-white text-sm font-bold px-3 py-1 rounded">
              {order.password}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              wasLate ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
            }`}>
              {wasLate ? 'ATRASADO' : 'NO PRAZO'}
            </span>
          </div>
          
          <div className="flex items-center space-x-3 text-sm text-gray-600">
            <span className="hidden sm:inline">Tempo Cozinha: {formatDuration(totalTimeSeconds)}</span>
            <i className={`ri-arrow-${isExpanded ? 'up' : 'down'}-s-line text-xl`}></i>
          </div>
        </div>
      </div>
      
      {/* Conteúdo Detalhado */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-200 bg-white space-y-4">
          
          {/* Métricas de Tempo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-700">
            <div>
              <i className="ri-time-line mr-1 text-gray-600"></i>
              SLA: <span className="font-bold">{order.slaMinutes} min</span>
            </div>
            <div>
              <i className="ri-calendar-line mr-1 text-gray-600"></i>
              Criado às: <span className="font-bold">{createdTime}</span>
            </div>
            <div>
              <i className="ri-check-double-line mr-1 text-green-600"></i>
              Entregue às: <span className="font-bold">{deliveredTime}</span>
            </div>
            <div>
              <i className="ri-restaurant-line mr-1 text-amber-600"></i>
              Tempo Cozinha: <span className="font-bold">{formatDuration(totalTimeSeconds)}</span>
            </div>
            
            {/* NOVOS CAMPOS */}
            <div>
              <i className="ri-hourglass-line mr-1 text-blue-600"></i>
              Tempo de Espera: <span className="font-bold">{formatDuration(newTimeSeconds)}</span>
            </div>
            <div>
              <i className="ri-fire-line mr-1 text-red-600"></i>
              Tempo de Preparo: <span className="font-bold">{formatDuration(preparingTimeSeconds)}</span>
            </div>
            <div>
              <i className="ri-truck-line mr-1 text-purple-600"></i>
              Tempo para Entregar: <span className="font-bold">{formatDuration(readyTimeSeconds)}</span>
            </div>
          </div>

          {/* Itens do Pedido */}
          <div className="space-y-3 pl-4 border-l-2 border-green-200">
            <h4 className="text-sm font-semibold text-gray-700">Itens:</h4>
            {order.items.map((item, index) => (
              <div key={index} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                <div className="text-sm font-medium text-gray-900 mb-1">
                  {item.quantity}x {item.menuItem.name}
                </div>
                
                {/* Detalhes de Produção por Unidade */}
                <div className="space-y-1 mt-2">
                  {(item.productionUnits || []).map((unit, unitIndex) => {
                    const completionTime = unit.completedAt 
                      ? new Date(unit.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : 'N/A';
                      
                    // REMOVIDO: Cálculo unitProductionTimeSeconds
                    
                    return (
                      <div key={unit.unitId} className="flex justify-between text-xs text-gray-600">
                        <div className="flex items-center space-x-1">
                          <span className="font-medium">Unidade {item.quantity === 1 ? '' : unitIndex + 1}</span>
                          {unit.operatorName && (
                            <span className="text-blue-600 bg-blue-100 px-1 rounded">
                              {unit.operatorName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                            {/* REMOVIDO: Exibição do tempo de preparo da unidade */}
                            <span className="text-green-700 font-medium">
                                Pronto às: {completionTime}
                            </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Opções obrigatórias e observações opcionais com o mesmo visual das outras listas */}
                {(() => {
                  const requiredOptions = extractRequiredOptions(item.observations);
                  const optionalObservations = extractOptionalObservations(item.observations);
                  return (
                    <>
                      {requiredOptions.length > 0 && (
                        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded p-1.5 flex items-start mb-2 mt-2">
                          <i className="ri-checkbox-circle-line mr-1 mt-0.5 flex-shrink-0"></i>
                          <span className="flex-1 font-medium">Opções: {requiredOptions.join(' | ')}</span>
                        </div>
                      )}
                      {optionalObservations.length > 0 && (
                        <div className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-1.5 flex items-start mb-2">
                          <i className="ri-alert-line mr-1 mt-0.5 flex-shrink-0"></i>
                          <span className="flex-1">Obs: {optionalObservations.join(' | ')}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


export default function DeliveredOrderList({ deliveredOrders }: DeliveredOrderListProps) {
  // Ordenar do mais recente para o mais antigo
  const sortedOrders = useMemo(() => {
    return [...deliveredOrders].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });
  }, [deliveredOrders]);

  return (
    <div className="max-h-96 overflow-y-auto space-y-3">
      {sortedOrders.map(order => (
        <DeliveredOrderItem key={order.id} order={order} />
      ))}
    </div>
  );
}
