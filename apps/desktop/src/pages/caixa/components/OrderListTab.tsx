import { useMemo, useState } from 'react';
import type { Order } from '../../../types';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';
import { useTimer } from '../../../hooks/useTimer'; // Importando useTimer
import { printOrder } from '../../../utils/print'; // Importando a função de impressão
import { useAuth } from '../../../context/AuthContext';
import { formatDurationSeconds, normalizeSlaMinutes } from '../../../utils/time';

interface OrderListTabProps {
  orders: Order[];
  onMarkAsDelivered: (orderId: string) => void;
}

// Função auxiliar para consolidar pagamentos (copiada de RelatoriosPage)
const consolidatePayments = (order: Order) => {
  const consolidated: { [method: string]: number } = {};

  if (order.paymentMethod === 'MÚLTIPLO' && order.paymentBreakdown) {
    Object.entries(order.paymentBreakdown).forEach(([method, amount]) => {
      const baseMethod = method.replace(/\s\(\d+\)$/, '');
      consolidated[baseMethod] = (consolidated[baseMethod] || 0) + amount;
    });
  } else {
    consolidated[order.paymentMethod || 'Não informado'] = order.total;
  }

  return Object.entries(consolidated).map(([method, amount]) => ({ method, amount }));
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
  if (!raw || raw === '#-') return '#-'
  return raw.startsWith('#') ? raw : `#${raw}`
}

