import toast from 'react-hot-toast';

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showInfo = (message: string) => {
  toast(message, {
    icon: '💡',
  });
};

export const showReadyAlert = (message: string) => {
  toast(message, {
    icon: '🔔',
    duration: 10000, // 10 segundos
  });
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId?: string) => {
  toast.dismiss(toastId);
};