import { ReactNode, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

export default function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText, // Removendo valor padrão aqui
  cancelText = 'Cancelar',
  variant = 'danger'
}: ConfirmationModalProps) {
  
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
          onConfirm();
        } else if (event.key === 'Escape') {
          onClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onConfirm, onClose]);

  const iconClasses = {
    danger: 'ri-alert-line text-red-500',
    warning: 'ri-error-warning-line text-amber-500',
    info: 'ri-information-line text-blue-500',
    success: 'ri-check-line text-green-500', // Adicionado ícone de sucesso
  };

  const confirmVariant = variant === 'danger' ? 'danger' : (variant === 'success' ? 'success' : 'primary');
  
  // Definindo o texto padrão do botão de confirmação
  const finalConfirmText = confirmText || (variant === 'success' ? 'Sim' : 'Confirmar');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      zIndex="z-[1000]" // Mantém sempre no topo acima de outras janelas
    >
      <div className="space-y-6 text-center">
        <i className={`${iconClasses[variant]} text-5xl mx-auto`}></i>
        
        <p className="text-gray-600 text-sm">{message}</p>

        <div className="flex space-x-3 pt-4 border-t">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1"
            variant={confirmVariant}
            autoFocus
          >
            <i className="ri-check-line mr-2"></i>
            {finalConfirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
