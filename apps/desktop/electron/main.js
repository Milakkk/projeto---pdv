import { app, BrowserWindow, ipcMain, globalShortcut, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// Registra o canal IPC de DB no processo MAIN
import './main/ipc-db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DEV_PORT = Number(process.env.VITE_DEV_SERVER_PORT ?? process.env.DEV_SERVER_PORT ?? 3003)
const DEV_URL = `http://localhost:${DEV_PORT}`
const IS_DEV = !app.isPackaged

async function loadRenderer(win, route) {
  const targetRoute = typeof route === 'string' ? route : '/'
  if (IS_DEV) {
    const { default: waitOn } = await import('wait-on')
    await waitOn({ resources: [DEV_URL], timeout: 30000 })
    // App usa HashRouter no Electron; usar hash para roteamento durante dev
    const url = `${DEV_URL}#${targetRoute}`
    await win.loadURL(url)
  } else {
    const indexFile = path.join(__dirname, '../out/index.html')
    // Em produção, carregar arquivo local com hash
    await win.loadFile(indexFile, { hash: targetRoute.replace(/^\//, '') })
  }
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.webContents.on('did-finish-load', () => {
    if (IS_DEV) win.webContents.openDevTools({ mode: 'detach' })
    console.log('[renderer] loaded:', win.webContents.getURL())
  })

  loadRenderer(win, '/dashboard').catch(() => {
    // fallback em caso de erro
    win.loadFile(path.join(__dirname, '../out/index.html'), { hash: 'dashboard' }).catch(() => {})
  })
}

// Helper: cria janela com partição persistente e rota inicial
function openWindowWithPartition(partitionId, initialRoute) {
  const partition = String(partitionId || '').trim() || 'persist:default'
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      partition,
    },
  })
  const targetPath = typeof initialRoute === 'string' ? initialRoute : '/'
  console.log(`[launcher] ${targetPath === '/cozinha' ? 'KDS' : targetPath === '/caixa' ? 'PDV' : 'APP'} -> partition=${partition}, url: ${DEV_URL}#${targetPath}`)
  win.webContents.on('did-finish-load', () => {
    if (IS_DEV) win.webContents.openDevTools({ mode: 'detach' })
    console.log('[renderer] loaded:', win.webContents.getURL())
  })
  loadRenderer(win, targetPath).catch(() => {
    win.loadFile(path.join(__dirname, '../out/index.html'), { hash: targetPath.replace(/^\//, '') }).catch(() => {})
  })
  return win
}

// Abre janela PDV com sessão persistente própria e rota /caixa
export function openPdvWindow() {
  return openWindowWithPartition('persist:pdv', '/caixa')
}

// Abre janela KDS com sessão persistente própria e rota /cozinha
export function openKdsWindow() {
  return openWindowWithPartition('persist:kds', '/cozinha')
}

// Abre uma nova janela por módulo, usando partições adequadas quando aplicável
function openModuleWindow (modulePath) {
  const targetPath = typeof modulePath === 'string' ? modulePath : '/'
  if (targetPath === '/caixa') return openPdvWindow()
  if (targetPath === '/cozinha') return openKdsWindow()
  return openWindowWithPartition('persist:default', targetPath)
}

// IPC para abrir janelas por módulo a partir do renderer
ipcMain.handle('open-module-window', (_event, modulePath) => {
  openModuleWindow(modulePath)
  return true
})

// IPC utilitários de sistema usados pelo preload
ipcMain.handle('system:getLocalIp', () => {
  try {
    const os = require('os')
    const nets = os.networkInterfaces()
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        const isV4 = net.family === 'IPv4' || net.family === 4
        if (isV4 && !net.internal) return net.address
      }
    }
    return null
  } catch {
    return null
  }
})

ipcMain.handle('system:getDataPath', () => {
  try {
    return app.getPath('userData')
  } catch {
    return null
  }
})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const wins = BrowserWindow.getAllWindows()
    const hasCaixa = wins.some(w => String(w.webContents.getURL() || '').includes('/caixa'))
    const hasCozinha = wins.some(w => String(w.webContents.getURL() || '').includes('/cozinha'))
    if (hasCaixa && !hasCozinha) {
      openKdsWindow()
    } else if (hasCozinha && !hasCaixa) {
      openPdvWindow()
    } else {
      createWindow()
    }
  })
}

ipcMain.handle('close-focused-window', () => {
  const w = BrowserWindow.getFocusedWindow()
  if (w) { w.close(); return true }
  return false
})

app.whenReady().then(async () => {
  if (String(process.env.RESET_DATA) === '1') {
    try {
      const fs = (eval('require'))('fs')
      const p = (eval('require'))('path')
      const files = ['data.db', 'data.db-shm', 'data.db-wal']
      for (const f of files) {
        try {
          const fp = p.join(process.cwd(), f)
          if (fs.existsSync(fp)) fs.unlinkSync(fp)
        } catch {}
      }
    } catch {}
    const storages = ['appcache','cookies','filesystem','indexdb','localstorage','serviceworkers','shadercache','websql']
    const parts = ['persist:pdv','persist:kds','persist:default']
    for (const part of parts) {
      try { await session.fromPartition(part).clearStorageData({ storages }) } catch {}
    }
    try { await session.defaultSession.clearStorageData({ storages }) } catch {}
  }
  globalShortcut.register('Escape', () => {
    const w = BrowserWindow.getFocusedWindow()
    if (w) w.webContents.send('app:escape')
  })
  globalShortcut.register('F5', () => {
    const w = BrowserWindow.getFocusedWindow()
    if (w) w.reload()
  })
  globalShortcut.register('CommandOrControl+R', () => {
    const w = BrowserWindow.getFocusedWindow()
    if (w) w.reload()
  })
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    const w = BrowserWindow.getFocusedWindow()
    if (w) w.webContents.reloadIgnoringCache()
  })
  const target = String(process.env.ELECTRON_WINDOW || process.env.LAUNCH_TARGET || '').trim().toLowerCase()
  if (target === 'pdv') {
    openPdvWindow()
  } else if (target === 'kds') {
    openKdsWindow()
  } else if (target === 'both') {
    openPdvWindow()
    openKdsWindow()
  } else {
    createWindow()
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
