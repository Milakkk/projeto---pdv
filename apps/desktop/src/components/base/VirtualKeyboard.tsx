import React, { memo } from 'react';

interface VirtualKeyboardProps {
    isVisible: boolean;
    onInput: (value: string) => void;
    onBackspace: () => void;
    onClear: () => void;
    onClose: () => void;
    layout?: 'numeric' | 'alphabetic';
}

const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
    isVisible,
    onInput,
    onBackspace,
    onClear,
    onClose,
    layout = 'alphabetic'
}) => {
    if (!isVisible) return null;

    const numericKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    const alphabeticKeys = [
        'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P',
        'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L',
        'Z', 'X', 'C', 'V', 'B', 'N', 'M', ' ', '.'
    ];

    const keys = layout === 'numeric' ? numericKeys : alphabeticKeys;

    return (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center pointer-events-none p-4">
            <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 w-full max-w-2xl rounded-2xl shadow-2xl p-4 pointer-events-auto transform animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                        Teclado Virtual {layout === 'numeric' ? '(Numérico)' : '(Alfabético)'}
                    </span>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    >
                        <i className="ri-close-line text-xl"></i>
                    </button>
                </div>

                <div className="grid grid-cols-10 gap-2">
                    {keys.map((key) => (
                        <button
                            key={key}
                            onClick={() => onInput(key)}
                            className={`
                flex items-center justify-center font-bold text-lg rounded-lg transition-all active:scale-95 shadow-lg
                ${key === ' ' ? 'col-span-5 bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700'}
              `}
                            style={{ minHeight: '50px' }}
                        >
                            {key === ' ' ? 'ESPAÇO' : key}
                        </button>
                    ))}

                    <button
                        onClick={onBackspace}
                        className="col-span-2 flex items-center justify-center bg-amber-500/20 text-amber-500 border border-amber-500/30 font-bold rounded-lg hover:bg-amber-500/30 transition-all active:scale-95 shadow-lg"
                    >
                        <i className="ri-backspace-line text-xl mr-1"></i>
                        APAGAR
                    </button>

                    <button
                        onClick={onClear}
                        className="col-span-2 flex items-center justify-center bg-red-500/20 text-red-500 border border-red-500/30 font-bold rounded-lg hover:bg-red-500/30 transition-all active:scale-95 shadow-lg"
                    >
                        LIMPAR
                    </button>
                </div>
            </div>
        </div>
    );
};

export default memo(VirtualKeyboard);
