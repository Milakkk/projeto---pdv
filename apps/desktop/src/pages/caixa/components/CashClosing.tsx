import { useState, useMemo } from 'react';
import { useLocalStorage } from '../../../hooks/useLocalStorage';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';
import Modal from '../../../components/base/Modal';
import { CASH_NOTES, CASH_COINS } from '../../../utils/constants';
import { calculateExpectedAmount } from '../../../utils/cash'; // Importando a função unificada

interface CashClosingProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (closingData: CashClosingData, inputMode: 'total' | 'breakdown') => void;
  activeCashSession: CashSession | null; // NOVO PROP
  cashMovements: CashMovement[]; // NOVO PROP
}

export interface CashClosingData {
  id: string;
  sessionId: string;
  operatorName: string;
  finalAmount: number;
  expectedAmount: number; // NOVO: Valor esperado calculado
  difference: number; // NOVO: Diferença calculada
  closingTime: Date;
  notes?: string;
  justification?: string;
  cashBreakdown?: CashBreakdown;
}

interface CashBreakdown {
  notes: { [key: string]: number };
  coins: { [key: string]: number };
}

// Definindo o tipo CashSession para uso interno (deve ser o mesmo que CashSessionHistory no CaixaPage)
interface CashSession {
  id: string;
  operatorName: string;
  initialAmount: number;
  openingTime: Date;
  status: 'OPEN' | 'CLOSED';
}

// Definindo o tipo CashMovement para uso interno (para garantir consistência)
interface CashMovement {
  id: string;
  type: 'IN' | 'OUT' | 'SALE';
  amount: number;
  description: string;
  timestamp: Date;
  sessionId: string;
  orderId?: string;
}

const NOTES = CASH_NOTES;
const COINS = CASH_COINS;

