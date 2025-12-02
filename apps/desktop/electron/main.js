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
    try {
      const { default: waitOn } = await import('wait-on')
      await waitOn({ resources: [DEV_URL], timeout: 30000 })
      const url = `${DEV_URL}#${targetRoute}`
      await win.loadURL(url)
    } catch {
      const html = encodeURIComponent(
        `<!doctype html><html><head><meta charset="utf-8"><title>Dev server</title></head><body style="font-family:system-ui;padding:24px"><h2>Servidor de desenvolvimento não iniciado</h2><p>Tente executar <code>pnpm --filter desktop dev:desktop:both</code> ou <code>pnpm -C apps/desktop dev:both</code>.</p><p>Porta esperada: ${DEV_PORT}</p></body></html>`
      )
      await win.loadURL(`data:text/html,${html}`)
    }
  } else {
    try {
      const indexFile = path.join(__dirname, '../out/index.html')
      await win.loadFile(indexFile, { hash: targetRoute.replace(/^\//, '') })
    } catch {
      const html = encodeURIComponent(
        `<!doctype html><html><head><meta charset="utf-8"><title>Build ausente</title></head><body style="font-family:system-ui;padding:24px"><h2>Build não encontrado</h2><p>Execute <code>pnpm -C apps/desktop build</code> e tente novamente.</p></body></html>`
      )
      await win.loadURL(`data:text/html,${html}`)
    }
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
    show: true, // Garantir que a janela seja mostrada
    webPreferences: {
      preload: path.join(__dirname, 'preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      partition,
    },
  })
  const targetPath = typeof initialRoute === 'string' ? initialRoute : '/'
  console.log(`[launcher] ${targetPath === '/cozinha' ? 'KDS' : targetPath === '/caixa' ? 'PDV' : 'APP'} -> partition=${partition}, url: ${DEV_URL}#${targetPath}`)
  
  // Garantir que a janela seja mostrada e focada
  win.show()
  win.focus()
  
  win.webContents.on('did-finish-load', () => {
    if (IS_DEV) win.webContents.openDevTools({ mode: 'detach' })
    console.log('[renderer] loaded:', win.webContents.getURL())
  })
  loadRenderer(win, targetPath).catch(() => {
    win.loadFile(path.join(__dirname, '../out/index.html'), { hash: targetPath.replace(/^\//, '') }).catch(() => {})
  })
  return win
}

// PARTIÇÃO ÚNICA para todas as janelas (sincroniza localStorage)
const SHARED_PARTITION = 'persist:app'

// Abre janela principal na tela de seleção de módulos
export function openMainWindow() {
  return openWindowWithPartition(SHARED_PARTITION, '/module-selector')
}

// Abre janela PDV com sessão persistente compartilhada e rota /caixa
export function openPdvWindow() {
  return openWindowWithPartition(SHARED_PARTITION, '/caixa')
}

// Abre janela KDS com sessão persistente compartilhada e rota /cozinha
export function openKdsWindow() {
  return openWindowWithPartition(SHARED_PARTITION, '/cozinha')
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
    const parts = ['persist:app','persist:pdv','persist:kds','persist:default']
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
  globalShortcut.register('CommandOrControl+Alt+R', () => {
    try { app.relaunch({ args: ['--target=both'] }) } catch {}
    try { app.exit(0) } catch {}
  })
  const argvTarget = (() => {
    try {
      const byEq = (process.argv || []).find(s => String(s).startsWith('--target='))
      if (byEq) return String(byEq).split('=')[1]
      const idx = (process.argv || []).indexOf('--target')
      if (idx >= 0 && process.argv[idx + 1]) return String(process.argv[idx + 1])
    } catch {}
    return ''
  })()
  const target = String(process.env.ELECTRON_WINDOW || process.env.LAUNCH_TARGET || argvTarget).trim().toLowerCase()
  console.log(`[main] Target recebido: "${target}"`)
  
  // Abrir janela baseado no target (todas usam a mesma partição compartilhada)
  if (target === 'pdv' || target === 'caixa') {
    openWindowWithPartition(SHARED_PARTITION, '/module-selector')
    console.log(`[main] Janela PDV aberta (seleção de módulos)`)
  } else if (target === 'kds' || target === 'cozinha') {
    openWindowWithPartition(SHARED_PARTITION, '/module-selector')
    console.log(`[main] Janela KDS aberta (seleção de módulos)`)
  } else if (target === 'both') {
    // Abre 2 janelas na tela de seleção de módulos (mesma partição = dados sincronizados)
    openWindowWithPartition(SHARED_PARTITION, '/module-selector')
    setTimeout(() => openWindowWithPartition(SHARED_PARTITION, '/module-selector'), 500)
    console.log(`[main] Abrindo 2 janelas (ambas em seleção de módulos, dados sincronizados)`)
  } else {
    // Por padrão, abre a tela de seleção de módulos (5 opções)
    openMainWindow()
    console.log(`[main] Janela principal com seleção de módulos aberta`)
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('app:restart', (_event, tgt) => {
  const next = String(typeof tgt === 'string' ? tgt : '').trim().toLowerCase()
  try { app.relaunch({ args: next ? [`--target=${next}`] : [] }) } catch {}
  try { app.exit(0) } catch {}
  return true
})
