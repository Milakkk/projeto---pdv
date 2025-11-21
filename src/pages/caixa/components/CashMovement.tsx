import { useState, useRef } from 'react';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';
import Modal from '../../../components/base/Modal';
import { CashOpeningData } from './CashOpening'; // Importando o tipo de sessão

interface CashSession {
  id: string;
  operatorName: string;
  initialAmount: number;
  openingTime: Date;
}

interface CashMovementProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'IN' | 'OUT';
  onConfirmMovement: (movement: CashMovement) => void; // Novo prop
  cashSession: CashSession | null; // NOVO PROP: Recebe a sessão ativa
  cashMovements: CashMovement[]; // NOVO PROP: Movimentos para calcular saldo disponível
}

export interface CashMovement {
  id: string;
  type: 'IN' | 'OUT' | 'SALE';
  amount: number;
  description: string;
  timestamp: Date;
  sessionId: string;
  orderId?: string;
}

export default function CashMovement({ isOpen, onClose, type, onConfirmMovement, cashSession, cashMovements }: CashMovementProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const descriptionRef = useRef<HTMLTextAreaElement>(null); // Ref para o campo de descrição

  // Calcula o saldo disponível atual em caixa para a sessão ativa
  const availableAmount = (() => {
    if (!cashSession) return 0;
    const sessionMovements = (cashMovements || []).filter(m => m.sessionId === cashSession.id);
    let expected = cashSession.initialAmount || 0;
    sessionMovements.forEach(m => {
      if (m.type === 'SALE' || m.type === 'IN') expected += m.amount;
      if (m.type === 'OUT') expected -= m.amount;
    });
    return expected;
  })();

  const handleConfirm = async () => {
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert('Digite um valor válido');
      return;
    }

    if (!description.trim()) {
      alert('Digite uma descrição para o movimento');
      return;
    }
    // Exigir descrição mínima de 10 caracteres para Retirada
    if (type === 'OUT' && description.trim().length < 10) {
      alert('A descrição da retirada deve ter pelo menos 10 caracteres.');
      return;
    }

    if (!cashSession) {
      // Este caso não deve ocorrer se o componente pai estiver validando, mas é uma segurança.
      alert('Nenhuma sessão de caixa ativa');
      return;
    }

    // Bloquear retiradas acima do saldo disponível
    if (type === 'OUT' && Number(amount) > availableAmount) {
      alert('Valor de retirada excede o saldo disponível em caixa.');
      return;
    }

    setIsLoading(true);

    const movement: CashMovement = {
      id: Date.now().toString(),
      type,
      amount: Number(amount),
      description: description.trim(),
      timestamp: new Date(),
      sessionId: cashSession.id
    };

    // Simular delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Chamar a função de confirmação no componente pai
    onConfirmMovement(movement);

    setAmount('');
    setDescription('');
    setIsLoading(false);
    onClose();
  };

  const handleClose = () => {
    if (!isLoading) {
      setAmount('');
      setDescription('');
      onClose();
    }
  };
  
  const handleAmountKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move o foco para a descrição
      descriptionRef.current?.focus();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={type === 'IN' ? 'Entrada de Dinheiro' : 'Retirada de Dinheiro'}
      size="md"
    >
      <div className="space-y-6">
        {/* Informações do movimento */}
        <div className={`${type === 'IN' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-lg p-4`}>
          <div className="flex items-center space-x-2 mb-2">
            <i className={`${type === 'IN' ? 'ri-add-circle-line text-green-600' : 'ri-subtract-circle-line text-red-600'}`}></i>
            <span className={`font-medium ${type === 'IN' ? 'text-green-800' : 'text-red-800'}`}>
              {type === 'IN' ? 'Registrar Entrada' : 'Registrar Retirada'}
            </span>
          </div>
          <p className={`text-sm ${type === 'IN' ? 'text-green-700' : 'text-red-700'}`}>
            {type === 'IN' 
              ? 'Registre entradas de dinheiro no caixa (ex: troco, suprimento)'
              : 'Registre retiradas de dinheiro do caixa (ex: sangria, despesas)'
            }
          </p>
          <div className="mt-2 text-xs text-gray-600">
            <span>Data/Hora: {new Date().toLocaleString('pt-BR')}</span>
          </div>
        </div>

        {/* Valor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Valor: *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              R$
            </span>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyPress={handleAmountKeyPress} // Adicionando manipulador de ENTER
              placeholder="0,00"
              className="w-full pl-10"
              step="0.01"
              min="0.01"
              max={type === 'OUT' ? String(Math.max(0, availableAmount)) : undefined}
              disabled={isLoading}
              autoFocus
            />
            {type === 'OUT' && Number(amount || 0) > availableAmount && (
              <p className="mt-2 text-xs text-red-600">Valor excede o saldo disponível em caixa (R$ {availableAmount.toFixed(2)}).</p>
            )}
            {type === 'OUT' && (
              <p className="mt-1 text-xs text-gray-600">Saldo disponível: R$ {availableAmount.toFixed(2)}</p>
            )}
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descrição: *
          </label>
          <textarea
            ref={descriptionRef} // Adicionando ref
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={type === 'IN' ? 'Ex: Suprimento de troco, Devolução...' : 'Ex: Sangria, Despesa com fornecedor...'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            rows={3}
            maxLength={200}
            minLength={type === 'OUT' ? 10 : undefined}
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">
            {description.length}/200 caracteres
            {type === 'OUT' && description.trim().length < 10 && (
              <span className="ml-2 text-red-600">(mínimo 10 caracteres)</span>
            )}
          </p>
        </div>

        {/* Resumo */}
        {amount && description && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Resumo do Movimento</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Tipo:</span>
                <span className={`font-medium ${type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                  {type === 'IN' ? 'Entrada' : 'Retirada'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Valor:</span>
                <span className={`font-medium ${type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                  {type === 'IN' ? '+' : '-'} R$ {Number(amount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Descrição:</span>
                <span className="font-medium text-right max-w-48 truncate">{description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Data/Hora:</span>
                <span className="font-medium">{new Date().toLocaleString('pt-BR')}</span>
              </div>
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
              !amount.trim() || 
              isNaN(Number(amount)) || 
              Number(amount) <= 0 || 
              !description.trim() ||
              (type === 'OUT' && description.trim().length < 10) ||
              (type === 'OUT' && Number(amount || 0) > availableAmount) ||
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
                <i className={`${type === 'IN' ? 'ri-add-circle-line' : 'ri-subtract-circle-line'} mr-2`}></i>
                Confirmar {type === 'IN' ? 'Entrada' : 'Retirada'}
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
