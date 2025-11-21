import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '../electron/icon-256.png')

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  }
  const out = Buffer.alloc(4)
  out.writeUInt32BE(~c >>> 0)
  return out
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type)
  const crc = crc32(Buffer.concat([t, data]))
  return Buffer.concat([len, t, data, crc])
}

const width = 256
const height = 256
const pngSig = Buffer.from([137,80,78,71,13,10,26,10])

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(width, 0)
ihdr.writeUInt32BE(height, 4)
ihdr.writeUInt8(8, 8)
ihdr.writeUInt8(6, 9)
ihdr.writeUInt8(0, 10)
ihdr.writeUInt8(0, 11)
ihdr.writeUInt8(0, 12)

const row = Buffer.alloc(1 + width * 4)
row.writeUInt8(0, 0)
for (let i = 0; i < width; i++) {
  const off = 1 + i * 4
  row[off] = 245
  row[off + 1] = 158
  row[off + 2] = 11
  row[off + 3] = 255
}

const raw = Buffer.concat(Array.from({ length: height }, () => row))
const idat = zlib.deflateSync(raw)

const file = Buffer.concat([
  pngSig,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0))
])

writeFileSync(outPath, file)
console.log('[png] generated:', outPath, 'size=', file.length)
