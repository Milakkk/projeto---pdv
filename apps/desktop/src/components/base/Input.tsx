import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  showKeyboard?: boolean;
  onKeyboardClick?: () => void;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', type, showKeyboard, onKeyboardClick, ...props }, ref) => {

    // Função para prevenir a alteração de valor ao rolar o mouse
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      if (type === 'number') {
        e.currentTarget.blur();
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <input
            ref={ref}
            type={type}
            onWheel={handleWheel} // Adiciona o manipulador de evento
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm ${error ? 'border-red-500' : ''
              } ${showKeyboard ? 'pr-10' : ''} ${className}`}
            {...props}
          />
          {showKeyboard && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onKeyboardClick?.();
              }}
              className="absolute right-2 text-gray-400 hover:text-amber-500 transition-colors p-1"
              title="Abrir teclado virtual"
            >
              <i className="ri-keyboard-line text-lg"></i>
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
