import { useState } from 'react';
import { useLocalStorage } from '../../../hooks/useLocalStorage';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';
import Modal from '../../../components/base/Modal';
import { CASH_NOTES, CASH_COINS } from '../../../utils/constants';

interface CashOpeningProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (openingData: CashOpeningData, inputMode: 'total' | 'breakdown') => void;
}

export interface CashOpeningData {
  id: string;
  operatorName: string;
  initialAmount: number;
  openingTime: Date;
  notes?: string;
  cashBreakdown?: CashBreakdown;
}

interface CashBreakdown {
  notes: { [key: string]: number };
  coins: { [key: string]: number };
}

const NOTES = CASH_NOTES;
const COINS = CASH_COINS;

export default function CashOpening({ isOpen, onClose, onConfirm }: CashOpeningProps) {
  const [operatorName, setOperatorName] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputMode, setInputMode] = useState<'total' | 'breakdown'>('total');
  const [cashBreakdown, setCashBreakdown] = useState<CashBreakdown>({
    notes: {},
    coins: {}
  });

  const calculateTotalFromBreakdown = () => {
    let total = 0;
    
    // Somar notas
    Object.entries(cashBreakdown.notes).forEach(([value, quantity]) => {
      total += parseFloat(value) * (quantity || 0);
    });
    
    // Somar moedas
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

  const handleConfirm = async () => {
    if (!operatorName.trim()) {
      alert('Digite o nome do operador');
      return;
    }

    let finalAmount = 0;
    
    if (inputMode === 'total') {
      if (!initialAmount.trim() || isNaN(Number(initialAmount))) {
        alert('Digite um valor inicial válido');
        return;
      }
      finalAmount = Number(initialAmount);
    } else {
      finalAmount = calculateTotalFromBreakdown();
      if (finalAmount === 0) {
        alert('Adicione pelo menos uma nota ou moeda');
        return;
      }
    }

    setIsLoading(true);

    const openingData: CashOpeningData = {
      id: Date.now().toString(),
      operatorName: operatorName.trim(),
      initialAmount: finalAmount,
      openingTime: new Date(),
      notes: notes.trim() || undefined,
      cashBreakdown: inputMode === 'breakdown' ? cashBreakdown : undefined
    };

    // Simular delay de processamento
    await new Promise(resolve => setTimeout(resolve, 1000));

    onConfirm(openingData, inputMode); // Passando o inputMode
    
    // Resetar formulário
    setOperatorName('');
    setInitialAmount('');
    setNotes('');
    setCashBreakdown({ notes: {}, coins: {} });
    setIsLoading(false);
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const totalFromBreakdown = calculateTotalFromBreakdown();

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Abertura de Caixa"
      size="lg"
    >
      <div className="space-y-6">
        {/* Informações da abertura */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <i className="ri-information-line text-blue-600"></i>
            <span className="font-medium text-blue-800">Abertura de Caixa</span>
          </div>
          <p className="text-sm text-blue-700">
            Registre as informações iniciais para começar as operações do caixa.
          </p>
          <div className="mt-2 text-xs text-blue-600">
            <span>Data/Hora: {new Date().toLocaleString('pt-BR')}</span>
          </div>
        </div>

        {/* Nome do operador */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nome do Operador: *
          </label>
          <Input
            type="text"
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
            placeholder="Digite seu nome"
            className="w-full"
            disabled={isLoading}
            autoFocus
          />
        </div>

        {/* Modo de entrada do valor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Forma de Registro do Valor Inicial: *
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
              Valor Inicial em Caixa: *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                R$
              </span>
              <Input
                type="number"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
                placeholder="0,00"
                className="w-full pl-10"
                step="0.01"
                min="0"
                disabled={isLoading}
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Valor em dinheiro disponível no início do expediente
            </p>
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
                <span className="text-sm font-medium text-blue-800">Total calculado:</span>
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

        {/* Observações */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observações (opcional):
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações sobre a abertura do caixa..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            rows={3}
            maxLength={500}
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">
            {notes.length}/500 caracteres
          </p>
        </div>

        {/* Resumo */}
        {operatorName && ((inputMode === 'total' && initialAmount) || (inputMode === 'breakdown' && totalFromBreakdown > 0)) && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Resumo da Abertura</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Operador:</span>
                <span className="font-medium">{operatorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Valor inicial:</span>
                <span className="font-medium text-green-600">
                  R$ {(inputMode === 'total' ? Number(initialAmount || 0) : totalFromBreakdown).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Método:</span>
                <span className="font-medium">
                  {inputMode === 'total' ? 'Valor Total' : 'Contagem de Notas/Moedas'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Data/Hora:</span>
                <span className="font-medium">{new Date().toLocaleString('pt-BR')}</span>
              </div>
              {notes && (
                <div className="pt-2 border-t">
                  <span className="text-gray-600">Observações:</span>
                  <p className="text-gray-800 mt-1">{notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex space-x-3 pt-4 border-t">
          <Button
            variant="secondary"
            onClick={handleClose}
            className="flex-1"
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1"
            disabled={
              !operatorName.trim() || 
              (inputMode === 'total' && (!initialAmount.trim() || isNaN(Number(initialAmount)))) ||
              (inputMode === 'breakdown' && totalFromBreakdown === 0) ||
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
                Abrir Caixa
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}