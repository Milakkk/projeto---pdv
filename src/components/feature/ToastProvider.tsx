import { Toaster, toast } from 'react-hot-toast';

// Componente customizado para incluir o botão de fechar e aplicar estilos baseados no tipo
const CustomToast = ({ t, children }) => {
  let bgColor = 'bg-white';
  let borderColor = 'border-gray-200';
  let textColor = 'text-gray-900';
  let iconColor = 'text-gray-500';

  switch (t.type) {
    case 'success':
      bgColor = 'bg-green-50';
      borderColor = 'border-green-300';
      textColor = 'text-green-800';
      iconColor = 'text-green-600';
      break;
    case 'error':
      bgColor = 'bg-red-50';
      borderColor = 'border-red-300';
      textColor = 'text-red-800';
      iconColor = 'text-red-600';
      break;
    case 'loading':
      bgColor = 'bg-blue-50';
      borderColor = 'border-blue-300';
      textColor = 'text-blue-800';
      iconColor = 'text-blue-600';
      break;
    case 'blank': // Usado para showInfo e showReadyAlert
    default:
      bgColor = 'bg-blue-50'; // Cor neutra para info/alertas
      borderColor = 'border-blue-300';
      textColor = 'text-blue-800';
      iconColor = 'text-blue-600';
      break;
  }

  return (
    <div 
      className={`flex items-center justify-between p-3 ${bgColor} rounded-lg shadow-lg border-2 ${borderColor} max-w-md w-full cursor-pointer pointer-events-auto`}
      onClick={() => toast.dismiss(t.id)} // Adicionado onClick para fechar o toast
    >
      <div className={`flex-1 min-w-0 pr-4 ${textColor}`}>
        {children}
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }} // Adicionado e.stopPropagation() para evitar duplo clique
        className={`text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ${iconColor}`}
      >
        <i className="ri-close-line text-lg"></i>
      </button>
    </div>
  );
};

export default function ToastProvider() {
  return (
    <Toaster 
      position="top-right"
      toastOptions={{
        duration: 5000,
        custom: (t) => (
          <CustomToast t={t}>
            {t.icon && <span className="mr-2">{t.icon}</span>}
            {t.message}
          </CustomToast>
        ),
        style: {
          padding: '0',
          boxShadow: 'none',
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
        },
        loading: {
          iconTheme: {
            primary: '#3b82f6',
            secondary: '#fff',
          },
        },
      }}
    />
  );
}