// Canal IPC seguro para queries ao SQLite no processo MAIN (ESM)
import { ipcMain } from 'electron'
import * as db from './db.js'

function isSelect(sql) {
  return String(sql).trim().toLowerCase().startsWith('select')
}

ipcMain.handle('db:query', async (event, payload) => {
  const sql = payload?.sql
  const params = payload?.params ?? []
  if (typeof sql !== 'string') {
    return { error: 'Invalid SQL', rows: [], meta: null }
  }
  if (!Array.isArray(params) && typeof params !== 'object') {
    return { error: 'Invalid params', rows: [], meta: null }
  }
  // Garantia: uso de placeholders via prepare; nenhuma concatenação de parâmetros
  try {
    const partition = event?.sender?.session?.getPartition?.() || 'default'
    if (isSelect(sql)) {
      const rows = db.allForPartition(partition, sql, Array.isArray(params) ? params : [params])
      return { rows, meta: { type: 'select' } }
    } else {
      const result = db.runForPartition(partition, sql, Array.isArray(params) ? params : [params])
      return { rows: [], meta: { type: 'run', changes: result.changes, lastInsertRowid: result.lastInsertRowid } }
    }
  } catch (err) {
    return { error: String(err?.message || err), rows: [], meta: null }
  }
})
