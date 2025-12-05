// Sistema de sincronização em tempo real entre navegadores usando WebSocket + BroadcastChannel
// e localStorage como armazenamento único

import * as kitchenService from '@/offline/services/kitchenService'

type SyncEvent = {
  type: 'SET' | 'DELETE' | 'UPDATE';
  key: string;
  value?: any;
  timestamp: number;
  deviceId?: string;
};

// Verifica se o DB está disponível
const isDbAvailable = typeof window !== 'undefined' && (window as any).__db_available === true;

// Gera um ID único para este dispositivo/navegador
const getDeviceId = () => {
  if (typeof window === 'undefined') return 'server'
  let deviceId = localStorage.getItem('sync_device_id')
  if (!deviceId) {
    deviceId = `browser-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem('sync_device_id', deviceId)
  }
  return deviceId
}

class SyncStorage {
  private channel: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(value: any) => void>> = new Map();
  private isInitialized = false;
  private deviceId: string;
  private reconnectTimer: any = null;
  private hubUrl: string | null = null;
  private secret: string | null = null;

  constructor() {
    this.deviceId = getDeviceId();
    
    // Inicializa BroadcastChannel (para abas do mesmo navegador)
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('pdv-sync-storage');
      this.channel.onmessage = (event: MessageEvent<SyncEvent>) => {
        // Ignora eventos próprios
        if (event.data.deviceId === this.deviceId) return;
        this.handleSyncEvent(event.data);
      };
    }
    
    // Tenta conectar ao hub via WebSocket (para sincronização entre navegadores)
    this.connectToHub();
    
    // Polling periódico como fallback
    this.startPolling();
    
    this.isInitialized = true;
  }

  private connectToHub() {
    if (typeof window === 'undefined') return;
    
    try {
      // Tenta obter URL do hub das variáveis de ambiente ou usa padrão
      const envHubUrl = (import.meta as any)?.env?.VITE_LAN_HUB_URL;
      const envSecret = (import.meta as any)?.env?.VITE_LAN_SYNC_SECRET;
      
      this.hubUrl = envHubUrl || `http://${window.location.hostname}:4000`;
      this.secret = envSecret || '';
      
      if (!this.secret) {
        console.warn('[SyncStorage] VITE_LAN_SYNC_SECRET não configurado. Usando apenas BroadcastChannel.');
        return;
      }
      
      const wsUrl = this.hubUrl.replace(/^http/, 'ws') + `/realtime?token=${encodeURIComponent(this.secret)}`;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('[SyncStorage] Conectado ao hub via WebSocket');
        // Envia identificação
        this.ws?.send(JSON.stringify({ 
          unit_id: 'default', 
          device_id: this.deviceId,
          type: 'sync_storage'
        }));
      };
      
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'sync_event' && msg.event) {
            // Ignora eventos próprios
            if (msg.event.deviceId === this.deviceId) return;
            this.handleSyncEvent(msg.event);
          }
        } catch (err) {
          console.warn('[SyncStorage] Erro ao processar mensagem WebSocket:', err);
        }
      };
      
      this.ws.onerror = (err) => {
        console.warn('[SyncStorage] Erro WebSocket, usando apenas BroadcastChannel:', err);
      };
      
      this.ws.onclose = () => {
        // Reconecta após 3 segundos
        this.reconnectTimer = setTimeout(() => {
          if (this.ws?.readyState === WebSocket.CLOSED) {
            this.connectToHub();
          }
        }, 3000);
      };
    } catch (err) {
      console.warn('[SyncStorage] Não foi possível conectar ao hub:', err);
    }
  }

  private startPolling() {
    // Polling a cada 2 segundos para sincronizar entre navegadores diferentes
    // quando WebSocket não está disponível
    setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) return; // WebSocket ativo, não precisa de polling
      
      // Verifica se há mudanças no localStorage de outros dispositivos
      // (isso é uma limitação - sem backend, não podemos detectar mudanças de outros navegadores)
      // O polling aqui serve apenas como fallback
    }, 2000);
  }

  private handleSyncEvent(event: SyncEvent) {
    switch (event.type) {
      case 'SET':
      case 'UPDATE':
        if (event.value !== undefined) {
          localStorage.setItem(event.key, JSON.stringify(event.value));
          this.notifyListeners(event.key, event.value);
        }
        break;
      case 'DELETE':
        localStorage.removeItem(event.key);
        this.notifyListeners(event.key, null);
        break;
    }
  }

  private notifyListeners(key: string, value: any) {
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(listener => {
        try {
          listener(value);
        } catch (err) {
          console.error('Erro ao notificar listener:', err);
        }
      });
    }
  }

  private broadcast(event: SyncEvent) {
    const eventWithDevice = { ...event, deviceId: this.deviceId };
    
    // Broadcast via BroadcastChannel (abas do mesmo navegador)
    if (this.channel) {
      this.channel.postMessage(eventWithDevice);
    }
    
    // Broadcast via WebSocket (navegadores diferentes)
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'sync_event',
          event: eventWithDevice
        }));
      } catch (err) {
        console.warn('[SyncStorage] Erro ao enviar via WebSocket:', err);
      }
    }
  }

  async setItem(key: string, value: any) {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    
    // Salva no Supabase/DB quando disponível
    if (key === 'kitchens' && Array.isArray(value)) {
      try {
        for (const kitchen of value) {
          await kitchenService.upsertKitchen(kitchen);
        }
      } catch (err) {
        console.warn('Erro ao salvar cozinhas no DB/Supabase:', err);
      }
    }
    
    this.broadcast({
      type: 'SET',
      key,
      value,
      timestamp: Date.now(),
    });
    
    this.notifyListeners(key, value);
  }

  getItem<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item) as T;
    } catch {
      return defaultValue;
    }
  }

  removeItem(key: string) {
    localStorage.removeItem(key);
    
    this.broadcast({
      type: 'DELETE',
      key,
      timestamp: Date.now(),
    });
    
    this.notifyListeners(key, null);
  }

  subscribe(key: string, callback: (value: any) => void) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    // Retorna função de unsubscribe
    return () => {
      const keyListeners = this.listeners.get(key);
      if (keyListeners) {
        keyListeners.delete(callback);
        if (keyListeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  // Sincroniza arrays - adiciona item sem editar existentes
  async addToArray<T>(key: string, item: T, getId: (item: T) => string) {
    const current = this.getItem<T[]>(key, []);
    const itemId = getId(item);
    
    // Não permite editar - apenas adiciona se não existir
    if (current.some(existing => getId(existing) === itemId)) {
      return false; // Item já existe
    }
    
    const updated = [...current, item];
    await this.setItem(key, updated);
    return true;
  }

  // Remove item de array
  async removeFromArray<T>(key: string, itemId: string, getId: (item: T) => string) {
    const current = this.getItem<T[]>(key, []);
    const updated = current.filter(item => getId(item) !== itemId);
    
    // Remove do Supabase/DB se disponível
    if (key === 'kitchens') {
      try {
        await kitchenService.deleteKitchen(itemId);
      } catch (err) {
        console.warn('Erro ao remover cozinha do DB/Supabase:', err);
      }
    }
    
    await this.setItem(key, updated);
  }
}

// Instância singleton
export const syncStorage = new SyncStorage();

