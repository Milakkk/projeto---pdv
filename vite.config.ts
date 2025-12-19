import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'node:path'
import AutoImport from 'unplugin-auto-import/vite'

const isPreview = process.env.IS_PREVIEW ? true : false
const userBase = process.env.BASE_PATH
// Em modo preview (web), mantenha base configurável ou '/'.
// Para build usado no Electron (offline), use caminhos relativos './'.
const base = isPreview ? (userBase || '/') : './'
// https://vitejs.dev/config/
export default defineConfig({
  define: {
   __BASE_PATH__: JSON.stringify(base),
   __IS_PREVIEW__: JSON.stringify(isPreview)
  },
  plugins: [react(),
    AutoImport({
      imports: [
        {
          'react': [
            'React',
            'useState',
            'useEffect',
            'useContext',
            'useReducer',
            'useCallback',
            'useMemo',
            'useRef',
            'useImperativeHandle',
            'useLayoutEffect',
            'useDebugValue',
            'useDeferredValue',
            'useId',
            'useInsertionEffect',
            'useSyncExternalStore',
            'useTransition',
            'startTransition',
            'lazy',
            'memo',
            'forwardRef',
            'createContext',
            'createElement',
            'cloneElement',
            'isValidElement'
          ]
        },
        {
          'react-router-dom': [
            'useNavigate',
            'useLocation',
            'useParams',
            'useSearchParams',
            'Link',
            'NavLink',
            'Navigate',
            'Outlet'
          ]
        },
        // React i18n
        {
          'react-i18next': [
            'useTranslation',
            'Trans'
          ]
        }
      ],
      dts: true,
    }),
  ],
  base, // Base dinâmica: './' para Electron (offline), '/' para preview
  optimizeDeps: {
    exclude: ['drizzle-orm/sqlite-core', 'better-sqlite3']
  },
  build: {
    sourcemap: true,
    outDir: 'out',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@sync': resolve(__dirname, './packages/sync/src'),
      '@db': resolve(__dirname, './packages/db/src'),
      '@auth': resolve(__dirname, './packages/auth/src'),
      '@ui': resolve(__dirname, './packages/ui/src'),
      '@/offline/db/schema': resolve(__dirname, './src/offline/db/schema.browser.ts'),
      'drizzle-orm/sqlite-core': resolve(__dirname, './apps/desktop/src/offline/db/sqlite-core-stub.ts'),
    }
  },
  server: {
    port: 3001, // Porta alterada para 3001
    host: '0.0.0.0',
  }
})
