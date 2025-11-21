
import { useState, useEffect } from 'react';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<any[]>([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Processar ações pendentes quando voltar online
      if (pendingActions.length > 0) {
        console.log('Processando ações offline pendentes:', pendingActions);
        // Aqui você pode implementar a lógica para sincronizar dados pendentes
        setPendingActions([]);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingActions]);

  const addPendingAction = (action: any) => {
    if (!isOnline) {
      setPendingActions(prev => [...prev, { ...action, timestamp: Date.now() }]);
      return true; // Indica que a ação foi adicionada à fila
    }
    return false; // Indica que está online, pode processar normalmente
  };

  return {
    isOnline,
    pendingActions,
    addPendingAction
  };
}
