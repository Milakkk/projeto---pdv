import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Função para ler o valor do localStorage
  const readValue = (): T => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(readValue);

  useEffect(() => {
    try {
      const existing = window.localStorage.getItem(key);
      if (existing == null) {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
        const event = new StorageEvent('storage', {
          key: key,
          newValue: JSON.stringify(storedValue),
          oldValue: null,
          url: window.location.href,
          storageArea: window.localStorage,
        });
        window.dispatchEvent(event);
      }
    } catch {}
  }, [key]);

  // Função para escrever o valor no localStorage
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue(current => {
        const valueToStore = value instanceof Function ? (value as Function)(current) : value;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        
        // NOVO: Disparar evento de storage manualmente para sincronizar outras abas
        // Nota: O evento 'storage' nativo só dispara em outras janelas, não na atual.
        // Disparar um evento customizado ou o evento 'storage' com a chave correta
        // garante que o useEffect abaixo seja acionado em todas as instâncias.
        const event = new StorageEvent('storage', {
          key: key,
          newValue: JSON.stringify(valueToStore),
          oldValue: JSON.stringify(current),
          url: window.location.href,
          storageArea: window.localStorage,
        });
        window.dispatchEvent(event);
        
        return valueToStore;
      });
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  useEffect(() => {
    // Listener para sincronizar o estado quando o localStorage muda em outra aba/instância
    const handleStorageChange = (event: StorageEvent) => {
      // Verifica se a chave mudou
      if (event.key === key) {
        // Se o evento foi disparado pela própria aba, o readValue já está correto,
        // mas o setState garante que o componente re-renderize com o valor atualizado.
        setStoredValue(readValue());
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]); // Dependência apenas da chave

  return [storedValue, setValue] as const;
}