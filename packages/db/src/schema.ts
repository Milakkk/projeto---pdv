import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const nowIso = () => new Date().toISOString()

export const units = sqliteTable(
  'units',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({ nameIdx: uniqueIndex('ux_units_name').on(t.name) }),
)

export const stations = sqliteTable(
  'stations',
  {
    id: text('id').primaryKey(),
    unitId: text('unit_id').references(() => units.id).notNull(),
    name: text('name').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (t) => ({ unitNameIdx: uniqueIndex('ux_stations_unit_name').on(t.unitId, t.name) }),
)

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  unitId: text('unit_id').references(() => units.id),
  defaultStation: text('default_station'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  unitId: text('unit_id').references(() => units.id),
  priceCents: integer('price_cents').notNull(),
  active: integer('active', { mode: 'boolean' }).default(true).notNull(),
  slaMinutes: integer('sla_minutes').default(15).notNull(),
  skipKitchen: integer('skip_kitchen', { mode: 'boolean' }).default(false).notNull(),
  unitDeliveryCount: integer('unit_delivery_count').default(1).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  unitId: text('unit_id').references(() => units.id),
  code: text('code').notNull(),
  status: text('status').notNull(),
  totalCents: integer('total_cents').default(0).notNull(),
  notes: text('notes'),
  pendingSync: integer('pending_sync', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').references(() => orders.id).notNull(),
  productId: text('product_id').references(() => products.id).notNull(),
  qty: integer('qty').default(1).notNull(),
  note: text('note'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  orderId: text('order_id').references(() => orders.id).notNull(),
  method: text('method').notNull(),
  amountCents: integer('amount_cents').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const kdsTickets = sqliteTable('kds_tickets', {
  id: text('id').primaryKey(),
  unitId: text('unit_id').references(() => units.id),
  orderId: text('order_id').references(() => orders.id).notNull(),
  status: text('status').notNull(),
  station: text('station'),
  acknowledgedAt: text('acknowledged_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const kdsSyncLogs = sqliteTable('kds_sync_logs', {
  id: text('id').primaryKey(),
  ticketId: text('ticket_id').references(() => kdsTickets.id),
  orderId: text('order_id'),
  eventType: text('event_type').notNull(), // 'RECEIVED', 'SYNC_DELAY'
  latencyMs: integer('latency_ms'),
  payload: text('payload'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const cashSessions = sqliteTable('cash_sessions', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  openedAt: text('opened_at'),
  closedAt: text('closed_at'),
  operatorName: text('operator_name'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const cashMovements = sqliteTable('cash_movements', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => cashSessions.id).notNull(),
  type: text('type').notNull(),
  amountCents: integer('amount_cents').notNull(),
  note: text('note'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const savedCarts = sqliteTable('saved_carts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  itemsJson: text('items_json').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const kitchenOperators = sqliteTable('kitchen_operators', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role'),
  active: integer('active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const globalObservations = sqliteTable('global_observations', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const counters = sqliteTable('counters', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  value: integer('value').default(0).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const syncLog = sqliteTable('sync_log', {
  id: text('id').primaryKey(),
  table: text('table').notNull(),
  lastSyncedAt: text('last_synced_at').notNull(),
})

export type Category = typeof categories.$inferSelect
export type Product = typeof products.$inferSelect
export type Order = typeof orders.$inferSelect
export type OrderItem = typeof orderItems.$inferSelect
export type Payment = typeof payments.$inferSelect
export type KDSTicket = typeof kdsTickets.$inferSelect
export type KDSSyncLog = typeof kdsSyncLogs.$inferSelect
export type CashSession = typeof cashSessions.$inferSelect
export type CashMovement = typeof cashMovements.$inferSelect
export type SavedCart = typeof savedCarts.$inferSelect
export type KitchenOperator = typeof kitchenOperators.$inferSelect
export type GlobalObservation = typeof globalObservations.$inferSelect
export type Counter = typeof counters.$inferSelect
export type SyncLog = typeof syncLog.$inferSelect

export const ALL_TABLES = {
  units,
  stations,
  categories,
  products,
  orders,
  orderItems,
  payments,
  kdsTickets,
  kdsSyncLogs,
  cashSessions,
  cashMovements,
  savedCarts,
  kitchenOperators,
  globalObservations,
  counters,
  syncLog,
}
