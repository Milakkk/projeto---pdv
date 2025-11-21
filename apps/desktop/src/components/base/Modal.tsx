import { ReactNode, useEffect, useRef, useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  // Adicionando prop para desabilitar fechamento por ESC/overlay se necessário
  disableClose?: boolean; 
  zIndex?: string; // NOVO: Propriedade para controlar o z-index (ex: 'z-50', 'z-[51]')
  // NOVO: Permite ocultar o botão de fechar "x" no cabeçalho
  hideCloseButton?: boolean;
  // NOVO: Permite customizar o estilo do overlay para não alterar opacidade do fundo
  overlayClassName?: string;
  // NOVO: Permite arrastar a modal pelo cabeçalho
  draggable?: boolean;
}

export default function Modal({ isOpen, onClose, title, children, size = 'md', disableClose = false, zIndex = 'z-[100]', hideCloseButton = false, overlayClassName = 'bg-gray-900 bg-opacity-75', draggable = true }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && !disableClose) {
          onClose();
        }
        // Nota: A confirmação por ENTER é melhor tratada dentro do componente filho (ex: Cart.tsx)
        // para garantir que o foco esteja no botão correto e evitar conflitos.
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, disableClose]);

  // Habilitar arraste pelo cabeçalho
  useEffect(() => {
    if (!isOpen || !draggable) return;

    const handleMouseDown = (e: MouseEvent) => {
      setDragging(true);
      startPosRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
      document.body.style.userSelect = 'none';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const next = { x: e.clientX - startPosRef.current.x, y: e.clientY - startPosRef.current.y };
      setOffset(next);
    };

    const handleMouseUp = () => {
      if (!dragging) return;
      setDragging(false);
      document.body.style.userSelect = '';
    };

    const headerEl = handleRef.current;
    if (headerEl) headerEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (headerEl) headerEl.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen, draggable, dragging, offset.x, offset.y]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
    '3xl': 'max-w-7xl',
    '4xl': 'max-w-[1500px]',
    full: 'max-w-[100vw]'
  };

  return (
    <div className={`fixed inset-0 ${zIndex} overflow-y-auto`}>
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className={`fixed inset-0 transition-opacity ${overlayClassName}`}
          onClick={disableClose ? undefined : onClose}
        />
        
        <div
          ref={dialogRef}
          className={`inline-block w-full ${sizeClasses[size]} p-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl`}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        >
          {title && (
            <div
              ref={handleRef}
              className="flex items-center justify-between mb-4 cursor-move"
              title={draggable ? 'Arraste para mover' : undefined}
            >
              <h3 className="text-lg font-medium text-gray-900">{title}</h3>
              {!hideCloseButton && (
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              )}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
