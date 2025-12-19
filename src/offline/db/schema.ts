import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const nowIso = () => new Date().toISOString();

// Multiloja
export const units = sqliteTable(
  "units",
  {
    id: text("id").primaryKey(), // UUID
    name: text("name").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({ nameIdx: uniqueIndex("ux_units_name").on(t.name) }),
);

export const stations = sqliteTable(
  "stations",
  {
    id: text("id").primaryKey(), // UUID
    unitId: text("unit_id").notNull().references(() => units.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    name: text("name").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    unitNameIdx: uniqueIndex("ux_stations_unit_name").on(t.unitId, t.name),
  }),
);

export const deviceProfile = sqliteTable(
  "device_profile",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    unitId: text("unit_id").notNull().references(() => units.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    deviceId: text("device_id").notNull(),
    role: text("role", { enum: ["pos", "kds", "admin"] }).notNull(),
    station: text("station"),
    acknowledgedAt: text("acknowledged_at"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    uxDevice: uniqueIndex("ux_device_profile_device").on(t.deviceId),
  }),
);

// Catálogo
export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(), // UUID
    name: text("name").notNull(),
    unitId: text("unit_id").references(() => units.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    defaultStation: text("default_station"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    nameIdx: uniqueIndex("ux_categories_name").on(t.name),
    unitNameIdx: uniqueIndex("ux_categories_unit_name").on(t.unitId, t.name),
  }),
);

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(), // UUID
    sku: text("sku"),
    name: text("name").notNull(),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    unitId: text("unit_id").references(() => units.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    priceCents: integer("price_cents").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" })
      .notNull()
      .default(true),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    skuIdx: uniqueIndex("ux_products_sku").on(t.sku),
    nameIdx: uniqueIndex("ux_products_name").on(t.name),
    unitNameIdx: uniqueIndex("ux_products_unit_name").on(t.unitId, t.name),
  }),
);

// Operação
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").references(() => units.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  operationalSessionId: text("operational_session_id"),
  status: text("status", { enum: ["open", "closed", "cancelled"] })
    .notNull()
    .default("open"),
  totalCents: integer("total_cents").notNull().default(0),
  openedAt: text("opened_at"),
  closedAt: text("closed_at"),
  deviceId: text("device_id"),
  notes: text("notes"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
  pendingSync: integer("pending_sync", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const orderItems = sqliteTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    qty: integer("qty").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
    notes: text("notes"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    orderIdx: uniqueIndex("ix_order_items_order").on(t.orderId),
  }),
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    method: text("method", {
      enum: ["cash", "pix", "debit", "credit", "voucher"],
    }).notNull(),
    amountCents: integer("amount_cents").notNull().default(0),
    changeCents: integer("change_cents").notNull().default(0),
    authCode: text("auth_code"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    orderIdx: uniqueIndex("ix_payments_order").on(t.orderId),
  }),
);

export const kdsTickets = sqliteTable(
  "kds_tickets",
  {
    id: text("id").primaryKey(),
    unitId: text("unit_id").references(() => units.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["queued", "prep", "ready", "done"],
    })
      .notNull()
      .default("queued"),
    station: text("station"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    orderIdx: uniqueIndex("ix_kds_order").on(t.orderId),
    unitStatusIdx: uniqueIndex("ix_kds_unit_status").on(t.unitId, t.status),
  }),
);

