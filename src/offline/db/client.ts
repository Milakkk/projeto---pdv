// Evita que o Vite bundle better-sqlite3 no browser.
const isElectron = typeof process !== 'undefined' && !!(process.versions as any)?.electron;

let db: ReturnType<any> | undefined;

if (isElectron) {
  try {
    // Usar require dinâmico para carregar módulos nativos apenas no Electron
    const Database = (eval as any)('require')('better-sqlite3');
    const { drizzle } = (eval as any)('require')('drizzle-orm/better-sqlite3');

    // Armazena o db ao lado do executável ou diretório atual
    const sqlite = new Database('data.db');
    db = drizzle(sqlite);
    
    // Expor flag global para indicar que DB está disponível
    if (typeof window !== 'undefined') {
      (window as any).__db_available = true;
    }
  } catch (err) {
    // Evita que a aplicação quebre se os bindings nativos não estiverem presentes/reconstruídos
    console.error('SQLite nativo indisponível no Electron (bindings). Prosseguindo sem DB local.', err);
    db = undefined as any;
    if (typeof window !== 'undefined') {
      (window as any).__db_available = false;
    }
  }
} else {
  // Em ambiente web, este cliente não está disponível.
  // Caso necessário, implementar fallback (ex.: sql.js/IndexedDB) em outro módulo.
  db = undefined as any;
  if (typeof window !== 'undefined') {
    (window as any).__db_available = false;
  }
}

export { db };
