// Exposição segura de API ao renderer (CommonJS preload)
const { contextBridge, ipcRenderer } = require('electron')

console.log('[preload] loaded')

contextBridge.exposeInMainWorld('api', {
  db: {
    query: (sql, params) => ipcRenderer.invoke('db:query', { sql, params }),
  },
  system: {
    getLocalIp: () => ipcRenderer.invoke('system:getLocalIp'),
    getDataPath: () => ipcRenderer.invoke('system:getDataPath'),
  },
  onEscape: (cb) => ipcRenderer.on('app:escape', () => cb && cb()),
  closeWindow: () => ipcRenderer.invoke('close-focused-window'),
  restart: (target) => ipcRenderer.invoke('app:restart', target)
})
