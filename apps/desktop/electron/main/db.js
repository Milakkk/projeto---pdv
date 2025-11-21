// Inicialização do SQLite no processo MAIN (ESM)
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

const userData = app.getPath('userData')
ensureDir(userData)

// Múltiplas sessões/partições: um banco por partição
const dbCache = new Map()

function sanitizePartition(partition) {
  const p = String(partition || '')
  return p.length ? p.replace(/[^a-zA-Z0-9_-]+/g, '_') : 'default'
}

function getDb(partition) {
  const key = sanitizePartition(partition)
  if (dbCache.has(key)) return dbCache.get(key)
  const dir = path.join(userData, 'sessions', key)
  ensureDir(dir)
  const dbPath = path.join(dir, 'data.db')
  const sqlite = new Database(dbPath)
  ensureSchema(sqlite)
  dbCache.set(key, sqlite)
  return sqlite
}

export function runForPartition(partition, sql, params = []) {
  const sqlite = getDb(partition)
  const stmt = sqlite.prepare(String(sql))
  return stmt.run(...(Array.isArray(params) ? params : [params]))
}

export function getForPartition(partition, sql, params = []) {
  const sqlite = getDb(partition)
  const stmt = sqlite.prepare(String(sql))
  return stmt.get(...(Array.isArray(params) ? params : [params]))
}

// Faltava suporte a SELECT retornando múltiplas linhas, utilizado pelo canal IPC
export function allForPartition(partition, sql, params = []) {
  const sqlite = getDb(partition)
  const stmt = sqlite.prepare(String(sql))
  return stmt.all(...(Array.isArray(params) ? params : [params]))
}

// Compat: usar partição default quando chamado sem partição
export function run(sql, params = []) { return runForPartition('default', sql, params) }
export function get(sql, params = []) { return getForPartition('default', sql, params) }
export function all(sql, params = []) { return allForPartition('default', sql, params) }

