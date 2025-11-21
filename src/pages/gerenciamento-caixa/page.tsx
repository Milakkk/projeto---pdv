import { useState, useMemo } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import Button from '../../components/base/Button';
import Input from '../../components/base/Input';
import Modal from '../../components/base/Modal';
import { OperationalSession } from '../../types'; // Importando OperationalSession
import { calculateExpectedAmount } from '../../utils/cash'; // Importando a função unificada

// Importando a interface CashMovement (assumindo que ela está definida em CashMovement.tsx ou types/index.ts)
// Como CashMovement.tsx não exporta a interface, vamos defini-la aqui para evitar dependência circular ou erro de tipo.
// Vou assumir a estrutura necessária para o cálculo:
interface CashMovement {
  id: string;
  type: 'IN' | 'OUT' | 'SALE';
  amount: number;
  description: string;
  timestamp: Date;
  sessionId: string;
  orderId?: string;
}

interface CashBreakdown {
  notes: { [key: string]: number };
  coins: { [key: string]: number };
}

interface CashSession {
  id: string;
  operatorName: string;
  initialAmount: number;
  openingTime: Date;
  closingTime?: Date;
  finalAmount?: number;
  expectedAmount?: number;
  difference?: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
  justification?: string;
  cashBreakdown?: CashBreakdown; // Adicionado para exibir o método de contagem
  initialAmountInputMode?: 'total' | 'breakdown'; // Adicionado para exibir o método de contagem
  finalAmountInputMode?: 'total' | 'breakdown'; // Adicionado para exibir o método de contagem
}


