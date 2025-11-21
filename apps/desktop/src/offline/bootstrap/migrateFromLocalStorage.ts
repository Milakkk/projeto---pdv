/**
 * Migra dados existentes do localStorage para SQLite na primeira execução.
 * Lê chaves reais: orders, savedCarts, kitchenOperators, categories, menuItems,
 * currentCashSession, cashSessions, cashMovements, globalObservations,
 * orderCounter, sessionCounter.
 */
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  categories,
  products,
  orders,
  orderItems,
  payments,
  kdsTickets,
  cashSessions,
  cashMovements,
  savedCarts,
  kitchenOperators,
  globalObservations,
  counters,
} from "../db/schema";

type Any = Record<string, any>;
const LS_FLAG = "__migratedToSQLite__";

function safeJSON<T = any>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
const toCents = (v: any) => {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : Math.round(n * 100);
};
const toIso = (v: any) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const bool = (v: any) => (v ? 1 : 0);
const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export async function runMigrationOnce() {
  // Em ambiente web (sem Electron), o cliente SQLite não está disponível.
  // Pule a migração para evitar erro de runtime.
  if (!db) return;
  if (localStorage.getItem(LS_FLAG) === "true") return;

  const now = new Date().toISOString();

  const lsOrders = safeJSON<Any[]>("orders") ?? [];
  const lsSavedCarts = safeJSON<Any[]>("savedCarts") ?? [];
  const lsKitchenOps = safeJSON<Any[]>("kitchenOperators") ?? [];
  const lsCategories = safeJSON<Any[]>("categories") ?? [];
  const lsMenuItems = safeJSON<Any[]>("menuItems") ?? [];
  const lsCashSessions = safeJSON<Any[]>("cashSessions") ?? [];
  const lsCashMovements = safeJSON<Any[]>("cashMovements") ?? [];
  const lsGlobalObs = safeJSON<Any[]>("globalObservations") ?? [];
  const orderCounter = Number(localStorage.getItem("orderCounter") ?? "0");
  const sessionCounter = Number(localStorage.getItem("sessionCounter") ?? "0");

  const catRows = (lsCategories || []).map((c) => ({
    id: String(c.id ?? uuid()),
    name: String(c.name ?? "Sem Categoria"),
    updatedAt: toIso(c.updated_at) ?? now,
    version: Number(c.version ?? 1),
    pendingSync: bool(false),
  }));

  const catIdByName = new Map<string, string>();
  catRows.forEach((c) => catIdByName.set(c.name, c.id));

  const prodRows = (lsMenuItems || []).map((p) => {
    const price = p.priceCents ?? p.price ?? 0;
    const catName = p.category ?? p.categoryName ?? null;
    const categoryId =
      p.categoryId ??
      (catName ? catIdByName.get(String(catName)) : undefined) ??
      null;
    return {
      id: String(p.id ?? uuid()),
      sku: p.sku ? String(p.sku) : null,
      name: String(p.name ?? p.title ?? "Produto"),
      categoryId,
      priceCents:
        typeof price === "number" ? Math.round(price) : toCents(price),
      isActive: bool(p.isActive ?? true),
      updatedAt: toIso(p.updated_at) ?? now,
      version: Number(p.version ?? 1),
      pendingSync: bool(false),
    };
  });

  const ordRows: Any[] = [];
  const itemRows: Any[] = [];
  const payRows: Any[] = [];
  const ticketRows: Any[] = [];

  for (const o of lsOrders) {
    const oid = String(o.id ?? uuid());
    const status =
      o.status && ["open", "closed", "cancelled"].includes(o.status)
        ? o.status
        : "open";
    const totalCents =
      typeof o.totalCents === "number"
        ? Math.round(o.totalCents)
        : toCents(o.total ?? 0);

    ordRows.push({
      id: oid,
      status,
      totalCents,
      openedAt: toIso(o.openedAt) ?? toIso(o.opened_at),
      closedAt: toIso(o.closedAt) ?? toIso(o.closed_at),
      deviceId: o.deviceId ? String(o.deviceId) : null,
      notes: o.notes ? String(o.notes) : null,
      updatedAt: toIso(o.updated_at) ?? now,
      version: Number(o.version ?? 1),
      pendingSync: bool(false),
    });

    const items: Any[] = o.items ?? o.orderItems ?? [];
    for (const it of items) {
      const iid = String(it.id ?? uuid());
      const productId = it.productId ?? it.product_id ?? null;
      const unitPrice =
        typeof it.unitPriceCents === "number"
          ? Math.round(it.unitPriceCents)
          : toCents(it.unitPrice ?? it.price ?? 0);

      itemRows.push({
        id: iid,
        orderId: oid,
        productId: productId ? String(productId) : null,
        qty: Number(it.qty ?? it.quantity ?? 1),
        unitPriceCents: unitPrice,
        notes: it.notes ? String(it.notes) : null,
        updatedAt: toIso(it.updated_at) ?? now,
        version: Number(it.version ?? 1),
        pendingSync: bool(false),
      });
    }

    const paymentsList: Any[] =
      o.payments ??
      (o.payment
        ? [
            {
              method: o.payment.method ?? o.paymentMethod,
              amount: o.payment.amount,
              change: o.payment.change,
              authCode: o.payment.authCode,
            },
          ]
        : []);
    for (const p of paymentsList) {
      const pid = String(p.id ?? uuid());
      const methodRaw = p.method ?? p.type ?? p.paymentMethod ?? "cash";
      const method = ["cash", "pix", "debit", "credit", "voucher"].includes(
        methodRaw,
      )
        ? methodRaw
        : "cash";

      payRows.push({
        id: pid,
        orderId: oid,
        method,
        amountCents:
          typeof p.amountCents === "number"
            ? Math.round(p.amountCents)
            : toCents(p.amount ?? 0),
        changeCents:
          typeof p.changeCents === "number"
            ? Math.round(p.changeCents)
            : toCents(p.change ?? 0),
        authCode: p.authCode ? String(p.authCode) : null,
        updatedAt: toIso(p.updated_at) ?? now,
        version: Number(p.version ?? 1),
        pendingSync: bool(false),
      });
    }

    const t = o.kdsTicket ?? o.ticket;
    if (t) {
      ticketRows.push({
        id: String(t.id ?? uuid()),
        orderId: oid,
        status: ["queued", "prep", "ready", "done"].includes(t.status)
          ? t.status
          : "queued",
        station: t.station ? String(t.station) : null,
        updatedAt: toIso(t.updated_at) ?? now,
        version: Number(t.version ?? 1),
        pendingSync: bool(false),
      });
    }
  }

  const sessionRows = (safeJSON<Any[]>("cashSessions") ?? []).map((s) => ({
    id: String(s.id ?? uuid()),
    openedAt: toIso(s.openedAt) ?? toIso(s.opened_at),
    closedAt: toIso(s.closedAt) ?? toIso(s.closed_at),
    openedBy: s.openedBy ? String(s.openedBy) : null,
    closedBy: s.closedBy ? String(s.closedBy) : null,
    openingAmountCents:
      typeof s.openingAmountCents === "number"
        ? Math.round(s.openingAmountCents)
        : toCents(s.openingAmount ?? s.opening ?? 0),
    closingAmountCents:
      typeof s.closingAmountCents === "number"
        ? Math.round(s.closingAmountCents)
        : toCents(s.closingAmount ?? s.closing ?? 0),
    updatedAt: toIso(s.updated_at) ?? now,
    version: Number(s.version ?? 1),
    pendingSync: bool(false),
  }));

  const lsCurrentCash = safeJSON<Any>("currentCashSession");
  if (lsCurrentCash && !sessionRows.find((x) => x.id === lsCurrentCash.id)) {
    sessionRows.push({
      id: String(lsCurrentCash.id ?? uuid()),
      openedAt: toIso(lsCurrentCash.openedAt) ?? toIso(lsCurrentCash.opened_at),
      closedAt: toIso(lsCurrentCash.closedAt) ?? toIso(lsCurrentCash.closed_at),
      openedBy: lsCurrentCash.openedBy ? String(lsCurrentCash.openedBy) : null,
      closedBy: lsCurrentCash.closedBy ? String(lsCurrentCash.closedBy) : null,
      openingAmountCents:
        typeof lsCurrentCash.openingAmountCents === "number"
          ? Math.round(lsCurrentCash.openingAmountCents)
          : toCents(lsCurrentCash.openingAmount ?? 0),
      closingAmountCents:
        typeof lsCurrentCash.closingAmountCents === "number"
          ? Math.round(lsCurrentCash.closingAmountCents)
          : toCents(lsCurrentCash.closingAmount ?? 0),
      updatedAt: toIso(lsCurrentCash.updated_at) ?? now,
      version: Number(lsCurrentCash.version ?? 1),
      pendingSync: bool(false),
    });
  }

  const movementRows = (lsCashMovements || []).map((m) => ({
    id: String(m.id ?? uuid()),
    sessionId: String(m.sessionId ?? m.cashSessionId ?? sessionRows[0]?.id),
    type: (m.type === "out" ? "out" : "in") as "in" | "out",
    reason: m.reason ? String(m.reason) : null,
    amountCents:
      typeof m.amountCents === "number"
        ? Math.round(m.amountCents)
        : toCents(m.amount ?? 0),
    createdAt: toIso(m.createdAt) ?? toIso(m.created_at) ?? now,
    updatedAt: toIso(m.updated_at) ?? now,
    version: Number(m.version ?? 1),
    pendingSync: bool(false),
  }));

  const savedCartRows = (lsSavedCarts || []).map((c) => ({
    id: String(c.id ?? uuid()),
    payload: JSON.stringify(c.payload ?? c),
    updatedAt: toIso(c.updated_at) ?? now,
    version: Number(c.version ?? 1),
    pendingSync: bool(false),
  }));

  const kitchenOpRows = (lsKitchenOps || []).map((k) => ({
    id: String(k.id ?? uuid()),
    name: String(k.name ?? "Operador"),
    role: k.role ? String(k.role) : null,
    updatedAt: toIso(k.updated_at) ?? now,
    version: Number(k.version ?? 1),
    pendingSync: bool(false),
  }));

  const globalObsRows = (lsGlobalObs || []).map((g) => ({
    id: String(g.id ?? uuid()),
    key: String(g.key ?? g.name ?? uuid()),
    value: g.value != null ? String(g.value) : null,
    updatedAt: toIso(g.updated_at) ?? now,
    version: Number(g.version ?? 1),
    pendingSync: bool(false),
  }));

  const counterRows = [
    { key: "orderCounter", value: Number.isFinite(orderCounter) ? orderCounter : 0, updatedAt: now },
    { key: "sessionCounter", value: Number.isFinite(sessionCounter) ? sessionCounter : 0, updatedAt: now },
  ];

  await db.transaction(async (tx) => {
    await tx.insert(categories).values(catRows).onConflictDoNothing().run();
    await tx.insert(products).values(prodRows).onConflictDoNothing().run();

    await tx.insert(orders).values(ordRows).onConflictDoNothing().run();
    await tx.insert(orderItems).values(itemRows).onConflictDoNothing().run();
    await tx.insert(payments).values(payRows).onConflictDoNothing().run();
    await tx.insert(kdsTickets).values(ticketRows).onConflictDoNothing().run();

    await tx.insert(cashSessions).values(sessionRows).onConflictDoNothing().run();
    await tx.insert(cashMovements).values(movementRows).onConflictDoNothing().run();

    await tx.insert(savedCarts).values(savedCartRows).onConflictDoNothing().run();
    await tx.insert(kitchenOperators).values(kitchenOpRows).onConflictDoNothing().run();
    await tx.insert(globalObservations).values(globalObsRows).onConflictDoNothing().run();

    for (const c of counterRows) {
      const exists = await tx.select().from(counters).where(eq(counters.key, c.key));
      if (exists.length) {
        await tx.update(counters).set({ value: c.value, updatedAt: c.updatedAt }).where(eq(counters.key, c.key)).run();
      } else {
        await tx.insert(counters).values(c as any).run();
      }
    }
  });

  localStorage.setItem(LS_FLAG, "true");
}