function ensureSchema(sqlite) {
  const exec = (sql) => {
    try { sqlite.exec(sql) } catch {}
  }
  exec(`CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`)
  exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_units_name ON units(name);`)

  exec(`CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`)
  exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_stations_unit_name ON stations(unit_id, name);`)

  exec(`CREATE TABLE IF NOT EXISTS device_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    role TEXT NOT NULL,
    station TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`)
  exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_device_profile_device ON device_profile(device_id);`)

  exec(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unit_id TEXT,
    default_station TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    pending_sync INTEGER NOT NULL DEFAULT 0
  );`)
  exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_name ON categories(name);`)
  exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_unit_name ON categories(unit_id, name);`)

  exec(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT,
    name TEXT NOT NULL,
    category_id TEXT,
    unit_id TEXT,
    price_cents INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    pending_sync INTEGER NOT NULL DEFAULT 0
  );`)
  exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_products_sku ON products(sku);`)
  exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_products_unit_name ON products(unit_id, name);`)

  exec(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    unit_id TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    total_cents INTEGER NOT NULL DEFAULT 0,
    opened_at TEXT,
    closed_at TEXT,
    device_id TEXT,
    notes TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    pending_sync INTEGER NOT NULL DEFAULT 0
  );`)

  exec(`CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT,
    qty INTEGER NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    pending_sync INTEGER NOT NULL DEFAULT 0
  );`)
  exec(`CREATE INDEX IF NOT EXISTS ix_order_items_order ON order_items(order_id);`)

  exec(`CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    method TEXT NOT NULL,
    amount_cents INTEGER NOT NULL DEFAULT 0,
    change_cents INTEGER NOT NULL DEFAULT 0,
    auth_code TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    pending_sync INTEGER NOT NULL DEFAULT 0
  );`)
  exec(`CREATE INDEX IF NOT EXISTS ix_payments_order ON payments(order_id);`)

  exec(`CREATE TABLE IF NOT EXISTS kds_tickets (
    id TEXT PRIMARY KEY,
    unit_id TEXT,
    order_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    station TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    pending_sync INTEGER NOT NULL DEFAULT 0
  );`)
  exec(`CREATE INDEX IF NOT EXISTS ix_kds_order ON kds_tickets(order_id);`)
  exec(`CREATE INDEX IF NOT EXISTS ix_kds_unit_status ON kds_tickets(unit_id, status);`)

  exec(`CREATE TABLE IF NOT EXISTS cash_sessions (
    id TEXT PRIMARY KEY,
    opened_at TEXT,
    closed_at TEXT,
    opened_by TEXT,
    closed_by TEXT,
    opening_amount_cents INTEGER NOT NULL DEFAULT 0,
    closing_amount_cents INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    pending_sync INTEGER NOT NULL DEFAULT 0
  );`)

  exec(`CREATE TABLE IF NOT EXISTS cash_movements (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    type TEXT NOT NULL,
    reason TEXT,
    amount_cents INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    pending_sync INTEGER NOT NULL DEFAULT 0
  );`)
  exec(`CREATE INDEX IF NOT EXISTS ix_cash_movements_session ON cash_movements(session_id);`)

  exec(`CREATE TABLE IF NOT EXISTS saved_carts (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    pending_sync INTEGER NOT NULL DEFAULT 0
  );`)

  exec(`CREATE TABLE IF NOT EXISTS kitchen_operators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    pending_sync INTEGER NOT NULL DEFAULT 0
  );`)

  exec(`CREATE TABLE IF NOT EXISTS global_observations (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    pending_sync INTEGER NOT NULL DEFAULT 0
  );`)
  exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_global_observations_key ON global_observations(key);`)

  exec(`CREATE TABLE IF NOT EXISTS counters (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`)

  exec(`CREATE TABLE IF NOT EXISTS sync_log (
    id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    last_pulled_at TEXT,
    last_pushed_at TEXT
  );`)
  exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_sync_table ON sync_log(table_name);`)

  exec(`CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`)

  exec(`CREATE TABLE IF NOT EXISTS checklist_masters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    store_id TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    frequency TEXT NOT NULL
  );`)
  exec(`CREATE INDEX IF NOT EXISTS ix_checklist_masters_store ON checklist_masters(store_id);`)
  exec(`ALTER TABLE checklist_masters ADD COLUMN assigned_role_ids TEXT`)

  exec(`CREATE TABLE IF NOT EXISTS checklist_items (
    id TEXT PRIMARY KEY,
    master_id TEXT NOT NULL,
    description TEXT NOT NULL,
    required_photo INTEGER NOT NULL DEFAULT 0
  );`)
  exec(`CREATE INDEX IF NOT EXISTS ix_checklist_items_master ON checklist_items(master_id);`)

  exec(`CREATE TABLE IF NOT EXISTS checklist_schedules (
    id TEXT PRIMARY KEY,
    master_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    role_ids TEXT NOT NULL,
    frequency TEXT NOT NULL,
    time_of_day TEXT NOT NULL,
    days_of_week TEXT,
    day_of_month INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_triggered_at TEXT
  );`)
  exec(`CREATE INDEX IF NOT EXISTS ix_checklist_schedules_master ON checklist_schedules(master_id);`)
  exec(`CREATE INDEX IF NOT EXISTS ix_checklist_schedules_store ON checklist_schedules(store_id);`)

  exec(`CREATE TABLE IF NOT EXISTS checklist_executions (
    id TEXT PRIMARY KEY,
    master_id TEXT NOT NULL,
    name TEXT NOT NULL,
    store_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    started_by_user_id TEXT,
    started_by_user_name TEXT,
    status TEXT NOT NULL,
    completed_at TEXT,
    completion_percentage INTEGER NOT NULL DEFAULT 0
  );`)
  exec(`CREATE INDEX IF NOT EXISTS ix_checklist_exec_master ON checklist_executions(master_id);`)
  exec(`CREATE INDEX IF NOT EXISTS ix_checklist_exec_store ON checklist_executions(store_id);`)

  exec(`CREATE TABLE IF NOT EXISTS checklist_execution_items (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    description TEXT NOT NULL,
    required_photo INTEGER NOT NULL DEFAULT 0,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    completed_by_user_id TEXT,
    completed_by_user_name TEXT,
    photo_url TEXT,
    notes TEXT
  );`)
  exec(`CREATE INDEX IF NOT EXISTS ix_checklist_exec_items_exec ON checklist_execution_items(execution_id);`)

  // Procedimentos (POP)
  exec(`CREATE TABLE IF NOT EXISTS procedures (
    id TEXT PRIMARY KEY,
    unit_id TEXT,
    title TEXT NOT NULL,
    category TEXT,
    content TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    pending_sync INTEGER NOT NULL DEFAULT 0
  );`)
  exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_procedures_unit_title ON procedures(unit_id, title);`)
  exec(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    unit_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    assigned_to TEXT,
    assigned_to_name TEXT,
    due_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    comments_json TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    pending_sync INTEGER NOT NULL DEFAULT 0
  );`)
  exec(`CREATE INDEX IF NOT EXISTS ix_tasks_unit_status ON tasks(unit_id, status);`)
  exec(`CREATE INDEX IF NOT EXISTS ix_tasks_due_at ON tasks(due_at);`)
  // Estoque: ingredientes, preços e relação produto-insumo
  exec(`CREATE TABLE IF NOT EXISTS ingredients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`)
  exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_ingredients_name ON ingredients(name);`)

  exec(`CREATE TABLE IF NOT EXISTS ingredient_prices (
    id TEXT PRIMARY KEY,
    ingredient_id TEXT NOT NULL,
    unit TEXT NOT NULL,
    price_per_unit_cents INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`)
  exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_ingredient_price ON ingredient_prices(ingredient_id, unit);`)

  exec(`CREATE TABLE IF NOT EXISTS ingredient_price_history (
    id TEXT PRIMARY KEY,
    ingredient_id TEXT NOT NULL,
    unit TEXT NOT NULL,
    old_price_cents INTEGER,
    new_price_cents INTEGER,
    changed_at TEXT NOT NULL
  );`)
  exec(`CREATE INDEX IF NOT EXISTS ix_ingredient_price_history_ing ON ingredient_price_history(ingredient_id);`)

  exec(`CREATE TABLE IF NOT EXISTS product_ingredients (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    ingredient_id TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`)
  exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_recipe_line ON product_ingredients(product_id, ingredient_id);`)

  exec(`CREATE TABLE IF NOT EXISTS recipe_history (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    ingredient_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_quantity REAL,
    old_unit TEXT,
    new_quantity REAL,
    new_unit TEXT,
    changed_at TEXT NOT NULL
  );`)
  exec(`CREATE INDEX IF NOT EXISTS ix_recipe_history_prod ON recipe_history(product_id);`)

  try { seedInventoryFromPrecosTxt(sqlite) } catch {}
}

function seedInventoryFromPrecosTxt(sqlite) {
  try {
    const countRow = sqlite.prepare('SELECT COUNT(1) AS c FROM ingredient_prices').get()
    const alreadySeeded = Number(countRow?.c || 0) > 0
    if (alreadySeeded) return

    const candidates = [
      path.join(process.cwd(), 'preços.txt'),
      path.join(process.cwd(), 'precos.txt'),
    ]
    let filePath = null
    for (const p of candidates) { if (fs.existsSync(p)) { filePath = p; break } }
    if (!filePath) return

    const raw = fs.readFileSync(filePath, 'utf8')
    const cleaned = raw
      .replace(/#.*$/gm, '')
      .trim()
    const wrapped = `[${cleaned}]`
      .replace(/\b(nome)\b/g, '"nome"')
      .replace(/\b(preco)\b/g, '"preco"')
      .replace(/\b(tipo_preco)\b/g, '"tipo_preco"')
      .replace(/'/g, '"')
      .replace(/,\s*]/, ']')
    let entries
    try { entries = JSON.parse(wrapped) } catch { entries = [] }
    if (!Array.isArray(entries) || entries.length === 0) return

    const now = new Date().toISOString()
    const insertIngredientIgnore = sqlite.prepare('INSERT OR IGNORE INTO ingredients (id, name, updated_at) VALUES (?, ?, ?)')
    const getIngredientByName = sqlite.prepare('SELECT id FROM ingredients WHERE name = ?')
    const insertPrice = sqlite.prepare('INSERT OR IGNORE INTO ingredient_prices (id, ingredient_id, unit, price_per_unit_cents, updated_at) VALUES (?, ?, ?, ?, ?)')

    for (const e of entries) {
      const name = String(e?.nome ?? '').trim()
      if (!name) continue
      const unitRaw = String(e?.tipo_preco ?? '').trim()
      const unit = unitRaw.toLowerCase() === 'un' ? 'un' : unitRaw.toLowerCase()
      const price = Number(e?.preco ?? 0)
      const cents = Math.max(0, Math.round(price * 100))
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      try { insertIngredientIgnore.run(id, name, now) } catch {}
      const row = getIngredientByName.get(name)
      const ingId = row?.id
      if (!ingId) continue
      const priceId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      try { insertPrice.run(priceId, String(ingId), unit, cents, now) } catch {}
    }
    try { console.log('[seed] ingredientes e preços importados de preços.txt') } catch {}
  } catch {}
}
