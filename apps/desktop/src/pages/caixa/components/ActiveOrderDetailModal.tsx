import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';
import type { Order } from '../../../types';
import { useMemo } from 'react';
import { formatDurationSeconds } from '../../../utils/time';

interface ActiveOrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onMarkAsDelivered: (orderId: string, mode?: 'all' | 'directOnly') => void;
}

// Mapeamento de Status para Português
const statusTranslation = {
  NEW: 'Novo',
  PREPARING: 'Em Preparo',
  READY: 'Pronto',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
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

const formatOrderPin = (pin: string) => {
  const raw = String(pin ?? '').trim()
  if (!raw) return '#-'
  return `#${raw.replace(/^#+/, '')}`
}

export default function ActiveOrderDetailModal({ isOpen, onClose, order, onMarkAsDelivered }: ActiveOrderDetailModalProps) {
  if (!order) return null;

  // Mantendo o cálculo de métricas apenas para referência interna, se necessário, mas removendo a exibição.
  const { 
    wasLate, 
    tempoCozinha,
  } = useMemo(() => {
    const createdAt = new Date(order.createdAt).getTime();
    
    const preparingStartTime = order.status !== 'NEW' && order.updatedAt
      ? new Date(order.updatedAt).getTime() 
      : createdAt;
      
    const productionEndTime = order.readyAt 
      ? new Date(order.readyAt).getTime() 
      : (order.status === 'READY' ? new Date(order.updatedAt || Date.now()).getTime() : Date.now());
      
    const tempoCozinhaMs = productionEndTime - createdAt;
    const tempoCozinha = Math.floor(tempoCozinhaMs / 1000);
    const wasLate = (tempoCozinha / 60) > order.slaMinutes;
    
    return { 
      tempoCozinha: Math.max(0, tempoCozinha),
      wasLate,
    };
  }, [order]);
  
  const statusClasses = {
    NEW: 'bg-gray-100 text-gray-800',
    PREPARING: 'bg-yellow-100 text-yellow-800',
    READY: 'bg-green-100 text-green-800',
    DELIVERED: 'bg-green-500 text-white',
    CANCELLED: 'bg-red-500 text-white',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalhes do Pedido ${formatOrderPin(order.pin)} (Senha: ${order.password})`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Removido: badge de entrega direta no cabeçalho do modal de detalhes */}
        
        {/* Itens e Produção */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Itens do Pedido</h3>
          <div className="max-h-64 overflow-y-auto space-y-3">
            {order.items.map((item) => {
              const requiredOptions = extractRequiredOptions(item.observations);
              const optionalObservations = extractOptionalObservations(item.observations);
              
              return (
                <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                  <div className="text-sm font-bold text-gray-900 mb-2 flex items-center">
                    {item.quantity}x {item.menuItem.name}
                    {item.menuItem.code && (
                      <span className="ml-2 text-blue-600 text-xs font-semibold">#{item.menuItem.code}</span>
                    )}
                    {item.skipKitchen && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200 align-middle">
                        <i className="ri-truck-line mr-1"></i>
                        Entrega Direta
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
                  <div className="space-y-1 mt-2 pt-2 border-t border-gray-100">
                    {(() => {
                      const totalUnits = Math.max(1, item.quantity * Math.max(1, item.menuItem.unitDeliveryCount || 1));
                      const unitsToRender = item.skipKitchen
                        ? Array.from({ length: totalUnits }).map((_, idx) => ({ unitId: `direct-${idx}` }))
                        : (item.productionUnits || []);
                      return unitsToRender.map((unit: any, unitIndex: number) => {
                        const isUnitReady = !item.skipKitchen && unit.unitStatus === 'READY';
                        // Determinar status para itens diretos: Disponível para entrega desde a criação
                        let statusText = item.skipKitchen ? 'Disponível para entrega' : 'Em preparo';
                        let statusColor = item.skipKitchen ? 'bg-green-500' : 'bg-yellow-500';
                        if (!item.skipKitchen) {
                          if (isUnitReady) { statusText = 'Pronto'; statusColor = 'bg-green-500'; }
                          else if (order.status === 'NEW') { statusText = 'Aguardando Preparo'; statusColor = 'bg-gray-400'; }
                          else if (order.status === 'DELIVERED' || order.status === 'CANCELLED') { statusText = 'Concluído'; statusColor = 'bg-green-500'; }
                        }
                        const completionTime = unit.completedAt
                          ? new Date(unit.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                          : '-';
                        return (
                          <div key={unit.unitId} className="flex justify-between text-xs text-gray-600">
                            <div className="flex items-center space-x-2">
                              <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
                              <span className="font-medium">Unidade {item.quantity === 1 ? '' : unitIndex + 1}</span>
                              {!item.skipKitchen && unit.operatorName && (
                                <span className="text-blue-600 bg-blue-50 px-1 rounded">
                                  {unit.operatorName}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col items-end">
                              <span className={`font-medium ${isUnitReady || item.skipKitchen ? 'text-green-700' : 'text-gray-500'}`}>
                                {isUnitReady ? `Pronto às ${completionTime}` : statusText}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ações */}
        <div className="flex justify-end pt-4 border-t">
          {order.status === 'READY' && (
            <Button
              variant="success"
              onClick={() => {
                onMarkAsDelivered(order.id);
                onClose();
              }}
              className="mr-3"
            >
              <i className="ri-check-double-line mr-2"></i>
              Entregue
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