// Função para criar um objeto Date no início do dia local
const createLocalStartOfDay = (dateString: string) => {
  if (!dateString) return null; // Adicionando verificação de segurança
  const parts = dateString.split('-');
  if (parts.length !== 3) return null; // Garantir formato YYYY-MM-DD
  const [year, month, day] = parts.map(Number);
  // Cria a data no fuso horário local
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

// Função para criar um objeto Date no final do dia local
const createLocalEndOfDay = (dateString: string) => {
  if (!dateString) return null; // Adicionando verificação de segurança
  const parts = dateString.split('-');
  if (parts.length !== 3) return null; // Garantir formato YYYY-MM-DD
  const [year, month, day] = parts.map(Number);
  // Cria a data no fuso horário local
  return new Date(year, month - 1, day, 23, 59, 59, 999);
};


export default function GerenciamentoCaixaPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const [selectedCashSessionData, setSelectedCashSessionData] = useState<CashSession | null>(null);
  const [selectedOperationalSession, setSelectedOperationalSession] = useState<OperationalSession | null>(null);

  const [operationalSessionsHistory] = useLocalStorage<OperationalSession[]>('operationalSessionsHistory', []);
  const [currentOperationalSession] = useLocalStorage<OperationalSession | null>('currentOperationalSession', null);
  const [cashSessions] = useLocalStorage<CashSession[]>('cashSessions', []);
  const [cashMovements] = useLocalStorage<CashMovement[]>('cashMovements', []);

  const handlePasswordSubmit = () => {
    // Senha de acesso ao gerenciamento de caixa (Gerente/Master)
    if (password === '159753') { 
      setIsAuthenticated(true);
      setShowPasswordModal(false);
      setPassword('');
    } else {
      alert('Senha incorreta!');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setShowPasswordModal(true);
    setPassword('');
  };

  // Combina a sessão atual (se aberta) com o histórico
  const allOperationalSessions = useMemo(() => {
    let sessions = [...operationalSessionsHistory];
    if (currentOperationalSession && currentOperationalSession.status === 'OPEN') {
      // Adiciona a sessão atual no topo
      sessions = [currentOperationalSession, ...sessions.filter(s => s.id !== currentOperationalSession.id)];
    }
    return sessions;
  }, [operationalSessionsHistory, currentOperationalSession]);

  // Filtra sessões operacionais por data
  const filteredOperationalSessions = useMemo(() => {
    return allOperationalSessions.filter(session => {
      const sessionDate = new Date(session.openingTime);
      
      let start: Date | null = null;
      if (startDate) {
        start = createLocalStartOfDay(startDate);
      }
      
      let end: Date | null = null;
      if (endDate) {
        end = createLocalEndOfDay(endDate);
      }

      if (start && sessionDate < start) return false;
      if (end && sessionDate > end) return false;

      return true;
    });
  }, [allOperationalSessions, startDate, endDate]);

  // Total de vendas (apenas movimentos SALE)
  const totalSales = useMemo(() => {
    // CORREÇÃO: Filtra apenas movimentos SALE que são dinheiro (não temos como saber o método de pagamento aqui, 
    // mas assumimos que o movimento SALE só é registrado se for dinheiro, conforme a lógica do Cart.tsx)
    return cashMovements.filter(m => m.type === 'SALE').reduce((s, m) => s + m.amount, 0);
  }, [cashMovements]);

  const viewCashSessionDetails = (session: CashSession) => {
    setSelectedCashSessionData(session);
    setShowSessionDetails(true);
  };
  
  const viewOperationalSessionDetails = (session: OperationalSession) => {
    setSelectedOperationalSession(session);
  };

  // Dados detalhados para o modal de CashSession
  const cashSessionDetails = useMemo(() => {
    if (!selectedCashSessionData) return null;

    const movements = cashMovements.filter(movement => movement.sessionId === selectedCashSessionData.id);
    const initialAmount = selectedCashSessionData.initialAmount;
    
    const sales = movements.filter(m => m.type === 'SALE');
    const entries = movements.filter(m => m.type === 'IN');
    const withdrawals = movements.filter(m => m.type === 'OUT');
    
    const totalSales = sales.reduce((sum, m) => sum + m.amount, 0);
    const totalEntries = entries.reduce((sum, m) => sum + m.amount, 0);
    const totalWithdrawals = withdrawals.reduce((sum, m) => sum + m.amount, 0);
    
    // O valor esperado é recalculado aqui para garantir que está correto, 
    // mesmo que a sessão não tenha sido fechada corretamente.
    const expectedAmount = calculateExpectedAmount(selectedCashSessionData, cashMovements);
    
    // NOVO: Recalcular a diferença usando o valor contado salvo e o valor esperado recalculado
    const finalAmount = selectedCashSessionData.finalAmount || 0;
    const recalculatedDifference = finalAmount - expectedAmount;

    const allMovements = [...sales, ...entries, ...withdrawals].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      initialAmount,
      totalSales,
      totalEntries,
      totalWithdrawals,
      expectedAmount,
      recalculatedDifference, // Adicionando a diferença recalculada
      allMovements
    };
  }, [selectedCashSessionData, cashMovements]); 
  
  // Filtra CashSessions que ocorreram durante a OperationalSession selecionada
  const cashSessionsInOperationalSession = useMemo(() => {
    if (!selectedOperationalSession) return [];
    
    const opStart = new Date(selectedOperationalSession.openingTime).getTime();
    const opEnd = selectedOperationalSession.closingTime ? new Date(selectedOperationalSession.closingTime).getTime() : Date.now();
    
    return cashSessions.filter(cs => {
      const csStart = new Date(cs.openingTime).getTime();
      const csEnd = cs.closingTime ? new Date(cs.closingTime).getTime() : Date.now();
      
      // A CashSession deve ter começado e terminado (ou estar em andamento) dentro do período da OperationalSession
      return csStart >= opStart && csEnd <= opEnd;
    }).sort((a, b) => new Date(a.openingTime).getTime() - new Date(b.openingTime).getTime());
  }, [selectedOperationalSession, cashSessions]);


  if (!isAuthenticated) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <i className="ri-lock-line text-6xl text-gray-400 mb-4"></i>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Área Restrita</h2>
            <p className="text-gray-600 mb-6">Digite a senha para acessar o gerenciamento de caixa</p>
          </div>
        </div>

        <Modal
          isOpen={showPasswordModal}
          onClose={() => {}}
          title="Acesso ao Gerenciamento de Caixa"
          size="sm"
        >
          <div className="space-y-4">
            <div className="text-center">
              <i className="ri-shield-keyhole-line text-4xl text-amber-600 mb-3"></i>
              <p className="text-gray-600">Digite a senha de acesso</p>
            </div>

            <div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha de acesso"
                className="w-full text-center"
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                autoFocus
              />
            </div>

            <Button
              onClick={handlePasswordSubmit}
              className="w-full"
              disabled={!password.trim()}
            >
              <i className="ri-login-circle-line mr-2"></i>
              Acessar
            </Button>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Caixa</h1>
            <p className="text-gray-600">Controle e relatórios de sessões operacionais e de caixa</p>
          </div>
          <Button
            variant="secondary"
            onClick={handleLogout}
          >
            <i className="ri-logout-circle-line mr-2"></i>
            Sair
          </Button>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <h3 className="font-medium text-gray-900 mb-4">Filtros de Sessão Operacional</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data inicial:
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data final:
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="w-full"
              >
                <i className="ri-refresh-line mr-2"></i>
                Limpar Filtros
              </Button>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className="ri-calendar-line text-blue-600"></i>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">Total de Sessões Operacionais</p>
                <p className="text-xl font-bold text-gray-900">{allOperationalSessions.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="ri-check-circle-line text-green-600"></i>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">Sessões de Caixa Fechadas</p>
                <p className="text-xl font-bold text-gray-900">{cashSessions.filter(s => s.status === 'CLOSED').length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <i className="ri-time-line text-yellow-600"></i>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">Sessões de Caixa Abertas</p>
                <p className="text-xl font-bold text-gray-900">{cashSessions.filter(s => s.status === 'OPEN').length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <i className="ri-money-dollar-circle-line text-amber-600"></i>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-600">Total em Vendas (Dinheiro)</p>
                <p className="text-xl font-bold text-gray-900">R$ {totalSales.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Sessões Operacionais */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Sessões Operacionais</h3>
          </div>

          {filteredOperationalSessions.length === 0 ? (
            <div className="p-8 text-center">
              <i className="ri-inbox-line text-4xl text-gray-400 mb-4"></i>
              <p className="text-gray-500">Nenhuma sessão operacional encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      PIN
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      Loja
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      Aberto por
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      Abertura
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      Fechamento
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOperationalSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="font-bold text-blue-600">{session.pin}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {session.storeName}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {session.openedByUserName}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(session.openingTime).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {session.closingTime 
                          ? new Date(session.closingTime).toLocaleString('pt-BR')
                          : '-'
                        }
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          session.status === 'OPEN'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {session.status === 'OPEN' ? 'Aberta' : 'Fechada'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => viewOperationalSessionDetails(session)}
                        >
                          <i className="ri-eye-line mr-1"></i>
                          Ver Detalhes
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalhes da SESSÃO OPERACIONAL */}
      <Modal
        isOpen={!!selectedOperationalSession}
        onClose={() => setSelectedOperationalSession(null)}
        title={`Detalhes da Sessão Operacional - ${selectedOperationalSession?.pin}`}
        size="2xl"
      >
        {selectedOperationalSession && (
          <div className="space-y-6">
            {/* Informações gerais da Sessão Operacional */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-3">Sessão Operacional</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Loja: </span>
                  <span className="font-medium text-blue-800">{selectedOperationalSession.storeName}</span>
                </div>
                <div>
                  <span className="text-blue-700">Status: </span>
                  <span className={`font-medium text-blue-800 ${selectedOperationalSession.status === 'OPEN' ? 'text-green-600' : 'text-gray-600'}`}>
                    {selectedOperationalSession.status === 'OPEN' ? 'Aberta' : 'Fechada'}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Abertura: </span>
                  <span className="font-medium text-blue-800">
                    {new Date(selectedOperationalSession.openingTime).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="text-blue-700">Fechamento: </span>
                  <span className="font-medium text-blue-800">
                    {selectedOperationalSession.closingTime 
                      ? new Date(selectedOperationalSession.closingTime).toLocaleString('pt-BR')
                      : 'Em andamento'
                    }
                  </span>
                </div>
              </div>
            </div>
            
            {/* Sessões de Caixa dentro desta Sessão Operacional */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Sessões de Caixa ({cashSessionsInOperationalSession.length})</h4>
              
              {cashSessionsInOperationalSession.length === 0 ? (
                <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
                  Nenhuma sessão de caixa registrada neste período.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full min-w-max">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Operador</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Abertura</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fechamento</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Esperado</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diferença</th>
                        {/* Indicador entre sessões com rótulo compacto */}
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Abertura x Últ. Fech.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {cashSessionsInOperationalSession.map(session => {
                        // Se a sessão estiver fechada, usamos os valores salvos (expectedAmount e difference)
                        const expectedAmount = session.status === 'CLOSED' && session.expectedAmount !== undefined
                          ? session.expectedAmount
                          : calculateExpectedAmount(session, cashMovements);
                          
                        const difference = session.status === 'CLOSED' && session.difference !== undefined
                          ? session.difference
                          : (session.finalAmount !== undefined ? session.finalAmount - expectedAmount : 0);
                          
                        const hasDifference = session.status === 'CLOSED' && Math.abs(difference) > 0.01;

                        // NOVO: Diferença entre a abertura desta sessão e o último fechamento anterior
                        const sessionOpeningTime = new Date(session.openingTime).getTime();
                        const previousClosedSession = cashSessions
                          .filter(s => s.status === 'CLOSED' && s.closingTime && new Date(s.closingTime).getTime() < sessionOpeningTime)
                          .sort((a, b) => new Date(b.closingTime!).getTime() - new Date(a.closingTime!).getTime())[0];

                        // Fallback robusto para obter o valor de fechamento da sessão anterior
                        const previousFinalAmount = previousClosedSession
                          ? (previousClosedSession.finalAmount ?? (
                              previousClosedSession.expectedAmount !== undefined && previousClosedSession.difference !== undefined
                                ? previousClosedSession.expectedAmount + previousClosedSession.difference
                                : 0
                            ))
                          : null;

                        const interSessionDelta = previousFinalAmount !== null
                          ? (session.initialAmount - previousFinalAmount)
                          : null;
                        const hasInterSessionDifference = interSessionDelta !== null && Math.abs(interSessionDelta) > 0.01;
                        
                        return (
                          <tr key={session.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{session.operatorName}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {new Date(session.openingTime).toLocaleTimeString('pt-BR')}
                            </td>
                            {/* NOVO: Coluna de Fechamento */}
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {session.closingTime ? new Date(session.closingTime).toLocaleTimeString('pt-BR') : '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">R$ {expectedAmount.toFixed(2)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {session.status === 'CLOSED' ? (
                                <span className={`font-medium ${hasDifference ? 'text-red-600' : 'text-green-600'}`}>
                                  R$ {difference.toFixed(2)}
                                </span>
                              ) : ('-')}
                            </td>
                            {/* NOVO: Indicador de diferença entre sessões */}
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {interSessionDelta === null ? (
                                <span className="text-gray-400">-</span>
                              ) : (
                                <span className={`font-medium ${hasInterSessionDifference ? (interSessionDelta! > 0 ? 'text-yellow-600' : 'text-red-600') : 'text-green-600'}`}>
                                  {interSessionDelta! > 0 ? '+' : ''} R$ {interSessionDelta!.toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                session.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {session.status === 'OPEN' ? 'Aberta' : 'Fechada'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Button size="sm" variant="secondary" onClick={() => viewCashSessionDetails(session)}>
                                <i className="ri-eye-line"></i>
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

            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => setSelectedOperationalSession(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de detalhes da CashSession (mantido) */}
      <Modal
        isOpen={showSessionDetails}
        onClose={() => setShowSessionDetails(false)}
        title={`Detalhes da Sessão de Caixa - ${selectedCashSessionData?.operatorName}`}
        size="lg"
      >
        {selectedCashSessionData && cashSessionDetails && (
          <div className="space-y-6">
            {/* Informações gerais */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Informações Gerais</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Operador:</span>
                  <span className="font-medium ml-2">{selectedCashSessionData.operatorName}</span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ml-2 ${
                    selectedCashSessionData.status === 'OPEN' ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {selectedCashSessionData.status === 'OPEN' ? 'Aberto' : 'Fechado'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Abertura:</span>
                  <span className="font-medium ml-2">
                    {new Date(selectedCashSessionData.openingTime).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Fechamento:</span>
                  <span className="font-medium ml-2">
                    {selectedCashSessionData.closingTime 
                      ? new Date(selectedCashSessionData.closingTime).toLocaleString('pt-BR')
                      : 'Em andamento'
                    }
                  </span>
                </div>
                {/* NOVO: Método de Contagem na Abertura */}
                <div>
                  <span className="text-gray-600">Método Abertura:</span>
                  <span className="font-medium ml-2">
                    {selectedCashSessionData.initialAmountInputMode === 'breakdown' ? 'Contagem Detalhada' : 'Valor Total'}
                  </span>
                </div>
                {/* NOVO: Método de Contagem no Fechamento */}
                {selectedCashSessionData.status === 'CLOSED' && (
                  <div>
                    <span className="text-gray-600">Método Fechamento:</span>
                    <span className="font-medium ml-2">
                      {selectedCashSessionData.finalAmountInputMode === 'breakdown' ? 'Contagem Detalhada' : 'Valor Total'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Cálculo do Valor Esperado */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                <i className="ri-calculator-line mr-2"></i>
                Cálculo do Valor Esperado
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Valor Inicial:</span>
                  <span className="font-bold text-blue-900">R$ {cashSessionDetails.initialAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Total de Vendas (Dinheiro):</span>
                  <span className="font-bold text-green-600">+ R$ {cashSessionDetails.totalSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Total de Entradas:</span>
                  <span className="font-bold text-green-600">+ R$ {cashSessionDetails.totalEntries.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Total de Retiradas:</span>
                  <span className="font-bold text-red-600">- R$ {cashSessionDetails.totalWithdrawals.toFixed(2)}</span>
                </div>
                <div className="border-t border-blue-300 pt-2 flex justify-between">
                  <span className="text-lg font-bold text-blue-900">VALOR ESPERADO:</span>
                  <span className="text-lg font-bold text-blue-900">R$ {cashSessionDetails.expectedAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Valores de Fechamento e Diferença */}
            {selectedCashSessionData.status === 'CLOSED' && (
              <div className="bg-gray-100 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Conferência Final</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Valor contado (Final):</span>
                    <span className="font-bold ml-2 text-gray-900">
                      R$ {selectedCashSessionData.finalAmount?.toFixed(2) || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Diferença:</span>
                    <span className={`font-bold ml-2 ${
                      Math.abs(cashSessionDetails.recalculatedDifference) > 0.01
                        ? cashSessionDetails.recalculatedDifference > 0 
                          ? 'text-yellow-600' 
                          : 'text-red-600'
                        : 'text-green-600'
                    }`}>
                      {/* Usamos o valor recalculado */}
                      {cashSessionDetails.recalculatedDifference > 0 ? '+' : ''} 
                      R$ {cashSessionDetails.recalculatedDifference.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Movimentos Detalhados */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Movimentos Detalhados</h4>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                {cashSessionDetails.allMovements.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    Nenhum movimento registrado
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {cashSessionDetails.allMovements.map((movement) => {
                      const isSale = movement.type === 'SALE';
                      const isEntry = movement.type === 'IN';
                      const isWithdrawal = movement.type === 'OUT';
                      
                      const bgColor = isSale ? 'bg-green-50/50' : isEntry ? 'bg-blue-50/50' : 'bg-red-50/50';
                      const icon = isSale ? 'ri-shopping-cart-line' : isEntry ? 'ri-add-circle-line' : 'ri-subtract-circle-line';
                      const iconColor = isSale ? 'text-green-600' : isEntry ? 'text-blue-600' : 'text-red-600';
                      const amountColor = isSale || isEntry ? 'text-green-600' : 'text-red-600';
                      const sign = isSale || isEntry ? '+' : '-';
                      
                      let title = '';
                      if (isSale) title = 'Venda (Dinheiro)';
                      else if (isEntry) title = 'Entrada';
                      else if (isWithdrawal) title = 'Retirada';
                      
                      const descriptionText = isSale ? movement.description.replace('Venda - ', '') : movement.description;

                      return (
                        <div key={movement.id} className={`p-3 flex items-center justify-between ${bgColor}`}>
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 ${iconColor}`}>
                              <i className={`text-sm ${icon}`}></i>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {title} - {descriptionText}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(movement.timestamp).toLocaleTimeString('pt-BR')}
                              </div>
                            </div>
                          </div>
                          <div className={`text-sm font-medium ${amountColor}`}>
                            {sign} R$ {movement.amount.toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Observações e justificativas */}
            {(selectedCashSessionData.notes || selectedCashSessionData.justification) && (
              <div className="space-y-3">
                {selectedCashSessionData.notes && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Observações:</h5>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                      {selectedCashSessionData.notes}
                    </p>
                  </div>
                )}
                {selectedCashSessionData.justification && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Justificativa da Diferença:</h5>
                    <p className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      {selectedCashSessionData.justification}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => setShowSessionDetails(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
