-- Multiloja: criar tabelas e adicionar colunas sem quebrar dados existentes

-- Tabelas
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_units_name ON units(name);

CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_stations_unit_name ON stations(unit_id, name);

CREATE TABLE IF NOT EXISTS device_profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  role TEXT NOT NULL,
  station TEXT,
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_device_profile_device ON device_profile(device_id);

-- Colunas opcionais em tabelas existentes (idempotentes)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS unit_id TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS default_station TEXT;

ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_id TEXT;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS unit_id TEXT;

ALTER TABLE kds_tickets ADD COLUMN IF NOT EXISTS unit_id TEXT;

