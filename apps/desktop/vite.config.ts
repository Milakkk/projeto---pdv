import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const rootDir = resolve(__dirname, '../..') // Raiz do projeto (2 níveis acima)

const isPreview = process.env.IS_PREVIEW ? true : false
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
const userBase = process.env.BASE_PATH
// Base '/' para produção/Vercel; build para Electron usa file:// com hash
const base = isProduction ? '/' : (isPreview ? (userBase || '/') : '/')

export default defineConfig({
  envDir: rootDir, // Procura .env na raiz do projeto
  envPrefix: 'VITE_',
  define: {
   __BASE_PATH__: JSON.stringify(base),
   __IS_PREVIEW__: JSON.stringify(isPreview)
  },
  plugins: [react()],
  base,
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'react-i18next',
      'i18next',
      '@supabase/supabase-js',
      'drizzle-orm',
      'react-hot-toast'
    ],
    exclude: ['drizzle-orm/sqlite-core', 'better-sqlite3'],
    force: true,
  },
  build: {
    sourcemap: false, // Desabilitar sourcemaps em produção para build mais rápido
    outDir: 'out',
    emptyOutDir: true,
    rollupOptions: {
      external: ['better-sqlite3'],
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase-vendor': ['@supabase/supabase-js']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@sync': resolve(__dirname, '../../packages/sync/src'),
      '@db': resolve(__dirname, '../../packages/db/src'),
      '@auth': resolve(__dirname, '../../packages/auth/src'),
      '@ui': resolve(__dirname, '../../packages/ui/src'),
      '@/offline/db/schema': resolve(__dirname, './src/offline/db/schema.browser.ts'),
      // Stub para drizzle-orm/sqlite-core no navegador (não usado em produção web)
      'drizzle-orm/sqlite-core': resolve(__dirname, './src/offline/db/sqlite-core-stub.ts'),
    },
    dedupe: ['react', 'react-dom']
  },
  server: {
    port: 3010,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: false,
      allow: [resolve(__dirname, './src'), '..']
    }
  }
})
