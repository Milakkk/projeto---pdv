import getPort from 'get-port'
import waitOn from 'wait-on'
import killPort from 'kill-port'
import { spawn } from 'node:child_process'
import path from 'node:path'

const TARGET = (process.argv[2] || 'both').toLowerCase()
const PREFERRED = 3003

async function ensureKilledFixedPort() {
  if (String(process.env.FORCE_KILL_3003) === '1') {
    try {
      console.log('[dev-start] Pre-clean: killing TCP port 3003')
      await killPort(3003, 'tcp')
    } catch (err) {
      console.warn('[dev-start] kill-port 3003 failed or not needed:', err?.message || err)
    }
  }
}

async function main() {
  await ensureKilledFixedPort()
  const port = await getPort({ port: PREFERRED })
  console.log(`[dev-start] Using port: ${port} (preferred ${PREFERRED})`)

  const isWin = process.platform === 'win32'
  const binDir = path.join(process.cwd(), 'node_modules', '.bin')
  const viteBin = path.join(binDir, isWin ? 'vite.cmd' : 'vite')
  const electronBin = path.join(binDir, isWin ? 'electron.cmd' : 'electron')

  const vite = spawn(viteBin, ['--port', String(port), '--strictPort'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env },
    shell: true,
  })

  // wait for dev server
  const devUrl = `http://localhost:${port}`
  console.log('[dev-start] Waiting for:', devUrl)
  await waitOn({ resources: [devUrl], timeout: 30000, log: true })

  const electronEnv = { ...process.env, VITE_DEV_SERVER_PORT: String(port), ELECTRON_WINDOW: TARGET, NODE_ENV: 'development' }
  console.log(`[dev-start] Launching Electron -> window=${TARGET}, VITE_DEV_SERVER_PORT=${port}`)
  const electron = spawn(electronBin, ['./electron/main.js'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: electronEnv,
    shell: true,
  })

  const closeAll = () => {
    console.log('[dev-start] Shutting down...')
    try { electron.kill('SIGINT') } catch {}
    try { vite.kill('SIGINT') } catch {}
    process.exit(0)
  }

  process.on('SIGINT', closeAll)
  process.on('SIGTERM', closeAll)
  electron.on('exit', (code) => {
    console.log('[dev-start] Electron exited:', code)
    try { vite.kill('SIGINT') } catch {}
    process.exit(code ?? 0)
  })
  vite.on('exit', (code) => {
    console.log('[dev-start] Vite exited:', code)
  })
}

main().catch((err) => {
  console.error('[dev-start] Failed:', err)
  process.exit(1)
})
