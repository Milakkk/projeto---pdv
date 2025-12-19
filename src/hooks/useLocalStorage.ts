import { useState, useEffect } from 'react';

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

  // Função para escrever o valor no localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        
        // Disparar evento de storage manualmente para sincronizar outras abas
        const event = new StorageEvent('storage', {
          key: key,
          newValue: JSON.stringify(valueToStore),
          oldValue: JSON.stringify(prev),
          url: window.location.href,
          storageArea: window.localStorage,
        });
        window.dispatchEvent(event);
        
        return valueToStore;
      });
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

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