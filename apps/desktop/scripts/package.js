import { build } from 'electron-builder'

// Sanitize env to avoid accidental signing requirements
delete process.env.WIN_CSC_LINK
delete process.env.CSC_LINK
process.env.CSC_IDENTITY_AUTO = 'false'

try {
  await build()
  console.log('[pack] build completed')
} catch (e) {
  console.error('[pack] build failed:', e?.message || e)
  process.exit(1)
}

