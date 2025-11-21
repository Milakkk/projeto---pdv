import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Tenta carregar uma URL com tentativas e atraso entre elas
async function loadWithRetry(win, url, { attempts = 60, delayMs = 500 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      await win.loadURL(url)
      return true
    } catch (err) {
      // Em dev, o servidor Vite pode demorar a subir; mantenha tentativas
      console.warn(`[Electron] Falhou ao carregar ${url} (tentativa ${i + 1}/${attempts}).`, err?.code || err?.message || err)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  console.error(`[Electron] Não foi possível carregar ${url} após ${attempts} tentativas.`)
  return false
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  // Abre DevTools para facilitar inspeção de erros da janela
  win.webContents.openDevTools({ mode: 'detach' })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    // Em dev, garanta que iniciamos no hash router, com tentativas até o Vite ficar disponível
    loadWithRetry(win, devUrl + '#/login').then((ok) => {
      if (!ok) {
        // Fallback para build local quando dev server falhar
        win.loadFile(path.join(__dirname, '../out/index.html'), { hash: '/login' })
      }
    })
  } else {
    // Em build, carregue com hash inicial para HashRouter
    win.loadFile(path.join(__dirname, '../out/index.html'), { hash: '/login' })
  }
}

// Abre uma nova janela apontando para uma rota específica (ex.: '/caixa' ou '/cozinha')
function openModuleWindow (modulePath) {
  const targetPath = typeof modulePath === 'string' ? modulePath : '/'
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  // DevTools destacada para facilitar debug
  win.webContents.openDevTools({ mode: 'detach' })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    // Em dev, usar URL do servidor com HashRouter, com tentativas até Vite ficar disponível
    loadWithRetry(win, devUrl + '#' + targetPath).then((ok) => {
      if (!ok) {
        // Fallback para build local quando dev server falhar
        win.loadFile(path.join(__dirname, '../out/index.html'), { hash: targetPath })
      }
    })
  } else {
    // Em build, carregar arquivo com hash
    win.loadFile(path.join(__dirname, '../out/index.html'), { hash: targetPath })
  }
  return win
}

// IPC para abrir janelas por módulo a partir do renderer
ipcMain.handle('open-module-window', (event, modulePath) => {
  openModuleWindow(modulePath)
  return true
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
