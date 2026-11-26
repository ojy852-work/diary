// Gates the whole app behind "signed in with an allow-listed Google account". This is an
// access gate only — it decides who may even open the page. It is deliberately separate
// from the diary's own encryption: each device still has its own local password/recovery-
// code pair guarding the actual entries (see vault.svelte.ts), so losing access here never
// puts diary contents at risk, and passing the gate never substitutes for that password.
//
// The same Google sign-in also grants Drive access (one consent covers both), so a brand
// new device/browser can recognize "this account already has a diary" and ask for the
// existing password instead of offering to start a new one — see seedFromRemote below.
import { ensureToken, fetchRemoteBackup, markConnectedWithToken, disconnect as disconnectDrive, GOOGLE_CLIENT_ID } from './drive-sync.svelte'
import { seedFromRemote, lock } from './vault.svelte'
import { ALLOWED_EMAILS } from './allowlist'
import { isNative, nativeSignIn, nativeSignOut } from './native-google-auth'

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
    // The Android app signs in natively (Credential Manager) since Google refuses this flow
    // from inside an embedded WebView; the website uses the Google Identity Services popup.
    // Both converge on the same email/verified/driveToken shape below.
    let email: string | undefined
    let emailVerified: boolean
    let driveToken: string | null
    if (isNative) {
      const r = await nativeSignIn()
      email = r.email
      emailVerified = r.emailVerified
      driveToken = r.accessToken
    } else {
      // ensureToken itself times out if the popup never opens/responds, so this never hangs
      const token = await ensureToken(true)
      const info = await fetchEmail(token)
      email = info.email
      emailVerified = !!info.email_verified
      driveToken = token
    }
    if (email && emailVerified && ALLOWED_EMAILS.includes(email)) {
      // on native, driveToken is usually null for now (see native-google-auth.ts) — Drive
      // sync just stays off until that gets its own native scope request
      if (driveToken) {
        markConnectedWithToken(driveToken)
        try {
          const remote = await fetchRemoteBackup(driveToken)
          if (remote) await seedFromRemote(remote)
        } catch {
          // best-effort only: if this fails the device just falls back to "새로 만들기" as before
        }
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
    // Drive itself reconnects quietly later, right after the diary is unlocked (see
    // autoSyncIfConnected in App.svelte) — not here, so opening the app never shows a
    // surprise Google popup before you've even reached the password screen.
    return
  }
  gate.status = 'signed_out'
}

/** Signs out of the Google access gate on this device: forgets the approved account, drops
 *  the Drive connection, and locks the vault (the diary's own password is unaffected and
 *  still guards the data — this only ends how this device reaches the gate). */
export async function signOut() {
  localStorage.removeItem(APPROVED_KEY)
  if (isNative) await nativeSignOut()
  disconnectDrive()
  await lock()
  gate.email = ''
  gate.status = 'signed_out'
}
