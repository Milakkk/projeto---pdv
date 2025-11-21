import { ReactNode, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string | ReactNode;
  variant?: 'info' | 'error' | 'success';
}

export default function AlertModal({ isOpen, onClose, title, message, variant = 'info' }: AlertModalProps) {
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

  const iconClasses = {
    info: 'ri-information-line text-blue-500',
    error: 'ri-close-circle-line text-red-500',
    success: 'ri-check-line text-green-500',
  };

  const buttonVariant = variant === 'error' ? 'danger' : 'primary';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <div className="space-y-4 text-center">
        <i className={`${iconClasses[variant]} text-5xl mx-auto`}></i>
        
        <p className="text-gray-600 text-sm">{message}</p>

        <div className="pt-4 border-t">
          <Button
            onClick={onClose}
            className="w-full"
            variant={buttonVariant}
            autoFocus
          >
            <i className="ri-check-line mr-2"></i>
            OK (ENTER)
          </Button>
        </div>
      </div>
    </Modal>
  );
}