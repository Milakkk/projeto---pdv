
import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
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
