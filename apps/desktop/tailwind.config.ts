
import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Animações e rings usados dinamicamente
    'animate-spin',
    'animate-subtle-pulse',
    'ring-2',
    'ring-white',
    // Cores usadas condicionalmente em badges/botões
    'bg-blue-50', 'bg-blue-100', 'text-blue-600', 'text-blue-800',
    'bg-red-50', 'bg-red-100', 'text-red-600', 'text-red-800',
    'bg-green-100', 'text-green-800',
    'bg-amber-50', 'bg-amber-100', 'text-amber-600',
    'bg-purple-50', 'text-purple-600',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#1f2937',
          100: '#111827',
          200: '#0f172a',
        }
      }
    },
  },
  plugins: [],
} satisfies Config