// Componente auxiliar para exibir o status do tempo (adaptado para exibir todas as métricas)
function OrderTimeStatus({ order }: { order: Order }) {
  const isTimerActive = order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
  const slaMinutes = normalizeSlaMinutes(order.slaMinutes, 15)
  const { timeElapsed } = useTimer(order.createdAt, slaMinutes, isTimerActive);

  // 1. Cálculo das métricas de tempo
  const {
    tempoEspera,
    tempoPreparo,
    tempoEntrega,
    tempoCozinha,
    tempoTotalDecorrido,
    wasLate
  } = useMemo(() => {
    const now = Date.now();
    const createdAt = new Date(order.createdAt).getTime();

    const isFinalStatus = order.status === 'DELIVERED' || order.status === 'CANCELLED';

    // 1. Determinar o tempo final do ciclo de vida do pedido (para Tempo Total Decorrido e Tempo Entrega)
    let finalTime = now;
    if (isFinalStatus) {
      finalTime = new Date(order.deliveredAt || order.updatedAt || order.createdAt).getTime();
    }

    // 2. Determinar o Tempo de Início do Preparo (Fim da fase NEW)
    // Se o pedido está em status final, usamos o updatedAt fixo. Caso contrário, usamos o updatedAt se existir, ou createdAt.
    // Início do preparo deve ser estável (não depende de entrega)
    const preparingStartTime = (() => {
      if (order.status === 'NEW') return createdAt;

      // Se tivermos o timestamp explícito de início de preparo, usamos ele (prioridade máxima)
      if (order.preparingStartedAt) return new Date(order.preparingStartedAt).getTime();

      // Caso legado: pedido entregue sem deliveredAt e updatedAt > readyAt indica updatedAt como tempo de entrega
      if (isFinalStatus && !order.deliveredAt && order.updatedAt && order.readyAt) {
        const upd = new Date(order.updatedAt).getTime();
        const ready = new Date(order.readyAt).getTime();
        if (upd > ready) return createdAt; // evita distorcer tempo de espera/preparo
      }
      return new Date(order.createdAt).getTime();
    })();

    // 3. Determinar o Tempo Final de Produção (Fim da fase PREPARING / Início da fase READY)
    let productionEndTime: number;

    if (order.readyAt) {
      // Se readyAt existe, usamos ele (o mais preciso)
      productionEndTime = new Date(order.readyAt).getTime();
    } else if (order.status === 'READY' && order.updatedAt) {
      // Se está READY mas readyAt não foi setado (fallback), usamos updatedAt
      productionEndTime = new Date(order.updatedAt).getTime();
    } else if (isFinalStatus) {
      // Se está em status final (DELIVERED/CANCELLED) mas readyAt não foi setado,
      // usamos updatedAt como fallback apenas se existir (mantém preparo intacto); caso contrário, createdAt
      productionEndTime = order.updatedAt ? new Date(order.updatedAt).getTime() : createdAt;
    } else {
      // Se está NEW ou PREPARING, o fim da produção é o tempo atual
      productionEndTime = now;
    }

    // --- CÁLCULOS ---

    // 1. Tempo de Espera (NEW): Tempo até o Início do Preparo
    // Se o pedido está em NEW, o tempo de espera é o tempo total desde a criação até agora.
    // Se já saiu de NEW, é o tempo entre criação e o início real do preparo (preparingStartedAt).
    const isNew = order.status === 'NEW';
    const tempoEsperaMs = isNew ? (now - createdAt) : (preparingStartTime - createdAt);
    const tempoEspera = Math.max(0, Math.floor(tempoEsperaMs / 1000));

    // 2. Tempo de Preparo (PREPARING): Tempo entre iniciar preparo e ficar pronto
    // Se está em NEW, preparo é 0.
    // Se está em PREPARING, é o tempo desde o início do preparo até agora.
    // Se já passou de PREPARING, é o tempo entre início do preparo e readyAt.
    let tempoPreparoMs = 0;
    if (order.status !== 'NEW') {
      const isPreparing = order.status === 'PREPARING';
      const endPrep = isPreparing ? now : productionEndTime;
      tempoPreparoMs = endPrep - preparingStartTime;
    }
    const tempoPreparo = Math.max(0, Math.floor(tempoPreparoMs / 1000));

    // 3. Tempo para Entregar (READY): Tempo entre ficar pronto e ser entregue
    // Se não está em READY ou superior, é 0.
    // Se está em READY, é o tempo desde que ficou pronto até agora.
    // Se já foi entregue, é o tempo entre pronto e entregue.
    let tempoEntregaMs = 0;
    const isReadyStatus = order.status === 'READY';
    const isReadyOrHigher = isReadyStatus || isFinalStatus;
    if (isReadyOrHigher) {
      const endDelivery = isFinalStatus ? finalTime : now;
      tempoEntregaMs = endDelivery - productionEndTime;
    }
    const tempoEntrega = Math.max(0, Math.floor(tempoEntregaMs / 1000));

    // 4. Tempo Cozinha (SLA): Espera + Preparo (Tudo até ficar pronto)
    // Se já está pronto/entregue, é o tempo fixo (productionEndTime - createdAt).
    // Caso contrário, é o tempo decorrido até agora.
    const kitchenEndTime = (order.status === 'READY' || isFinalStatus) ? productionEndTime : now;
    const tempoCozinhaMs = kitchenEndTime - createdAt;
    const tempoCozinha = Math.max(0, Math.floor(tempoCozinhaMs / 1000));
    const wasLate = (tempoCozinha / 60) > slaMinutes;

    // 5. Tempo Total Decorrido
    const tempoTotalDecorrido = finalTime - createdAt;

    // Se o status for final, usamos os valores fixos calculados acima.
    if (isFinalStatus) {
      return {
        tempoEspera: Math.floor((preparingStartTime - createdAt) / 1000),
        tempoPreparo: Math.floor((productionEndTime - preparingStartTime) / 1000),
        tempoEntrega: Math.floor((finalTime - productionEndTime) / 1000),
        tempoCozinha: Math.floor((productionEndTime - createdAt) / 1000),
        tempoTotalDecorrido: Math.floor((finalTime - createdAt) / 1000),
        wasLate: ((productionEndTime - createdAt) / 60000) > slaMinutes,
      };
    }

    // Se o status for ativo, usamos os valores em tempo real (que dependem de 'now' ou 'timeElapsed')
    return {
      tempoEspera: Math.max(0, tempoEspera),
      tempoPreparo: Math.max(0, tempoPreparo),
      tempoEntrega: Math.max(0, tempoEntrega),
      tempoCozinha: Math.max(0, tempoCozinha),
      tempoTotalDecorrido: Math.max(0, Math.floor(tempoTotalDecorrido / 1000)),
      wasLate,
    };
  }, [order, isTimerActive, timeElapsed]); // timeElapsed é a dependência do useTimer

  // Se o pedido estiver ativo (NEW, PREPARING, READY), mostramos as 5 métricas em tempo real
  if (isTimerActive) {
    return (
      <div className={`text-xs font-medium flex flex-col space-y-1`}>
        <div className="flex justify-between">
          <span className="text-gray-500">Espera:</span>
          <span className="font-medium">{formatDurationSeconds(tempoEspera)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Preparo:</span>
          <span className="font-medium">{formatDurationSeconds(tempoPreparo, { minSeconds: 1 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Entrega:</span>
          <span className="font-medium">{formatDurationSeconds(tempoEntrega, { minSeconds: 1 })}</span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
          <span className="text-gray-500">Cozinha (SLA):</span>
          <span className={`font-bold ${wasLate ? 'text-red-600' : 'text-green-600'}`}>
            {formatDurationSeconds(tempoCozinha)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Total Decorrido:</span>
          <span className="font-medium">{formatDurationSeconds(tempoTotalDecorrido)}</span>
        </div>
        <span className="text-gray-500">SLA: {slaMinutes}m</span>
      </div>
    );
  }

  // Se o pedido estiver concluído (DELIVERED, CANCELLED), mostramos as 5 métricas finais
  return (
    <div className={`text-xs font-medium flex flex-col space-y-1`}>
      <div className="flex justify-between">
        <span className="text-gray-500">Espera:</span>
        <span className="font-medium">{formatDurationSeconds(tempoEspera)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Preparo:</span>
        <span className="font-medium">{formatDurationSeconds(tempoPreparo, { minSeconds: 1 })}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Entrega:</span>
        <span className="font-medium">{formatDurationSeconds(tempoEntrega, { minSeconds: 1 })}</span>
      </div>
      <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
        <span className="text-gray-500">Cozinha (SLA):</span>
        <span className={`font-bold ${wasLate ? 'text-red-600' : 'text-green-600'}`}>
          {formatDurationSeconds(tempoCozinha)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Total Decorrido:</span>
        <span className="font-medium">{formatDurationSeconds(tempoTotalDecorrido)}</span>
      </div>
      <span className="text-gray-500">SLA: {slaMinutes}m</span>
    </div>
  );
}


export default function OrderListTab({ orders, onMarkAsDelivered }: OrderListTabProps) {
  const { store } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | Order['status']>('all');

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (filterStatus !== 'all') {
      result = result.filter(order => order.status === filterStatus);
    }

    if (searchTerm.trim()) {
      const lowerCaseSearch = searchTerm.trim().toLowerCase();
      result = result.filter(order =>
        order.pin.toLowerCase().includes(lowerCaseSearch) ||
        order.password.toLowerCase().includes(lowerCaseSearch) ||
        order.customerWhatsApp?.includes(lowerCaseSearch)
      );
    }

    // Ordenar do mais recente para o mais antigo
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, searchTerm, filterStatus]);

  const getStatusClasses = (status: Order['status']) => {
    switch (status) {
      case 'DELIVERED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      case 'READY': return 'bg-blue-100 text-blue-800';
      case 'PREPARING': return 'bg-yellow-100 text-yellow-800';
      case 'NEW': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Mapeamento de Status para Português
  const statusTranslation = {
    NEW: 'Novo',
    PREPARING: 'Em Preparo',
    READY: 'Pronto',
    DELIVERED: 'Entregue',
    CANCELLED: 'Cancelado',
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Histórico de Pedidos</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por PIN, Senha ou WhatsApp..."
              label="Buscar Pedido:"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Status:
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as Order['status'] | 'all')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
            >
              <option value="all">Todos os Status</option>
              <option value="NEW">{statusTranslation.NEW}</option>
              <option value="PREPARING">{statusTranslation.PREPARING}</option>
              <option value="READY">{statusTranslation.READY}</option>
              <option value="DELIVERED">{statusTranslation.DELIVERED}</option>
              <option value="CANCELLED">{statusTranslation.CANCELLED}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center">
            <i className="ri-file-list-line text-4xl text-gray-400 mb-4"></i>
            <p className="text-gray-500">Nenhum pedido encontrado com os filtros atuais.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[60vh]">
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
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Data/Hora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Tempo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-96">
                    Itens & Produção
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                    Pagamento & Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => {
                  const paymentDetails = consolidatePayments(order);

                  // Detalhes de pagamento em dinheiro
                  const isCashPayment = order.paymentMethod?.toLowerCase().includes('dinheiro') ||
                    (order.paymentMethod === 'MÚLTIPLO' && order.paymentBreakdown &&
                      Object.keys(order.paymentBreakdown).some(m => m.toLowerCase().includes('dinheiro')));

                  const amountPaid = order.amountPaid;
                  const changeAmount = order.changeAmount;

                  // Horário de entrega
                  const deliveredTime = order.status === 'DELIVERED' && (order.deliveredAt || order.updatedAt)
                    ? new Date(order.deliveredAt || order.updatedAt!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : null;

                  // Progresso de entrega parcial por pedido (todas unidades de todos os itens)
                  const totalUnitsSum = order.items.reduce((acc, di) => {
                    const unitsPerItem = Math.max(1, di.menuItem.unitDeliveryCount || 1);
                    return acc + Math.max(1, di.quantity * unitsPerItem);
                  }, 0);
                  const deliveredUnitsSum = order.items.reduce((acc, di) => {
                    const units = Array.isArray(di.productionUnits) ? di.productionUnits : [];
                    const deliveredPerItem = units.filter(u => !!u.deliveredAt || order.status === 'DELIVERED').length;
                    return acc + deliveredPerItem;
                  }, 0);
                  // Não mostrar parcial se o pedido estiver completamente entregue
                  const hasPartialDelivery = deliveredUnitsSum > 0 && deliveredUnitsSum < totalUnitsSum && order.status !== 'DELIVERED';


                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 align-top">
                        <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-bold inline-block w-fit">
                          {formatOrderPin(order.pin)}
                        </span>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="text-sm font-bold text-blue-600">
                          {order.password}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusClasses(order.status)}`}>
                          {statusTranslation[order.status]}
                        </span>
                        {hasPartialDelivery && (
                          <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
                            <i className="ri-time-line mr-1"></i>
                            entregue parcial {deliveredUnitsSum}/{totalUnitsSum}
                          </div>
                        )}
                        {deliveredTime && (
                          <div className="text-xs text-green-600 font-medium mt-1">
                            Entregue às {deliveredTime}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4 align-top text-sm text-gray-900">
                        <div className="text-xs text-gray-600">
                          {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                        <div className="text-sm font-medium">
                          {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <OrderTimeStatus order={order} />
                      </td>

                      <td className="px-4 py-4 align-top text-sm text-gray-900">
                        <div className="space-y-3">
                          {order.items.map((item, index) => {
                            const requiredOptions = extractRequiredOptions(item.observations);
                            const optionalObservations = extractOptionalObservations(item.observations);
                            const deliveredCount = Array.isArray(item.productionUnits)
                              ? item.productionUnits.filter(u => !!u.deliveredAt || order.status === 'DELIVERED').length
                              : Math.max(0, item.directDeliveredUnitCount || 0);
                            const totalUnitsForItem = Math.max(1, item.quantity * Math.max(1, item.menuItem.unitDeliveryCount || 1));
                            const isItemPartiallyDelivered = deliveredCount > 0 && deliveredCount < totalUnitsForItem;

                            return (
                              <div key={index} className="border border-gray-200 rounded-lg p-2 bg-white">
                                <div className="text-sm font-medium mb-1 flex items-center">
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
                                  {/* Removido: chip "entregue" no nível do item */}
                                  {isItemPartiallyDelivered && order.status !== 'DELIVERED' && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 align-middle">
                                      <i className="ri-time-line mr-1"></i>
                                      entregue parcial {deliveredCount}/{totalUnitsForItem}
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
                                <div className="space-y-1">
                                  {((item.productionUnits && item.productionUnits.length > 0) ? item.productionUnits : Array.from({ length: totalUnitsForItem }).map((_, idx) => ({ unitId: `direct-${idx}`, completedAt: undefined, operatorName: undefined, unitStatus: undefined as any }))).map((unit: any, unitIndex: number) => {
                                    const isUnitReady = unit.unitStatus === 'READY';
                                    const deliveredTimesArr = (item as any).directDeliveredUnitTimes || [];
                                    const isUnitDelivered = !!unit.deliveredAt || !!deliveredTimesArr[unitIndex] || (order.status === 'DELIVERED');
                                    // Exibir horário de entrega:
                                    // - Para itens de entrega direta: quando a unidade está entregue, usar timestamp da unidade ou fallback do pedido
                                    // - Para itens de cozinha: quando o pedido inteiro está entregue, usar order.deliveredAt
                                    const shouldShowDeliveredUnitTime = isUnitDelivered;
                                    const deliveredDate = shouldShowDeliveredUnitTime
                                      ? (unit.deliveredAt ? new Date(unit.deliveredAt) : (deliveredTimesArr[unitIndex] || (order.status === 'DELIVERED' && order.deliveredAt ? new Date(order.deliveredAt) : undefined)))
                                      : undefined;
                                    const deliveredTimeUnit = deliveredDate
                                      ? new Date(deliveredDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                      : undefined;

                                    // Determinar a cor da bolinha e o texto do status
                                    let statusColor = 'bg-yellow-500';

                                    if (item.skipKitchen) {
                                      statusColor = isUnitDelivered ? 'bg-green-500' : 'bg-amber-500';
                                    } else {
                                      if (isUnitReady) {
                                        statusColor = 'bg-green-500';
                                      } else if (order.status === 'NEW') {
                                        statusColor = 'bg-gray-400';
                                      } else if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
                                        statusColor = 'bg-green-500';
                                      }
                                    }

                                    // CORREÇÃO: Usar unit.completedAt se existir
                                    const completionTime = unit.completedAt
                                      ? new Date(unit.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                      : '-';

                                    return (
                                      <div key={unit.unitId} className="flex justify-between text-xs text-gray-600">
                                        <div className="flex items-center space-x-1">
                                          <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
                                          <span className="font-medium">Unidade {unitIndex + 1}</span>
                                          {unit.operatorName && (
                                            <span className="text-blue-600 bg-blue-50 px-1 rounded">
                                              {unit.operatorName}
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
                                            <span className={`font-medium ${isUnitReady ? 'text-green-700' : 'text-gray-500'}`}>
                                              Pronto às {completionTime}
                                            </span>
                                          )}
                                          {deliveredTimeUnit && (
                                            <span className="text-gray-700 font-medium">
                                              Entregue às {deliveredTimeUnit}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top text-sm text-gray-900">
                        <div className="space-y-1 mb-2">
                          {paymentDetails.map((p, index) => (
                            <div key={index} className="text-xs flex justify-between">
                              <span className="text-gray-600">{p.method}:</span>
                              <span className="font-medium">R$ {p.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Detalhes de pagamento em dinheiro/troco */}
                        {isCashPayment && amountPaid !== undefined && changeAmount !== undefined && (
                          <div className="mt-2 pt-2 border-t border-green-200 bg-green-50 rounded p-1.5">
                            <div className="text-xs flex justify-between">
                              <span className="text-green-700">Pago:</span>
                              <span className="font-medium text-green-800">R$ {amountPaid.toFixed(2)}</span>
                            </div>
                            <div className="text-xs flex justify-between">
                              <span className="text-green-700">Troco:</span>
                              <span className="font-bold text-green-800">R$ {changeAmount.toFixed(2)}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between border-t pt-1 mt-1">
                          <span className="font-semibold text-gray-900">Total:</span>
                          <span className="font-bold text-amber-600">R$ {order.total.toFixed(2)}</span>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top space-y-2">
                        {order.status === 'READY' && (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => onMarkAsDelivered(order.id)}
                            className="w-full"
                          >
                            <i className="ri-check-double-line mr-1"></i>
                            Entregue
                          </Button>
                        )}

                        {/* Botão de Impressão - AGORA DISPONÍVEL PARA TODOS */}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            printOrder(order, undefined, store?.name);
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
      </div>
    </div>
  );
}
