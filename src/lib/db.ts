// Tiny IndexedDB wrapper. Stores only encrypted records.
import type { Sealed, WrappedKey } from './crypto'

export interface VaultMeta {
  version: 1
  createdAt: number
  password: WrappedKey
  // absent until the user asks for one from Settings (regenerateRecoveryCode) — setup no
  // longer forces a "write this down" step before the diary can be used
  recovery?: WrappedKey
}

export interface EncryptedEntry extends Sealed {
  date: string // YYYY-MM-DD (kept in clear so entries can be indexed by date)
  updatedAt: number
  deleted?: boolean
}

const DB_NAME = 'mannyeon-diary'
let dbp: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      db.createObjectStore('meta')
      db.createObjectStore('entries', { keyPath: 'date' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const r = fn(tx.objectStore(store))
        tx.oncomplete = () => resolve(r ? r.result : (undefined as T))
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export const getMeta = () => run<VaultMeta | undefined>('meta', 'readonly', (s) => s.get('vault'))
export const putMeta = (m: VaultMeta) => run('meta', 'readwrite', (s) => void s.put(m, 'vault'))
export const getAllEntries = () => run<EncryptedEntry[]>('entries', 'readonly', (s) => s.getAll())
export const putEntry = (e: EncryptedEntry) => run('entries', 'readwrite', (s) => void s.put(e))
export const putEntries = (es: EncryptedEntry[]) =>
  run('entries', 'readwrite', (s) => {
    for (const e of es) s.put(e)
  })
export async function wipeAll() {
  await run('entries', 'readwrite', (s) => void s.clear())
  await run('meta', 'readwrite', (s) => void s.clear())
}