// Tempos das fases dos pedidos (não altera a tabela orders)
export const kdsPhaseTimes = sqliteTable("kds_phase_times", {
  orderId: text("order_id")
    .primaryKey()
    .references(() => orders.id, { onDelete: "cascade" }),
  newStart: text("new_start"),
  preparingStart: text("preparing_start"),
  readyAt: text("ready_at"),
  deliveredAt: text("delivered_at"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Estados das unidades de produção
export const kdsUnitStates = sqliteTable(
  "kds_unit_states",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderItemId: text("order_item_id").notNull(),
    productionUnitId: text("production_unit_id").notNull(),
    operatorName: text("operator_name"),
    unitStatus: text("unit_status"),
    completedObservationsJson: text("completed_observations_json"),
    completedAt: text("completed_at"),
    deliveredAt: text("delivered_at"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    uniqueKey: uniqueIndex("ux_kds_unit_key").on(t.orderId, t.orderItemId, t.productionUnitId),
  }),
);

export const kdsSyncLogs = sqliteTable("kds_sync_logs", {
  id: text("id").primaryKey(),
  ticketId: text("ticket_id").references(() => kdsTickets.id),
  orderId: text("order_id"),
  eventType: text("event_type").notNull(), // 'RECEIVED', 'SYNC_DELAY'
  latencyMs: integer("latency_ms"),
  payload: text("payload"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Detalhes adicionais dos pedidos (pin, password)
export const ordersDetails = sqliteTable("orders_details", {
  orderId: text("order_id")
    .primaryKey()
    .references(() => orders.id, { onDelete: "cascade" }),
  pin: text("pin"),
  password: text("password"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Caixa
export const cashSessions = sqliteTable("cash_sessions", {
  id: text("id").primaryKey(),
  openedAt: text("opened_at"),
  closedAt: text("closed_at"),
  openedBy: text("opened_by"),
  closedBy: text("closed_by"),
  openingAmountCents: integer("opening_amount_cents").notNull().default(0),
  closingAmountCents: integer("closing_amount_cents").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
  pendingSync: integer("pending_sync", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const cashMovements = sqliteTable(
  "cash_movements",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => cashSessions.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["in", "out"] }).notNull(),
    reason: text("reason"),
    amountCents: integer("amount_cents").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    sessionIdx: uniqueIndex("ix_cash_movements_session").on(t.sessionId),
  }),
);

// Auxiliares
export const savedCarts = sqliteTable("saved_carts", {
  id: text("id").primaryKey(),
  payload: text("payload", { mode: "json" }).notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
  pendingSync: integer("pending_sync", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const kitchenOperators = sqliteTable("kitchen_operators", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  version: integer("version").notNull().default(1),
  pendingSync: integer("pending_sync", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const globalObservations = sqliteTable(
  "global_observations",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    value: text("value"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    keyIdx: uniqueIndex("ux_global_observations_key").on(t.key),
  }),
);

export const counters = sqliteTable(
  "counters",
  {
    key: text("key").notNull(),
    value: integer("value").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.key] }),
  }),
);

// Metadados de Sync
export const syncLog = sqliteTable(
  "sync_log",
  {
    id: text("id").primaryKey(),
    tableName: text("table_name").notNull(),
    lastPulledAt: text("last_pulled_at"),
    lastPushedAt: text("last_pushed_at"),
  },
  (t) => ({
    uxTable: uniqueIndex("ux_sync_table").on(t.tableName),
  }),
);

// Metadados gerais de Sync (key-value)
export const syncMeta = sqliteTable(
  "sync_meta",
  {
    key: text("key").primaryKey(),
    value: text("value"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
);

// ====== NOVAS TABELAS ======

// Cozinhas (Kitchens)
export const kitchens = sqliteTable(
  "kitchens",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    unitId: text("unit_id").references(() => units.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    nameIdx: uniqueIndex("ux_kitchens_name").on(t.name),
  }),
);

// Configurações do App (key-value)
export const appConfig = sqliteTable(
  "app_config",
  {
    key: text("key").primaryKey(),
    value: text("value"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
);

// Lojas (Stores)
export const stores = sqliteTable(
  "stores",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    address: text("address"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    nameIdx: uniqueIndex("ux_stores_name").on(t.name),
  }),
);

// Perfis de Acesso (Roles)
export const roles = sqliteTable(
  "roles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    permissions: text("permissions"), // JSON array de módulos
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    nameIdx: uniqueIndex("ux_roles_name").on(t.name),
  }),
);

// Usuários (Users)
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    storeId: text("store_id").references(() => stores.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    roleId: text("role_id").references(() => roles.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    usernameIdx: uniqueIndex("ux_users_username").on(t.username),
  }),
);

// Métodos de Pagamento
export const paymentMethods = sqliteTable(
  "payment_methods",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    shortcut: text("shortcut"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    nameIdx: uniqueIndex("ux_payment_methods_name").on(t.name),
  }),
);

// Sessões Operacionais
export const operationalSessions = sqliteTable(
  "operational_sessions",
  {
    id: text("id").primaryKey(),
    pin: text("pin").notNull(),
    storeId: text("store_id").references(() => stores.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    openedByUserId: text("opened_by_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    openedAt: text("opened_at").notNull(),
    closedAt: text("closed_at"),
    status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    pinIdx: uniqueIndex("ux_operational_sessions_pin").on(t.pin),
  }),
);

// Mapeamento Categoria-Cozinha
export const categoryKitchens = sqliteTable(
  "category_kitchens",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    kitchenId: text("kitchen_id")
      .notNull()
      .references(() => kitchens.id, { onDelete: "cascade" }),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    uniqueKey: uniqueIndex("ux_category_kitchens").on(t.categoryId, t.kitchenId),
  }),
);

// Pedidos Completos (armazena JSON do pedido completo para compatibilidade)
export const ordersComplete = sqliteTable(
  "orders_complete",
  {
    id: text("id").primaryKey(),
    payload: text("payload", { mode: "json" }).notNull(), // JSON do Order completo
    status: text("status").notNull().default("NEW"),
    operationalSessionId: text("operational_session_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
);

// Tarefas
export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: text("due_date").notNull(),
    priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
    status: text("status").notNull().default("pending"),
    assignedToId: text("assigned_to_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    storeId: text("store_id").references(() => stores.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    commentsJson: text("comments_json"), // JSON array de comentários
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
);

// Status de Tarefas Customizados
export const taskStatuses = sqliteTable(
  "task_statuses",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    color: text("color").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    isFinal: integer("is_final", { mode: "boolean" }).notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    keyIdx: uniqueIndex("ux_task_statuses_key").on(t.key),
  }),
);

// Checklists Master
export const checklistsMaster = sqliteTable(
  "checklists_master",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    itemsJson: text("items_json"), // JSON array de ChecklistItem
    storeId: text("store_id").references(() => stores.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    frequency: text("frequency", { enum: ["daily", "weekly", "monthly", "on_demand"] }).notNull().default("on_demand"),
    assignedRoleIds: text("assigned_role_ids"), // JSON array de role IDs
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
);

// Execuções de Checklist
export const checklistExecutions = sqliteTable(
  "checklist_executions",
  {
    id: text("id").primaryKey(),
    masterId: text("master_id")
      .notNull()
      .references(() => checklistsMaster.id, { onDelete: "cascade" }),
    storeId: text("store_id").references(() => stores.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    startedByUserId: text("started_by_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    itemsJson: text("items_json"), // JSON array de ChecklistExecutionItem
    status: text("status", { enum: ["in_progress", "completed", "canceled"] }).notNull().default("in_progress"),
    completionPercentage: integer("completion_percentage").notNull().default(0),
    startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    version: integer("version").notNull().default(1),
    pendingSync: integer("pending_sync", { mode: "boolean" })
      .notNull()
      .default(false),
  },
);

// Tipos
export type CategoryRow = typeof categories.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type KDSTicketRow = typeof kdsTickets.$inferSelect;
export type KDSPhaseTimesRow = typeof kdsPhaseTimes.$inferSelect;
export type KDSUnitStatesRow = typeof kdsUnitStates.$inferSelect;
export type OrdersDetailsRow = typeof ordersDetails.$inferSelect;
export type CashSessionRow = typeof cashSessions.$inferSelect;
export type CashMovementRow = typeof cashMovements.$inferSelect;
export type SavedCartRow = typeof savedCarts.$inferSelect;
export type KitchenOperatorRow = typeof kitchenOperators.$inferSelect;
export type GlobalObservationRow = typeof globalObservations.$inferSelect;
export type CounterRow = typeof counters.$inferSelect;

// Novos tipos
export type KitchenRow = typeof kitchens.$inferSelect;
export type AppConfigRow = typeof appConfig.$inferSelect;
export type StoreRow = typeof stores.$inferSelect;
export type RoleRow = typeof roles.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type PaymentMethodRow = typeof paymentMethods.$inferSelect;
export type OperationalSessionRow = typeof operationalSessions.$inferSelect;
export type CategoryKitchenRow = typeof categoryKitchens.$inferSelect;
export type OrderCompleteRow = typeof ordersComplete.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type TaskStatusRow = typeof taskStatuses.$inferSelect;
export type ChecklistMasterRow = typeof checklistsMaster.$inferSelect;
export type ChecklistExecutionRow = typeof checklistExecutions.$inferSelect;

export const ALL_TABLES = {
  units,
  stations,
  deviceProfile,
  categories,
  products,
  orders,
  orderItems,
  payments,
  kdsTickets,
  kdsPhaseTimes,
  kdsUnitStates,
  ordersDetails,
  cashSessions,
  cashMovements,
  savedCarts,
  kitchenOperators,
  globalObservations,
  counters,
  syncLog,
  syncMeta,
  // Novas tabelas
  kitchens,
  appConfig,
  stores,
  roles,
  users,
  paymentMethods,
  operationalSessions,
  categoryKitchens,
  ordersComplete,
  tasks,
  taskStatuses,
  checklistsMaster,
  checklistExecutions,
};

