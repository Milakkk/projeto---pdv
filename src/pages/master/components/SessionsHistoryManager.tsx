import { useState, useMemo } from 'react';
import { useLocalStorage } from '../../../hooks/useLocalStorage';
import { useKitchenSessions, KitchenSession } from '../../../hooks/useDatabase';
import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';

interface CashSessionHistory {
  id: string;
  operatorName: string;
  openingTime: Date;
  closingTime?: Date;
  initialAmount: number;
  finalAmount?: number;
  expectedAmount?: number;
  difference?: number;
  status: 'OPEN' | 'CLOSED';
}

interface OperationalSessionHistory {
  id: string;
  pin: string;
  storeId: string;
  storeName: string;
  openedByUserId: string;
  openedByUserName: string;
  openingTime: Date;
  closingTime?: Date;
  status: 'OPEN' | 'CLOSED';
}

type FilterType = 'all' | 'cash' | 'kitchen' | 'operational';

interface SessionsHistoryManagerProps {
  searchFilter?: string;
}

export default function SessionsHistoryManager({ searchFilter = '' }: SessionsHistoryManagerProps) {
  const [cashSessions] = useLocalStorage<CashSessionHistory[]>('cashSessions', []);
  const [operationalSessions] = useLocalStorage<OperationalSessionHistory[]>('operationalSessionsHistory', []);
  const { sessions: kitchenSessions, closeKitchenSession } = useKitchenSessions();
  
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);

  // Filtrar por data
  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case 'today':
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return { start: todayStart, end: now };
      case 'week':
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: weekStart, end: now };
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: monthStart, end: now };
      default:
        return { start: new Date(0), end: now };
    }
  };

  // Combinar e ordenar todas as sessões
  const allSessions = useMemo(() => {
    const { start, end } = getDateRange();
    const sessions: Array<{
      id: string;
      type: 'cash' | 'kitchen' | 'operational';
      name: string;
      operator: string;
      openedAt: Date;
      closedAt?: Date;
      status: 'OPEN' | 'CLOSED';
      details: any;
    }> = [];

    // Sessões de Caixa
    if (filterType === 'all' || filterType === 'cash') {
      cashSessions.forEach(s => {
        const openedAt = new Date(s.openingTime);
        if (openedAt >= start && openedAt <= end) {
          sessions.push({
            id: s.id,
            type: 'cash',
            name: 'Caixa',
            operator: s.operatorName,
            openedAt,
            closedAt: s.closingTime ? new Date(s.closingTime) : undefined,
            status: s.status,
            details: s,
          });
        }
      });
    }

    // Sessões de Cozinha
    if (filterType === 'all' || filterType === 'kitchen') {
      kitchenSessions.forEach(s => {
        const openedAt = new Date(s.openedAt);
        if (openedAt >= start && openedAt <= end) {
          sessions.push({
            id: s.id,
            type: 'kitchen',
            name: s.kitchenName,
            operator: s.operatorName || 'Não identificado',
            openedAt,
            closedAt: s.closedAt ? new Date(s.closedAt) : undefined,
            status: s.status,
            details: s,
          });
        }
      });
    }

    // Sessões Operacionais
    if (filterType === 'all' || filterType === 'operational') {
      operationalSessions.forEach(s => {
        const openedAt = new Date(s.openingTime);
        if (openedAt >= start && openedAt <= end) {
          sessions.push({
            id: s.id,
            type: 'operational',
            name: `Sessão ${s.pin}`,
            operator: s.openedByUserName,
            openedAt,
            closedAt: s.closingTime ? new Date(s.closingTime) : undefined,
            status: s.status,
            details: s,
          });
        }
      });
    }

    // Filtro por texto
    const filtered = sessions.filter(s => {
      if (!searchFilter) return true;
      const lowerSearch = searchFilter.toLowerCase();
      return (
        s.name.toLowerCase().includes(lowerSearch) ||
        s.operator.toLowerCase().includes(lowerSearch)
      );
    });

    // Ordenar por data (mais recente primeiro)
    return filtered.sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());
  }, [cashSessions, kitchenSessions, operationalSessions, filterType, dateFilter, searchFilter]);

  // Estatísticas
  const stats = useMemo(() => {
    const openKitchens = kitchenSessions.filter(s => s.status === 'OPEN').length;
    const openCash = cashSessions.filter(s => s.status === 'OPEN').length;
    const totalToday = allSessions.filter(s => {
      const today = new Date();
      return s.openedAt.toDateString() === today.toDateString();
    }).length;
    
    return { openKitchens, openCash, totalToday };
  }, [kitchenSessions, cashSessions, allSessions]);

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (start: Date, end?: Date) => {
    const endTime = end || new Date();
    const diff = endTime.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}min`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cash': return 'ri-money-dollar-circle-line';
      case 'kitchen': return 'ri-restaurant-2-line';
      case 'operational': return 'ri-calendar-check-line';
      default: return 'ri-file-list-line';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'cash': return 'text-green-600 bg-green-100';
      case 'kitchen': return 'text-orange-600 bg-orange-100';
      case 'operational': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'cash': return 'Caixa';
      case 'kitchen': return 'Cozinha';
      case 'operational': return 'Sessão Operacional';
      default: return type;
    }
  };

  const handleCloseKitchenSession = (kitchenId: string) => {
    if (confirm('Tem certeza que deseja fechar esta cozinha?')) {
      closeKitchenSession(kitchenId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cards de Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Cozinhas Online</p>
              <p className="text-3xl font-bold">{stats.openKitchens}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="ri-restaurant-2-line text-2xl"></i>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Caixas Abertos</p>
              <p className="text-3xl font-bold">{stats.openCash}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="ri-money-dollar-circle-line text-2xl"></i>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Sessões Hoje</p>
              <p className="text-3xl font-bold">{stats.totalToday}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="ri-calendar-check-line text-2xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Tipo:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos</option>
            <option value="cash">Caixas</option>
            <option value="kitchen">Cozinhas</option>
            <option value="operational">Sessões Operacionais</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Período:</span>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos</option>
            <option value="today">Hoje</option>
            <option value="week">Última Semana</option>
            <option value="month">Este Mês</option>
          </select>
        </div>
      </div>

      {/* Sessões Abertas (Destaque) */}
      {allSessions.filter(s => s.status === 'OPEN').length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Sessões Abertas Agora
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allSessions.filter(s => s.status === 'OPEN').map(session => (
              <div 
                key={session.id}
                className="bg-white rounded-lg p-3 border border-amber-300 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getTypeColor(session.type)}`}>
                    <i className={`${getTypeIcon(session.type)} text-xl`}></i>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{session.name}</p>
                    <p className="text-xs text-gray-500">{session.operator} • {formatDuration(session.openedAt)}</p>
                  </div>
                </div>
                {session.type === 'kitchen' && (
                  <button
                    onClick={() => handleCloseKitchenSession(session.details.kitchenId)}
                    className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                  >
                    Fechar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Sessões */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Histórico de Aberturas e Fechamentos</h3>
          <p className="text-sm text-gray-500">{allSessions.length} registro(s) encontrado(s)</p>
        </div>
        
        {allSessions.length === 0 ? (
          <div className="p-12 text-center">
            <i className="ri-history-line text-5xl text-gray-300 mb-4"></i>
            <p className="text-gray-500">Nenhum registro encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {allSessions.slice(0, 50).map(session => (
              <div 
                key={`${session.type}-${session.id}`}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => {
                  setSelectedSession(session);
                  setShowDetailModal(true);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getTypeColor(session.type)}`}>
                      <i className={`${getTypeIcon(session.type)} text-xl`}></i>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{session.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          session.status === 'OPEN' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {session.status === 'OPEN' ? 'Aberto' : 'Fechado'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {session.operator} • {getTypeName(session.type)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatDateTime(session.openedAt)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Duração: {formatDuration(session.openedAt, session.closedAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={`Detalhes - ${selectedSession?.name || ''}`}
        size="md"
      >
        {selectedSession && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl ${getTypeColor(selectedSession.type)}`}>
              <div className="flex items-center gap-3">
                <i className={`${getTypeIcon(selectedSession.type)} text-3xl`}></i>
                <div>
                  <h3 className="text-lg font-bold">{selectedSession.name}</h3>
                  <p className="opacity-80">{getTypeName(selectedSession.type)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Operador</p>
                <p className="font-medium">{selectedSession.operator}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <p className={`font-medium ${selectedSession.status === 'OPEN' ? 'text-green-600' : 'text-gray-600'}`}>
                  {selectedSession.status === 'OPEN' ? '🟢 Aberto' : '⚪ Fechado'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Abertura</p>
                <p className="font-medium">{formatDateTime(selectedSession.openedAt)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Fechamento</p>
                <p className="font-medium">
                  {selectedSession.closedAt 
                    ? formatDateTime(selectedSession.closedAt) 
                    : 'Em andamento'}
                </p>
              </div>
              <div className="col-span-2 bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Duração Total</p>
                <p className="font-medium text-lg">{formatDuration(selectedSession.openedAt, selectedSession.closedAt)}</p>
              </div>
            </div>

            {/* Detalhes específicos de Caixa */}
            {selectedSession.type === 'cash' && selectedSession.details && (
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Detalhes do Caixa</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Valor Inicial:</span>
                    <span className="ml-2 font-medium">
                      R$ {(selectedSession.details.initialAmount || 0).toFixed(2)}
                    </span>
                  </div>
                  {selectedSession.details.finalAmount !== undefined && (
                    <>
                      <div>
                        <span className="text-gray-500">Valor Final:</span>
                        <span className="ml-2 font-medium">
                          R$ {selectedSession.details.finalAmount.toFixed(2)}
                        </span>
                      </div>
                      {selectedSession.details.difference !== undefined && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Diferença:</span>
                          <span className={`ml-2 font-medium ${
                            selectedSession.details.difference > 0 ? 'text-green-600' :
                            selectedSession.details.difference < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            R$ {selectedSession.details.difference.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

