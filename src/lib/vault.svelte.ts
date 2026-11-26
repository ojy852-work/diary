// App state: lock status, the decrypted entries held in memory while unlocked, and every
// operation that reads or writes the encrypted store.
import { SvelteMap } from 'svelte/reactivity'
import * as c from './crypto'
import * as db from './db'
import type { EncryptedEntry, VaultMeta } from './db'
import { hasInk, type InkPage } from './ink/model'

export interface Entry {
  date: string
  text: string
  mood: string
  /** handwriting page (pen input); absent when the day has none */
  ink?: InkPage
  updatedAt: number
}

interface Payload { text: string; mood: string; ink?: InkPage }

const fromPayload = (date: string, p: Payload, updatedAt: number): Entry => ({
  date,
  text: p.text ?? '',
  mood: p.mood ?? '',
  ...(hasInk(p.ink) ? { ink: p.ink } : {}),
  updatedAt,
})

export interface BackupFile {
  format: 'mannyeon-backup'
  version: 1
  exportedAt: string
  vault: VaultMeta
  entries: EncryptedEntry[]
}

type Status = 'loading' | 'setup' | 'locked' | 'unlocked'

let key: CryptoKey | null = null
// Kept in memory only (never persisted) while unlocked, so Drive sync can re-wrap/merge a
// remote backup without asking again mid-session. Cleared on lock, exactly like `key`.
let sessionPassword: string | null = null
export const getSessionPassword = () => sessionPassword

export const vault = $state({ status: 'loading' as Status })
export const entries = new SvelteMap<string, Entry>()

export async function init() {
  const meta = await db.getMeta()
  vault.status = meta ? 'locked' : 'setup'
}

async function loadEntries(k: CryptoKey) {
  const rows = await db.getAllEntries()
  const out: Entry[] = []
  for (const r of rows) {
    if (r.deleted) continue
    const p = await c.openJson<Payload>(k, r)
    out.push(fromPayload(r.date, p, r.updatedAt))
  }
  entries.clear()
  for (const e of out) entries.set(e.date, e)
}

/**
 * If this device has no local vault yet, seeds it from a Drive backup (still encrypted,
 * same as it was written) so the next screen asks for the EXISTING password instead of
 * offering to create a brand new diary. No-ops if a local vault already exists here.
 */
export async function seedFromRemote(file: BackupFile): Promise<boolean> {
  if (await db.getMeta()) return false
  if (file?.format !== 'mannyeon-backup') return false
  await db.putMeta(file.vault)
  await db.putEntries(file.entries)
  return true
}

/**
 * First run: creates the vault and unlocks it right away. No recovery code is generated
 * here anymore — get one anytime from Settings (regenerateRecoveryCode) once you're in.
 */
export async function setup(password: string): Promise<void> {
  const raw = c.randomBytes(32)
  const meta: VaultMeta = {
    version: 1,
    createdAt: Date.now(),
    password: await c.wrapDek(raw, password),
  }
  await db.putMeta(meta)
  key = await c.importDek(raw)
  sessionPassword = password
  raw.fill(0)
  entries.clear()
  vault.status = 'unlocked'
}

/** The editor registers a function here so unsaved text is written before locking. */
export const hooks: { flush: (() => Promise<void>) | null } = { flush: null }

export async function unlock(password: string): Promise<boolean> {
  const meta = await db.getMeta()
  if (!meta) return false
  let raw: Uint8Array<ArrayBuffer>
  try {
    raw = await c.unwrapDek(meta.password, password)
  } catch {
    return false
  }
  key = await c.importDek(raw)
  sessionPassword = password
  raw.fill(0)
  await loadEntries(key)
  vault.status = 'unlocked'
  return true
}

/** Forgot password: the recovery code unlocks and sets a new password. */
export async function recover(code: string, newPassword: string): Promise<boolean> {
  const meta = await db.getMeta()
  if (!meta?.recovery) return false
  let raw: Uint8Array<ArrayBuffer>
  try {
    raw = await c.unwrapDek(meta.recovery, c.normalizeRecoveryCode(code))
  } catch {
    return false
  }
  meta.password = await c.wrapDek(raw, newPassword)
  await db.putMeta(meta)
  key = await c.importDek(raw)
  sessionPassword = newPassword
  raw.fill(0)
  await loadEntries(key)
  vault.status = 'unlocked'
  return true
}

/** Re-proves the current password, then issues a brand new recovery code and retires the
 *  old one. Lets the user get a fresh code any time from Settings, instead of only once at
 *  setup — without ever storing the plaintext code anywhere. */
export async function regenerateRecoveryCode(password: string): Promise<string | null> {
  const meta = await db.getMeta()
  if (!meta) return null
  let raw: Uint8Array<ArrayBuffer>
  try {
    raw = await c.unwrapDek(meta.password, password)
  } catch {
    return null
  }
  const code = c.makeRecoveryCode()
  meta.recovery = await c.wrapDek(raw, code)
  raw.fill(0)
  await db.putMeta(meta)
  return code
}

/** Checks a password against the current vault without unlocking or changing anything. */
export async function verifyPassword(password: string): Promise<boolean> {
  const meta = await db.getMeta()
  if (!meta) return false
  try {
    const raw = await c.unwrapDek(meta.password, password)
    raw.fill(0)
    return true
  } catch {
    return false
  }
}

export async function changePassword(oldPw: string, newPw: string): Promise<boolean> {
  const meta = await db.getMeta()
  if (!meta) return false
  try {
    const raw = await c.unwrapDek(meta.password, oldPw)
    meta.password = await c.wrapDek(raw, newPw)
    raw.fill(0)
  } catch {
    return false
  }
  await db.putMeta(meta)
  sessionPassword = newPw
  return true
}

