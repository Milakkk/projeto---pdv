#!/usr/bin/env node
/*
 * Rebuild idempotente do better-sqlite3 para Electron (Windows)
 * - Detecta versão do Electron em apps/desktop
 * - Escolhe versão compatível de better-sqlite3 conforme mapa
 * - Aplica envs de build para electron-rebuild
 * - Limpa node_modules na raiz e reinstala
 * - Executa electron-rebuild com fallback automático para GetIsolate
 * Uso:
 *   pnpm rebuild:sqlite
 * Flags:
 *   --wasm  (opcional) tenta trocar para sql.js (WASM) e remover nativo)
 */

const { spawn } = require('node:child_process');
const { existsSync, mkdirSync, createWriteStream } = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const DESKTOP_DIR = path.join(ROOT, 'apps', 'desktop');

function log(msg) {
  console.log(msg);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function runCmd(cmd, opts = {}) {
  // PowerShell-safe wrapper for single-string commands (used for rmdir)
  return new Promise((resolve) => {
    const child = spawn(cmd, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function parseElectronMajor(ver) {
  const m = String(ver).trim().match(/^([0-9]+)/);
  return m ? Number(m[1]) : NaN;
}

function chooseBetterSqliteVersion(electronVer) {
  const major = parseElectronMajor(electronVer);
  if ([28, 29, 30].includes(major)) return '11.8.1';
  if ([31, 32, 33].includes(major)) return '12.4.1';
  // Default para majors fora do mapa: tentar 12.4.1 primeiro
  return '12.4.1';
}

function isGetIsolateError(output) {
  return /GetIsolate/gi.test(output) || /v8::Context/gi.test(output);
}

function hasToolchainIssue(output) {
  return (
    /python/i.test(output) && /not found|can't find|is not recognized/i.test(output)
  ) || /MSBuild\.exe failed/i.test(output) || /gyp ERR! find VS/i.test(output);
}

async function detectElectronVersion() {
  const { code, stdout, stderr } = await run('pnpm', [
    '--filter',
    'desktop',
    'exec',
    'node',
    '-p',
    "require('electron/package.json').version",
  ], { cwd: ROOT });
  if (code !== 0) {
    throw new Error(`Falha ao detectar versão do Electron: ${stderr || stdout}`);
  }
  return String(stdout).trim();
}

async function ensureBetterSqlite(version) {
  log(`➡️  Garantindo dependência better-sqlite3@${version} em apps/desktop`);
  const { code, stdout, stderr } = await run('pnpm', [
    '-C',
    DESKTOP_DIR,
    'add',
    `better-sqlite3@${version}`,
  ], { cwd: ROOT });
  if (code !== 0) {
    throw new Error(`Falha ao adicionar better-sqlite3@${version}: ${stderr || stdout}`);
  }
}

async function cleanNodeModules() {
  log('🧹 Removendo node_modules da raiz');
  const nm = path.join(ROOT, 'node_modules');
  if (!existsSync(nm)) {
    log('   node_modules não existe na raiz, seguindo.');
    return;
  }
  // Usar cmd para compatibilidade pedida
  const { code, stderr } = await runCmd('cmd /c "rmdir /s /q node_modules"', { cwd: ROOT });
  if (code !== 0) {
    throw new Error(`Falha ao remover node_modules: ${stderr}`);
  }
}

async function pnpmInstall() {
  log('📦 Instalando dependências com pnpm install');
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { code, stdout, stderr } = await run('pnpm', ['install'], { cwd: ROOT });
    if (code === 0) return;
    const out = `${stdout}\n${stderr}`;
    if (/EBUSY|resource busy or locked/i.test(out) && attempt < 3) {
      log(`⚠️  pnpm install encontrou EBUSY (tentativa ${attempt}/3). Aguardando e tentando novamente...`);
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    throw new Error(`pnpm install falhou: ${out}`);
  }
}

async function electronRebuild(electronVer, env) {
  log(`🔧 Executando electron-rebuild para Electron ${electronVer}`);
  const args = [
    '--filter', 'desktop',
    'exec',
    'npx', 'electron-rebuild',
    '-f',
    '-w', 'better-sqlite3',
    '-v', electronVer,
  ];
  const { code, stdout, stderr } = await run('pnpm', args, { cwd: ROOT, env });
  return { code, stdout, stderr };
}

function buildEnv(electronVer) {
  return {
    ...process.env,
    npm_config_target: electronVer,
    npm_config_runtime: 'electron',
    npm_config_disturl: 'https://www.electronjs.org/headers',
    npm_config_build_from_source: 'true',
    GYP_MSVS_VERSION: '2022',
  };
}

async function attemptRebuildFlow(electronVer, initialVersion) {
  // Passo 1: garantir dependência
  await ensureBetterSqlite(initialVersion);
  // Passo 2: limpar e instalar
  await cleanNodeModules();
  await pnpmInstall();
  // Passo 3: rebuild com envs
  const env = buildEnv(electronVer);
  let { code, stdout, stderr } = await electronRebuild(electronVer, env);
  const out = `${stdout}\n${stderr}`;

  if (code === 0) {
    return { success: true, usedVersion: initialVersion, logs: out };
  }

  // Detectar GetIsolate -> trocar versão e tentar novamente
  if (isGetIsolateError(out)) {
    log('⚠️  Erro GetIsolate detectado. Alternando versão do better-sqlite3 e tentando novamente.');
    const fallback = initialVersion === '12.4.1' ? '11.8.1' : '12.4.1';
    await ensureBetterSqlite(fallback);
    await cleanNodeModules();
    await pnpmInstall();
    const retry = await electronRebuild(electronVer, env);
    const retryOut = `${retry.stdout}\n${retry.stderr}`;
    if (retry.code === 0) {
      return { success: true, usedVersion: fallback, logs: retryOut };
    }
    return { success: false, usedVersion: fallback, logs: retryOut };
  }

  return { success: false, usedVersion: initialVersion, logs: out };
}

async function maybeWasmMode() {
  log('🔁 Modo WASM selecionado (--wasm). Removendo better-sqlite3 e adicionando sql.js');
  // Remover better-sqlite3 do desktop
  const rm = await run('pnpm', ['-C', DESKTOP_DIR, 'remove', 'better-sqlite3'], { cwd: ROOT });
  if (rm.code !== 0) {
    log(`Falha ao remover better-sqlite3: ${rm.stderr || rm.stdout}`);
  }
  const addSqlJs = await run('pnpm', ['-C', DESKTOP_DIR, 'add', 'sql.js@1.9.0'], { cwd: ROOT });
  if (addSqlJs.code !== 0) {
    throw new Error(`Falha ao adicionar sql.js: ${addSqlJs.stderr || addSqlJs.stdout}`);
  }

  log('ℹ️  Atenção: modo WASM requer adaptação do db para sql.js (assíncrono).');
  log('    Trade-offs: nenhum build nativo, performance menor mas aceitável para 1–3 PDVs.');
}

(async () => {
  log('📋 Pré-requisitos no Windows: Visual Studio Build Tools 2022 (Desktop C++), MSVC v143, Windows 10/11 SDK e Python 3 no PATH.');

  const useWasm = process.argv.includes('--wasm');
  if (useWasm) {
    try {
      await maybeWasmMode();
      log('✅ Modo WASM preparado. Rode: pnpm dev:desktop');
      process.exit(0);
    } catch (err) {
      console.error(err?.stack || String(err));
      process.exit(1);
    }
    return;
  }

  try {
    const electronVer = await detectElectronVersion();
    log(`🔎 Electron detectado: ${electronVer}`);
    let targetBetter = chooseBetterSqliteVersion(electronVer);
    log(`🎯 Versão alvo do better-sqlite3: ${targetBetter}`);

    const result = await attemptRebuildFlow(electronVer, targetBetter);
    const combined = result.logs || '';

    if (!result.success) {
      if (hasToolchainIssue(combined)) {
        log('❌ Falha por toolchain ausente. Verifique:');
        log('- Python 3 instalado e no PATH');
        log('- Visual Studio Build Tools 2022 (Desktop C++) com MSVC v143 e Windows 10/11 SDK');
      }
      log('❌ Rebuild falhou. Últimos logs:\n');
      console.log(combined);
      process.exit(1);
    }

    log(`✅ Rebuild do better-sqlite3 para Electron ${electronVer} finalizado. Versão usada: ${result.usedVersion}`);
    log('👉 Rode: pnpm dev:desktop');
    process.exit(0);
  } catch (err) {
    console.error('Erro no processo:', err?.stack || String(err));
    process.exit(1);
  }
})();
