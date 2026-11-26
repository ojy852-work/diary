// Gates the whole app behind "signed in with an allow-listed Google account". This is an
// access gate only — it decides who may even open the page. It is deliberately separate
// from the diary's own encryption: each device still has its own local password/recovery-
// code pair guarding the actual entries (see vault.svelte.ts), so losing access here never
// puts diary contents at risk, and passing the gate never substitutes for that password.
//
// The same Google sign-in also grants Drive access (one consent covers both), so a brand
// new device/browser can recognize "this account already has a diary" and ask for the
// existing password instead of offering to start a new one — see seedFromRemote below.
import { ensureToken, fetchRemoteBackup, markConnectedWithToken, GOOGLE_CLIENT_ID } from './drive-sync.svelte'
import { seedFromRemote } from './vault.svelte'
import { ALLOWED_EMAILS } from './allowlist'

const APPROVED_KEY = 'accessGate.approvedEmail'
const KEEP_SIGNED_IN_KEY = 'accessGate.keepSignedIn'

export const gate = $state({
  status: 'checking' as 'checking' | 'signed_out' | 'denied' | 'approved',
  email: '',
  busy: false,
  error: '',
  // whether a successful login should be remembered on this device, or asked again next time;
  // the choice itself is remembered so the checkbox stays as the user last left it
  keepSignedIn: localStorage.getItem(KEEP_SIGNED_IN_KEY) !== '0',
})

export function setKeepSignedIn(value: boolean) {
  gate.keepSignedIn = value
  localStorage.setItem(KEEP_SIGNED_IN_KEY, value ? '1' : '0')
}

async function fetchEmail(token: string): Promise<{ email?: string; email_verified?: boolean }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`사용자 정보를 가져오지 못했어요 (${res.status})`)
  return res.json()
}

export async function signIn() {
  if (gate.busy) return
  gate.busy = true
  gate.error = ''
  try {
    // ensureToken itself times out if the popup never opens/responds, so this never hangs
    const token = await ensureToken(true)
    const { email, email_verified } = await fetchEmail(token)
    if (email && email_verified && ALLOWED_EMAILS.includes(email)) {
      markConnectedWithToken(token)
      try {
        const remote = await fetchRemoteBackup(token)
        if (remote) await seedFromRemote(remote)
      } catch {
        // best-effort only: if this fails the device just falls back to "새로 만들기" as before
      }
      if (gate.keepSignedIn) localStorage.setItem(APPROVED_KEY, email)
      else localStorage.removeItem(APPROVED_KEY)
      gate.email = email
      gate.status = 'approved'
    } else {
      gate.email = email ?? ''
      gate.status = 'denied'
    }
  } catch (e) {
    gate.error = e instanceof Error ? e.message : '로그인에 실패했어요. 다시 시도해주세요.'
  } finally {
    gate.busy = false
  }
}

export async function initGate() {
  // not configured (no client ID set up yet): don't block local development
  if (!GOOGLE_CLIENT_ID) {
    gate.status = 'approved'
    return
  }
  const saved = localStorage.getItem(APPROVED_KEY)
  if (saved && ALLOWED_EMAILS.includes(saved)) {
    gate.email = saved
    gate.status = 'approved'
    return
  }
  gate.status = 'signed_out'
}