export async function lock() {
  try {
    await hooks.flush?.()
  } catch {
    /* ignore */
  }
  key = null
  sessionPassword = null
  entries.clear()
  vault.status = 'locked'
}

export async function saveEntry(date: string, text: string, mood: string, ink?: InkPage | null) {
  if (!key) throw new Error('locked')
  const updatedAt = Date.now()
  const inkOk = hasInk(ink)
  if (!text.trim() && !mood && !inkOk) {
    // empty entry = delete (tombstone kept for future sync)
    if (!entries.has(date)) return
    const sealed = await c.sealJson(key, { text: '', mood: '' })
    await db.putEntry({ date, ...sealed, updatedAt, deleted: true })
    entries.delete(date)
    return
  }
  const payload: Payload = inkOk ? { text, mood, ink } : { text, mood }
  const sealed = await c.sealJson(key, payload)
  await db.putEntry({ date, ...sealed, updatedAt })
  entries.set(date, fromPayload(date, payload, updatedAt))
}

// ---------- backup / import / export ----------

export async function exportBackup(): Promise<BackupFile> {
  const meta = await db.getMeta()
  if (!meta) throw new Error('no vault')
  return {
    format: 'mannyeon-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    vault: meta,
    entries: await db.getAllEntries(),
  }
}

/**
 * Merges an encrypted backup (from this or another device/vault) into the current vault.
 * Needs the password that was in use when the backup was made. Newer edits win per date.
 */
export async function importBackup(file: BackupFile, password: string): Promise<{ added: number; updated: number } | null> {
  if (!key) throw new Error('locked')
  if (file?.format !== 'mannyeon-backup') throw new Error('백업 파일 형식이 아니에요.')
  let theirKey: CryptoKey
  try {
    const raw = await c.unwrapDek(file.vault.password, password)
    theirKey = await c.importDek(raw)
    raw.fill(0)
  } catch {
    return null
  }
  let added = 0
  let updated = 0
  const toWrite: EncryptedEntry[] = []
  const existing = new Map((await db.getAllEntries()).map((e) => [e.date, e]))
  for (const r of file.entries) {
    const mine = existing.get(r.date)
    if (mine && mine.updatedAt >= r.updatedAt) continue
    if (r.deleted) {
      if (mine && !mine.deleted) {
        toWrite.push({ ...(await c.sealJson(key, { text: '', mood: '' })), date: r.date, updatedAt: r.updatedAt, deleted: true })
        entries.delete(r.date)
        updated++
      }
      continue
    }
    const p = await c.openJson<Payload>(theirKey, r)
    toWrite.push({ ...(await c.sealJson(key, p)), date: r.date, updatedAt: r.updatedAt })
    entries.set(r.date, fromPayload(r.date, p, r.updatedAt))
    if (mine && !mine.deleted) updated++
    else added++
  }
  await db.putEntries(toWrite)
  return { added, updated }
}

/**
 * Imports plain text diaries. Accepts:
 *  - JSON: [{ "date": "2015-03-01", "text": "..." }, ...]
 *  - Markdown/text where each day starts with a heading or line like "## 2015-03-01" / "2015.03.01"
 * Text for a date that already has an entry is appended, not overwritten.
 */
export async function importPlain(content: string): Promise<number> {
  const found = new Map<string, string>()
  const moods = new Map<string, string>()
  const trimmed = content.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const data = JSON.parse(trimmed)
    const list: unknown[] = Array.isArray(data) ? data : (data.entries ?? [])
    for (const item of list as Record<string, unknown>[]) {
      const d = normalizeDate(String(item.date ?? item.creationDate ?? ''))
      const t = String(item.text ?? item.content ?? item.body ?? '').trim()
      if (d && t) found.set(d, found.has(d) ? `${found.get(d)}\n\n${t}` : t)
    }
  } else {
    let cur: string | null = null
    let buf: string[] = []
    const flush = () => {
      const t = buf.join('\n').trim()
      if (cur && t) found.set(cur, found.has(cur) ? `${found.get(cur)}\n\n${t}` : t)
      buf = []
    }
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*#{0,6}\s*(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})[일.]?(?:\s*\(.\))?(?:\s+(\S{1,8}))?\s*$/u)
      if (m) {
        flush()
        cur = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
        if (m[4] && !/[\p{L}\p{N}]/u.test(m[4])) moods.set(cur, m[4])
      } else buf.push(line)
    }
    flush()
  }
  let n = 0
  for (const [date, text] of found) {
    const prev = entries.get(date)
    if (prev?.text.includes(text)) continue
    await saveEntry(date, prev?.text ? `${prev.text}\n\n${text}` : text, prev?.mood || moods.get(date) || '', prev?.ink)
    n++
  }
  return n
}

function normalizeDate(s: string): string | null {
  const m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null
}

export function exportMarkdown(): string {
  const sorted = [...entries.values()].sort((a, b) => a.date.localeCompare(b.date))
  return sorted
    .map((e) => `## ${e.date}${e.mood ? ` ${e.mood}` : ''}\n\n${e.text.trim()}${e.ink ? `${e.text.trim() ? '\n\n' : ''}(손글씨 ${e.ink.strokes.length}획: 백업 파일에만 들어 있어요)` : ''}\n`)
    .join('\n')
}

export async function wipeEverything() {
  hooks.flush = null
  await db.wipeAll()
  await lock()
  vault.status = 'setup'
}

export function tagsOf(text: string): string[] {
  return [...new Set([...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]))]
}
