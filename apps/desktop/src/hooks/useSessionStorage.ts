import { useState, useEffect } from 'react';

export function useSessionStorage<T>(key: string, initialValue: T) {
  // Função para ler o valor do sessionStorage
  const readValue = (): T => {
    try {
      // Verifica se window está disponível (para SSR, embora React seja CSR)
      if (typeof window === 'undefined') {
        return initialValue;
      }
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading sessionStorage key "${key}":`, error);
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Função para escrever o valor no sessionStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Verifica se window está disponível
      if (typeof window === 'undefined') {
        console.warn(`Tried to set sessionStorage key "${key}" during SSR.`);
        return;
      }
      
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
      
      // Nota: sessionStorage não dispara evento 'storage' entre abas, mas o listener é mantido
      // para consistência interna, embora não seja estritamente necessário para sessionStorage.
    } catch (error) {
      console.error(`Error setting sessionStorage key "${key}":`, error);
    }
  };

  // Não precisamos de um listener de 'storage' para sessionStorage, pois ele é isolado por aba.
  // O useEffect abaixo é mantido apenas para garantir que o estado inicial seja lido corretamente
  // e para evitar warnings de dependência, mas o listener de 'storage' é ineficaz aqui.
  useEffect(() => {
    // Apenas para garantir que o estado seja lido uma vez na montagem
    setStoredValue(readValue());
  }, [key]);

  return [storedValue, setValue] as const;
}