export default function CashClosing({ isOpen, onClose, onConfirm, activeCashSession, cashMovements }: CashClosingProps) {
  const [finalAmountInput, setFinalAmountInput] = useState(''); // Valor digitado no modo 'total'
  const [justification, setJustification] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputMode, setInputMode] = useState<'total' | 'breakdown'>('total');
  const [cashBreakdown, setCashBreakdown] = useState<CashBreakdown>({
    notes: {},
    coins: {}
  });
  
  // Novo estado para controlar a etapa de revisão/justificativa
  const [showFinalReview, setShowFinalReview] = useState(false); 
  const [closingTime, setClosingTime] = useState<Date | null>(null); // Hora de fechamento

  // Usar a sessão ativa da prop
  const cashSession = activeCashSession;

  // Calcular valor esperado (Memoizado para eficiência)
  const expectedAmount = useMemo(() => {
    if (!cashSession) return 0;

    // Usando a função unificada e a prop cashMovements
    return calculateExpectedAmount(cashSession, cashMovements);
  }, [cashSession, cashMovements]);
  
  // Movimentos filtrados para esta sessão
  const sessionMovements = useMemo(() => {
    if (!cashSession) return [];
    return cashMovements
      .filter(movement => movement.sessionId === cashSession.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [cashSession, cashMovements]);
  
  const totalSales = useMemo(() => sessionMovements.filter(m => m.type === 'SALE').reduce((s, m) => s + m.amount, 0), [sessionMovements]);
  const totalEntries = useMemo(() => sessionMovements.filter(m => m.type === 'IN').reduce((s, m) => s + m.amount, 0), [sessionMovements]);
  const totalWithdrawals = useMemo(() => sessionMovements.filter(m => m.type === 'OUT').reduce((s, m) => s + m.amount, 0), [sessionMovements]);


  const calculateTotalFromBreakdown = () => {
    let total = 0;
    
    Object.entries(cashBreakdown.notes).forEach(([value, quantity]) => {
      total += parseFloat(value) * (quantity || 0);
    });
    
    Object.entries(cashBreakdown.coins).forEach(([value, quantity]) => {
      total += parseFloat(value) * (quantity || 0);
    });
    
    return total;
  };

  const updateNoteQuantity = (noteValue: string, quantity: string) => {
    setCashBreakdown(prev => ({
      ...prev,
      notes: {
        ...prev.notes,
        [noteValue]: parseInt(quantity) || 0
      }
    }));
  };

  const updateCoinQuantity = (coinValue: string, quantity: string) => {
    setCashBreakdown(prev => ({
      ...prev,
      coins: {
        ...prev.coins,
        [coinValue]: parseInt(quantity) || 0
      }
    }));
  };

  const totalFromBreakdown = calculateTotalFromBreakdown();
  
  // Valor final contado pelo operador
  const currentAmount = inputMode === 'total' ? Number(finalAmountInput || 0) : totalFromBreakdown;
  
  // Flag para saber se o valor final foi inserido (seja por input ou contagem)
  const isAmountEntered = (inputMode === 'total' && finalAmountInput.trim() && !isNaN(Number(finalAmountInput))) || 
                          (inputMode === 'breakdown' && totalFromBreakdown > 0);

  // Cálculo da diferença (usado internamente para validação)
  const difference = currentAmount - expectedAmount;
  const hasDifference = isAmountEntered && Math.abs(difference) > 0.01; // Tolerância de 1 centavo

  // Função para avançar para a revisão/confirmação
  const handleProceedToReview = () => {
    if (!cashSession) {
      alert('Nenhuma sessão de caixa ativa');
      return;
    }

    let finalAmount = 0;
    
    if (inputMode === 'total') {
      if (!finalAmountInput.trim() || isNaN(Number(finalAmountInput))) {
        alert('Digite um valor final válido');
        return;
      }
      finalAmount = Number(finalAmountInput);
    } else {
      finalAmount = totalFromBreakdown;
      if (finalAmount === 0) {
        alert('Adicione pelo menos uma nota ou moeda');
        return;
      }
    }
    
    // Registrar a hora de fechamento no momento da conferência
    setClosingTime(new Date());
    
    // Se o valor foi inserido, avançamos para a revisão
    setShowFinalReview(true);
  };

  // Função para confirmar o fechamento (após a revisão/justificativa)
  const handleConfirmClosing = async () => {
    if (!closingTime) return; // Deve ter a hora de fechamento registrada
    
    const finalAmount = inputMode === 'total' ? Number(finalAmountInput) : totalFromBreakdown;
    const finalDifference = finalAmount - expectedAmount;
    const needsJustification = Math.abs(finalDifference) > 0.01;

    if (needsJustification) {
      const text = justification.trim();
      if (text.length < 10) {
        alert('A justificativa deve ter pelo menos 10 caracteres.');
        return;
      }
    }

    setIsLoading(true);

    const closingData: CashClosingData = {
      id: Date.now().toString(),
      sessionId: cashSession!.id, // Usamos ! pois a revisão garante que não é nulo
      operatorName: cashSession!.operatorName,
      finalAmount: finalAmount,
      expectedAmount: expectedAmount, // Salvando o valor esperado
      difference: finalDifference, // Salvando a diferença
      closingTime: closingTime, // Usando a hora registrada
      justification: needsJustification ? justification.trim() : undefined,
      cashBreakdown: inputMode === 'breakdown' ? cashBreakdown : undefined
    };

    // Simular delay de processamento
    await new Promise(resolve => setTimeout(resolve, 1000));

    onConfirm(closingData, inputMode); // Passando o inputMode
    
    // Resetar formulário
    setFinalAmountInput('');
    setJustification('');
    setCashBreakdown({ notes: {}, coins: {} });
    setShowFinalReview(false);
    setClosingTime(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    if (!isLoading) {
      // Resetar estados ao fechar
      setFinalAmountInput('');
      setJustification('');
      setCashBreakdown({ notes: {}, coins: {} });
      setInputMode('total');
      setShowFinalReview(false);
      setClosingTime(null);
      onClose();
    }
  };
  
  // Formatação da hora de abertura
  const openingTimeFormatted = cashSession?.openingTime 
    ? new Date(cashSession.openingTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
    : '-';
    
  // Formatação da hora de fechamento
  const closingTimeFormatted = closingTime 
    ? closingTime.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
    : new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });


  if (!cashSession) return null; // Não renderiza se não houver sessão ativa

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Fechamento de Caixa"
      size="lg"
      // Desabilitar fechamento se estiver na revisão
      disableClose={showFinalReview}
      hideCloseButton={showFinalReview}
    >
      <div className="space-y-6">
        {/* Informações da sessão */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <i className="ri-information-line text-blue-600"></i>
            <span className="font-medium text-blue-800">Fechamento de Caixa</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Operador: </span>
              <span className="font-medium text-blue-800">{cashSession.operatorName}</span>
            </div>
            <div>
              <span className="text-blue-700">Abertura: </span>
              <span className="font-medium text-blue-800">
                {openingTimeFormatted}
              </span>
            </div>
            <div>
              <span className="text-blue-700">Valor inicial: </span>
              <span className="font-medium text-blue-800">R$ {cashSession.initialAmount.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-blue-700">Data/Hora Fechamento: </span>
              <span className="font-medium text-blue-800">{closingTimeFormatted}</span>
            </div>
          </div>
        </div>
        
        {/* O bloco de Resumo dos Movimentos foi removido daqui */}

        {/* ETAPA 1: Contagem do Valor Final */}
        {!showFinalReview && (
          <>
            {/* Modo de entrada do valor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Forma de Contagem do Valor Final: *
              </label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setInputMode('total')}
                  className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                    inputMode === 'total'
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                  disabled={isLoading}
                >
                  <div className="text-center">
                    <i className="ri-money-dollar-circle-line text-2xl mb-2"></i>
                    <div className="font-medium">Valor Total</div>
                    <div className="text-xs">Digite o valor total</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('breakdown')}
                  className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                    inputMode === 'breakdown'
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                  disabled={isLoading}
                >
                  <div className="text-center">
                    <i className="ri-calculator-line text-2xl mb-2"></i>
                    <div className="font-medium">Contagem</div>
                    <div className="text-xs">Contar notas e moedas</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Valor total direto */}
            {inputMode === 'total' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor Final em Caixa: *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    R$
                  </span>
                  <Input
                    type="number"
                    value={finalAmountInput}
                    onChange={(e) => setFinalAmountInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-10"
                    step="0.01"
                    min="0"
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Contagem de notas e moedas */}
            {inputMode === 'breakdown' && (
              <div className="space-y-4">
                {/* Notas */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <i className="ri-money-dollar-box-line mr-2 text-green-600"></i>
                    Notas
                  </h4>
                  <div className="grid grid-cols-4 gap-2">
                    {NOTES.map((note) => (
                      <div key={note} className="bg-gray-50 rounded-lg p-2 border">
                        <div className="text-center">
                          <div className="text-xs text-gray-600 mb-1">R$ {note}</div>
                          <input
                            type="number"
                            min="0"
                            value={cashBreakdown.notes[note.toString()] || ''}
                            onChange={(e) => updateNoteQuantity(note.toString(), e.target.value)}
                            className="w-full text-center text-sm border border-gray-200 rounded px-1 py-1 focus:ring-1 focus:ring-green-500 focus:border-transparent"
                            placeholder="0"
                            disabled={isLoading}
                          />
                          {(cashBreakdown.notes[note.toString()] || 0) > 0 && (
                            <div className="text-xs text-green-600 mt-1 font-medium">
                              R$ {(note * (cashBreakdown.notes[note.toString()] || 0)).toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Moedas */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <i className="ri-coins-line mr-2 text-amber-600"></i>
                    Moedas
                  </h4>
                  <div className="grid grid-cols-6 gap-2">
                    {COINS.map((coin) => (
                      <div key={coin} className="bg-gray-50 rounded-lg p-2 border">
                        <div className="text-center">
                          <div className="text-xs text-gray-600 mb-1">
                            {coin >= 1 ? `R$ ${coin.toFixed(0)}` : `${(coin * 100).toFixed(0)}¢`}
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={cashBreakdown.coins[coin.toString()] || ''}
                            onChange={(e) => updateCoinQuantity(coin.toString(), e.target.value)}
                            className="w-full text-center text-sm border border-gray-200 rounded px-1 py-1 focus:ring-1 focus:ring-amber-500 focus:border-transparent"
                            placeholder="0"
                            disabled={isLoading}
                          />
                          {(cashBreakdown.coins[coin.toString()] || 0) > 0 && (
                            <div className="text-xs text-amber-600 mt-1 font-medium">
                              R$ {(coin * (cashBreakdown.coins[coin.toString()] || 0)).toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total calculado */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-800">Total contado:</span>
                    <span className="text-lg font-bold text-blue-900">
                      R$ {totalFromBreakdown.toFixed(2)}
                    </span>
                  </div>
                  {totalFromBreakdown > 0 && (
                    <div className="text-xs text-blue-600 mt-1">
                      {Object.values(cashBreakdown.notes).reduce((sum, count) => sum + (count || 0), 0) + 
                       Object.values(cashBreakdown.coins).reduce((sum, count) => sum + (count || 0), 0)} itens contados
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ETAPA 2: Revisão e Justificativa (Aparece após inserir o valor final) */}
        {showFinalReview && (
          <>
            {/* Comparação e diferença */}
            <div className={`rounded-lg p-4 border-2 ${
              hasDifference 
                ? difference > 0 
                  ? 'bg-yellow-50 border-yellow-300' 
                  : 'bg-red-50 border-red-300'
                : 'bg-green-50 border-green-300'
            }`}>
              <h4 className={`font-medium mb-3 flex items-center ${
                hasDifference 
                  ? difference > 0 
                    ? 'text-yellow-800' 
                    : 'text-red-800'
                  : 'text-green-800'
              }`}>
                <i className={`mr-2 ${
                  hasDifference 
                    ? difference > 0 
                      ? 'ri-error-warning-line' 
                      : 'ri-close-circle-line'
                    : 'ri-check-circle-line'
                }`}></i>
                {hasDifference ? 'Diferença Encontrada' : 'Caixa Conferido'}
              </h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Valor esperado:</span>
                  <span className="font-medium">R$ {expectedAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valor contado:</span>
                  <span className="font-medium">R$ {currentAmount.toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span className="font-medium">Diferença:</span>
                  <span className={`font-bold ${
                    hasDifference 
                      ? difference > 0 
                        ? 'text-yellow-700' 
                        : 'text-red-700'
                      : 'text-green-700'
                  }`}>
                    {difference > 0 ? '+' : ''} R$ {difference.toFixed(2)}
                  </span>
                </div>
              </div>

              {hasDifference && (
                <div className="mt-3 text-xs text-gray-600">
                  {difference > 0 ? 'Sobra de dinheiro no caixa' : 'Falta de dinheiro no caixa'}
                </div>
              )}
            </div>
            
            {/* Movimentos Detalhados (NOVO) */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Movimentos Detalhados da Sessão</h4>
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                {sessionMovements.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">Nenhum movimento registrado.</div>
                ) : (
                  sessionMovements.map((movement) => {
                    const isSale = movement.type === 'SALE';
                    const isEntry = movement.type === 'IN';
                    const isWithdrawal = movement.type === 'OUT';
                    
                    const icon = isSale ? 'ri-shopping-cart-line' : isEntry ? 'ri-add-circle-line' : 'ri-subtract-circle-line';
                    const iconColor = isSale || isEntry ? 'text-green-600' : 'text-red-600';
                    const amountColor = isSale || isEntry ? 'text-green-700' : 'text-red-700';
                    const sign = isSale || isEntry ? '+' : '-';
                    const rowBg = isSale || isEntry ? 'bg-green-50' : 'bg-red-50';
                    
                    let title = '';
                    if (isSale) title = 'Venda (Dinheiro)';
                    else if (isEntry) title = 'Entrada';
                    else if (isWithdrawal) title = 'Retirada';
                    
                    const descriptionText = isSale ? movement.description.replace('Venda - ', '') : movement.description;

                    return (
                      <div key={movement.id} className={`p-2 flex items-center justify-between rounded-md ${rowBg}`}>
                        <div className="flex items-center space-x-2">
                          <i className={`text-sm ${icon} ${iconColor}`}></i>
                          <div className="text-sm text-gray-900 truncate max-w-xs">
                            {title}: {descriptionText}
                          </div>
                        </div>
                        <div className={`text-sm font-medium ${amountColor} flex-shrink-0`}>
                          {sign} R$ {movement.amount.toFixed(2)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Justificativa para diferença - SÓ APARECE SE HOUVER DIFERENÇA */}
            {hasDifference && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Justificativa para a diferença: *
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Explique o motivo da diferença encontrada no caixa..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                  rows={3}
                  maxLength={500}
                  minLength={10}
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {justification.length}/500 caracteres
                  {justification.trim().length < 10 && (
                    <span className="ml-2 text-red-600">(mínimo 10 caracteres)</span>
                  )}
                </p>
              </div>
            )}
          </>
        )}

        {/* Campo de observações removido conforme solicitado */}

        {/* Botões de ação */}
        <div className="flex space-x-3 pt-4 border-t">
          {!showFinalReview && (
            <Button
              variant="secondary"
              onClick={handleClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancelar
            </Button>
          )}

          {!showFinalReview ? (
            <Button
              onClick={handleProceedToReview}
              className="flex-1"
              disabled={!isAmountEntered || isLoading}
            >
              <i className="ri-arrow-right-line mr-2"></i>
              Conferir e Fechar
            </Button>
          ) : (
            <Button
              onClick={handleConfirmClosing}
              className="flex-1"
              disabled={
                (hasDifference && justification.trim().length < 10) ||
                isLoading
              }
            >
              {isLoading ? (
                <>
                  <i className="ri-loader-4-line mr-2 animate-spin"></i>
                  Processando...
                </>
              ) : (
                <>
                  <i className="ri-check-line mr-2"></i>
                  Confirmar Fechamento
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
