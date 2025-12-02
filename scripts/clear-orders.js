// Script para limpar todos os pedidos do banco de dados
// Mantém apenas dados de configuração (categorias, produtos, cozinhas, etc.)

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminhos possíveis do banco de dados
const possibleDbPaths = [
  path.join(process.cwd(), 'data.db'), // Diretório atual
  path.join(process.cwd(), 'apps', 'desktop', 'data.db'), // Diretório desktop
  path.join(process.env.APPDATA || process.env.HOME || '', 'PDV KDS Desktop', 'shared', 'data.db'), // Windows userData
  path.join(process.env.HOME || '', 'Library', 'Application Support', 'PDV KDS Desktop', 'shared', 'data.db'), // macOS
  path.join(process.env.HOME || '', '.config', 'PDV KDS Desktop', 'shared', 'data.db'), // Linux
];

let dbPath = null;
for (const dbPathCandidate of possibleDbPaths) {
  if (fs.existsSync(dbPathCandidate)) {
    dbPath = dbPathCandidate;
    break;
  }
}

if (!dbPath) {
  console.error('❌ Banco de dados não encontrado. Procurando em:', possibleDbPaths);
  process.exit(1);
}

console.log(`📁 Banco de dados encontrado em: ${dbPath}`);

const db = new Database(dbPath);

// Tabelas relacionadas a pedidos que devem ser limpas
const tablesToClear = [
  'orders',
  'order_items',
  'payments',
  'kds_tickets',
  'kds_phase_times',
  'kds_unit_states',
  'orders_details',
  'orders_complete',
  'cash_sessions',
  'cash_movements',
  'saved_carts',
];

// Tabelas de configuração que devem ser mantidas
const tablesToKeep = [
  'categories',
  'products',
  'kitchens',
  'kitchen_operators',
  'category_kitchens',
  'payment_methods',
  'operational_sessions',
  'global_observations',
  'app_config',
  'units',
  'stations',
  'device_profile',
  'stores',
  'roles',
  'users',
  'tasks',
  'task_statuses',
  'checklists_master',
  'checklist_executions',
  'counters',
  'sync_log',
  'sync_meta',
];

try {
  console.log('\n🧹 Iniciando limpeza de pedidos...\n');

  // Desabilitar foreign keys temporariamente para limpeza
  db.pragma('foreign_keys = OFF');

  let totalDeleted = 0;

  for (const table of tablesToClear) {
    try {
      // Verificar se a tabela existe
      const tableExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(table);

      if (tableExists) {
        const countBefore = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
        db.prepare(`DELETE FROM ${table}`).run();
        const countAfter = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
        const deleted = countBefore - countAfter;
        totalDeleted += deleted;
        console.log(`✅ ${table}: ${deleted} registros removidos`);
      } else {
        console.log(`⚠️  ${table}: tabela não existe (pulando)`);
      }
    } catch (error) {
      console.error(`❌ Erro ao limpar ${table}:`, error.message);
    }
  }

  // Reabilitar foreign keys
  db.pragma('foreign_keys = ON');

  // Vacuum para recuperar espaço
  console.log('\n💾 Executando VACUUM para otimizar o banco...');
  db.exec('VACUUM');

  console.log(`\n✨ Limpeza concluída! Total de registros removidos: ${totalDeleted}`);
  console.log('\n📊 Tabelas de configuração mantidas:');
  for (const table of tablesToKeep) {
    try {
      const tableExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(table);
      if (tableExists) {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
        console.log(`   - ${table}: ${count} registros`);
      }
    } catch (error) {
      // Ignorar erros
    }
  }

  db.close();
  console.log('\n✅ Banco de dados limpo com sucesso!');
} catch (error) {
  console.error('❌ Erro durante a limpeza:', error);
  db.close();
  process.exit(1);
}

