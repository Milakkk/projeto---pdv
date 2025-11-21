const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    // Não falha o postinstall
  }
}

function log(...args) {
  console.log('[electron-install-fix]', ...args);
}

// Respeita a variável de ambiente para pular download
if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD === '1') {
  log('SKIP por env var.');
  process.exit(0);
}

// Tenta caminhos mais comuns no pnpm
const candidates = [
  'node_modules/.pnpm/electron@*/node_modules/electron/install.js',
  'node_modules/electron/install.js'
];

let glob;
try {
  glob = require('glob');
} catch (e) {
  log('Pacote "glob" não encontrado. Tente instalar com: pnpm add -D glob');
}

const matches = glob ? candidates.flatMap((p) => glob.sync(p, { nodir: true })) : [];

if (!matches.length) {
  log('install.js do Electron não encontrado (ok em CI que baixa depois).');
  process.exit(0);
}

const installer = matches[0];
log('Executando:', installer);
run(`node "${installer}"`);
log('Finalizado.');

