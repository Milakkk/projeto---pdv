import { ReactNode, useEffect } from 'react';
import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';
import { CashMovement } from './CashMovement';

interface MovementConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  movementData: CashMovement | null;
}

export default function MovementConfirmationModal({ isOpen, onClose, movementData }: MovementConfirmationModalProps) {
  if (!movementData) return null;

  const { type, amount, description, timestamp } = movementData;
  
  const isEntry = type === 'IN';
  const title = isEntry ? 'Entrada de Dinheiro Registrada' : 'Retirada de Dinheiro Registrada';
  const icon = isEntry ? 'ri-add-circle-line text-green-600' : 'ri-subtract-circle-line text-red-600';
  const colorClass = isEntry ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300';
  const amountColor = isEntry ? 'text-green-700' : 'text-red-700';

  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === 'Escape') {
          onClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <div className="space-y-6 text-center">
        <div className="flex flex-col items-center justify-center">
          <i className={`${icon} text-6xl mb-3`}></i>
          <h3 className="text-xl font-bold text-gray-900">Movimento Confirmado!</h3>
        </div>

        {/* Detalhes do Movimento */}
        <div className={`rounded-xl p-4 shadow-inner border ${colorClass} text-left`}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Tipo:</span>
            <span className={`font-bold ${amountColor}`}>{isEntry ? 'ENTRADA' : 'SAÍDA'}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Valor:</span>
            <span className={`text-2xl font-extrabold ${amountColor}`}>
              {isEntry ? '+' : '-'} R$ {amount.toFixed(2)}
            </span>
          </div>
          <div className="border-t border-gray-200 pt-2">
            <span className="text-sm font-medium text-gray-700 block mb-1">Descrição:</span>
            <p className="text-sm text-gray-800">{description}</p>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          Registrado em: {new Date(timestamp).toLocaleString('pt-BR')}
        </div>

        <div className="pt-4 border-t">
          <Button onClick={onClose} className="w-full" autoFocus>
            <i className="ri-check-line mr-2"></i>
            OK (ENTER)
          </Button>
        </div>
      </div>
    </Modal>
  );
}