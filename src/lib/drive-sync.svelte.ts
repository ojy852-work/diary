// Optional Google Drive sync. Off by default, and fully separate from the lock/encryption
// system: Drive only ever stores the same encrypted BackupFile the local ".mdiary" export
// produces, inside this app's private appDataFolder (invisible to the rest of the user's
// Drive). Signing in only tells us "whose folder this is" — it can't be used to read a
// single diary entry without the diary password too.
import { exportBackup, importBackup, getSessionPassword, type BackupFile } from './vault.svelte'
import { loadGis } from './google-identity'

// A public OAuth "Web application" client ID from https://console.cloud.google.com
// (APIs & Services > Credentials). Not a secret — it is paired with an allow-list of
// authorized JavaScript origins on Google's side, so it's fine to commit once you have one.
export const GOOGLE_CLIENT_ID = '778725502188-q0nn4uo7a2o6ob062pu0iolm3p3509jf.apps.googleusercontent.com'

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const FILE_NAME = 'mannyeon-diary-sync.json'
const CONNECTED_KEY = 'driveSync.connected'
const LAST_SYNCED_KEY = 'driveSync.lastSynced'

export const driveSync = $state({
  configured: GOOGLE_CLIENT_ID.length > 0,
  status: 'disconnected' as 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error',
  error: '',
  lastSynced: Number(localStorage.getItem(LAST_SYNCED_KEY) || 0) || null,
})

let tokenClient: any = null
let accessToken: string | null = null

function getTokenClient() {
  tokenClient ??= window.google!.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPE,
    callback: () => {}, // overridden per-call below
  })
  return tokenClient
}

function requestToken(interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = getTokenClient()
    client.callback = (resp: any) => {
      if (resp.error) reject(new Error(resp.error))
      else resolve(resp.access_token)
    }
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' })
  })
}

async function ensureToken(interactive: boolean): Promise<string> {
  await loadGis()
  if (accessToken) return accessToken
  accessToken = await requestToken(interactive)
  return accessToken
}

function driveFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })
}

async function findRemoteFile(token: string): Promise<{ id: string } | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}'`)
  const res = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`)
  if (!res.ok) throw new Error(`Drive 목록을 읽지 못했어요 (${res.status})`)
  const data = await res.json()
  return data.files?.[0] ?? null
}

async function downloadRemoteFile(token: string, id: string): Promise<BackupFile> {
  const res = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${id}?alt=media`)
  if (!res.ok) throw new Error(`Drive 파일을 읽지 못했어요 (${res.status})`)
  return res.json()
}

async function uploadFile(token: string, id: string | null, content: BackupFile): Promise<void> {
  const body = JSON.stringify(content)
  const res = id
    ? await driveFetch(token, `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    : await driveFetch(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/related; boundary=mannyeon' },
        body:
          `--mannyeon\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
          `${JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })}\r\n` +
          `--mannyeon\r\nContent-Type: application/json\r\n\r\n${body}\r\n--mannyeon--`,
      })
  if (!res.ok) throw new Error(`Drive에 올리지 못했어요 (${res.status})`)
}

export async function connect() {
  if (!driveSync.configured) return
  driveSync.status = 'connecting'
  driveSync.error = ''
  try {
    await ensureToken(true)
    localStorage.setItem(CONNECTED_KEY, '1')
    await syncNow()
  } catch (e) {
    driveSync.status = 'error'
    driveSync.error = e instanceof Error ? e.message : String(e)
  }
}

export function disconnect() {
  if (accessToken) window.google?.accounts?.oauth2?.revoke(accessToken, () => {})
  accessToken = null
  localStorage.removeItem(CONNECTED_KEY)
  driveSync.status = 'disconnected'
  driveSync.error = ''
}

export const wasConnected = () => localStorage.getItem(CONNECTED_KEY) === '1'

/** Downloads the remote backup (if any), merges it in, then uploads the merged result back. */
export async function syncNow() {
  if (!driveSync.configured) return
  const password = getSessionPassword()
  if (!password) {
    driveSync.status = 'error'
    driveSync.error = '잠금을 푼 상태에서만 동기화할 수 있어요.'
    return
  }
  driveSync.status = 'syncing'
  driveSync.error = ''
  try {
    const run = async (token: string) => {
      const remote = await findRemoteFile(token)
      if (remote) {
        const file = await downloadRemoteFile(token, remote.id)
        await importBackup(file, password)
      }
      const merged = await exportBackup()
      await uploadFile(token, remote?.id ?? null, merged)
    }
    try {
      await run(await ensureToken(false))
    } catch {
      // the cached token may have expired; drop it and try once more with a fresh one
      accessToken = null
      await run(await ensureToken(false))
    }
    driveSync.lastSynced = Date.now()
    localStorage.setItem(LAST_SYNCED_KEY, String(driveSync.lastSynced))
    driveSync.status = 'connected'
  } catch (e) {
    driveSync.status = 'error'
    driveSync.error = e instanceof Error ? e.message : String(e)
  }
}

/** Call once after unlocking, if the user connected Drive before, to sync without asking again. */
export async function autoSyncIfConnected() {
  if (!driveSync.configured || !wasConnected()) return
  driveSync.status = 'connecting'
  try {
    await ensureToken(false)
    await syncNow()
  } catch (e) {
    driveSync.status = 'error'
    driveSync.error = e instanceof Error ? e.message : String(e)
  }
}
