// Stub para drizzle-orm/sqlite-core no ambiente navegador
// Este arquivo substitui as importações de sqlite-core quando não está em Electron

export const sqliteTable = () => {
  throw new Error('sqliteTable não está disponível no navegador. Use Supabase.');
};

export const text = () => {
  throw new Error('text não está disponível no navegador. Use Supabase.');
};

export const integer = () => {
  throw new Error('integer não está disponível no navegador. Use Supabase.');
};

export const primaryKey = () => {
  throw new Error('primaryKey não está disponível no navegador. Use Supabase.');
};

export const uniqueIndex = () => {
  throw new Error('uniqueIndex não está disponível no navegador. Use Supabase.');
};

export const real = () => {
  throw new Error('real não está disponível no navegador. Use Supabase.');
};

export const blob = () => {
  throw new Error('blob não está disponível no navegador. Use Supabase.');
};

