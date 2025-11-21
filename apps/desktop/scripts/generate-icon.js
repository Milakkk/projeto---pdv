import { writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '../electron/icon.ico')

// Prefer an existing 256x256 PNG if present, otherwise fallback to 1x1
let png
try {
  const pngPath = join(__dirname, '../electron/icon-256.png')
  png = readFileSync(pngPath)
} catch {
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
  png = Buffer.from(pngBase64, 'base64')
}

// ICO header (6 bytes): reserved=0, type=1, count=1
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)

// Icon directory (16 bytes)
const dir = Buffer.alloc(16)
// In ICO directory, 0 represents 256
let w = 1, h = 1
if (png && png.length > 24 && png.readUInt32BE(12) === 0x49484452) {
  w = png.readUInt32BE(16)
  h = png.readUInt32BE(20)
}
dir.writeUInt8(w >= 256 ? 0 : w, 0)
dir.writeUInt8(h >= 256 ? 0 : h, 1)
dir.writeUInt8(0, 2) // color count
dir.writeUInt8(0, 3) // reserved
dir.writeUInt16LE(0, 4) // planes
dir.writeUInt16LE(0, 6) // bitcount
dir.writeUInt32LE(png.length, 8) // bytes in resource
dir.writeUInt32LE(6 + 16, 12) // offset to PNG data

const ico = Buffer.concat([header, dir, png])
writeFileSync(outPath, ico)
console.log('[icon] generated:', outPath, 'size=', ico.length)
