import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './src/offline/db/migrations',
  schema: './src/offline/db/schema.ts',
  driver: 'better-sqlite',
  dbCredentials: {
    url: 'data.db',
  },
})

