// Canal IPC seguro para queries ao SQLite no processo MAIN (ESM)
import { ipcMain, BrowserWindow } from 'electron'
import * as db from './db.js'

function isSelect(sql) {
  return String(sql).trim().toLowerCase().startsWith('select')
}

function isWrite(sql) {
  const upper = String(sql).trim().toUpperCase()
  return upper.startsWith('INSERT') || upper.startsWith('UPDATE') || upper.startsWith('DELETE')
}

// Broadcast de mudanças no banco para todas as janelas
function broadcastDbChange(table, operation, data) {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    try {
      win.webContents.send('db:change', { table, operation, data, timestamp: Date.now() })
    } catch {}
  }
}

// Extrai nome da tabela de uma query SQL
function extractTableName(sql) {
  const upper = String(sql).trim().toUpperCase()
  let match
  
  if (upper.startsWith('INSERT INTO')) {
    match = upper.match(/INSERT\s+INTO\s+(\w+)/i)
  } else if (upper.startsWith('UPDATE')) {
    match = upper.match(/UPDATE\s+(\w+)/i)
  } else if (upper.startsWith('DELETE FROM')) {
    match = upper.match(/DELETE\s+FROM\s+(\w+)/i)
  }
  
  return match ? match[1].toLowerCase() : null
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
      
      // Broadcast de mudanças para todas as janelas
      if (isWrite(sql) && result.changes > 0) {
        const table = extractTableName(sql)
        if (table) {
          const operation = sql.trim().toUpperCase().startsWith('INSERT') ? 'insert' 
            : sql.trim().toUpperCase().startsWith('UPDATE') ? 'update' 
            : 'delete'
          // Pequeno delay para garantir que a transação foi commitada
          setTimeout(() => {
            broadcastDbChange(table, operation, { 
              changes: result.changes, 
              lastInsertRowid: result.lastInsertRowid 
            })
          }, 10)
        }
      }
      
      return { rows: [], meta: { type: 'run', changes: result.changes, lastInsertRowid: result.lastInsertRowid } }
    }
  } catch (err) {
    return { error: String(err?.message || err), rows: [], meta: null }
  }
})
