import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'node:path'

const isPreview = process.env.IS_PREVIEW ? true : false
const userBase = process.env.BASE_PATH
// Base '/' para dev server HTTP; build para Electron usa file:// com hash
const base = isPreview ? (userBase || '/') : '/'

export default defineConfig({
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
      'drizzle-orm/sqlite-core',
      'react-hot-toast'
    ],
    force: true,
  },
  build: {
    sourcemap: true,
    outDir: 'out',
    rollupOptions: {
      external: ['drizzle-orm', 'drizzle-orm/sqlite-core']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@sync': resolve(__dirname, '../../packages/sync/src'),
      '@db': resolve(__dirname, '../../packages/db/src'),
      '@auth': resolve(__dirname, '../../packages/auth/src'),
      '@ui': resolve(__dirname, '../../packages/ui/src'),
    },
    dedupe: ['react', 'react-dom']
  },
  server: {
    port: 3010,
    strictPort: true,
    host: '0.0.0.0',
    fs: {
      strict: false,
      allow: [resolve(__dirname, './src'), '..']
    }
  }
})
