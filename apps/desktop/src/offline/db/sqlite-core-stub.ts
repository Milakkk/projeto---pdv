// Stub para drizzle-orm/sqlite-core no ambiente navegador
// Evita que o app quebre ao avaliar schemas em builds web.

const chainable = () => ({
  primaryKey() { return this },
  notNull() { return this },
  default() { return this },
  references() { return this },
});

export const sqliteTable = (_name?: string, _cols?: any, _indexes?: any) => ({ id: undefined } as any);
export const text = (_name?: string, _opts?: any) => chainable();
export const integer = (_name?: string, _opts?: any) => chainable();
export const real = (_name?: string, _opts?: any) => chainable();
export const blob = (_name?: string, _opts?: any) => chainable();
export const primaryKey = (_args?: any) => ({} as any);
export const uniqueIndex = (_name?: string) => ({ on() { return {} as any } });

