// Gates the whole app behind "signed in with an allow-listed Google account".
// This is an access gate only — it decides who may even open the page. It is
// deliberately separate from the diary's own encryption: each device still
// has its own local password/recovery-code pair guarding the actual entries
// (see vault.svelte.ts), so losing access here never puts diary contents at
// risk, and passing the gate never substitutes for that password either.
import { loadGis } from './google-identity'
import { GOOGLE_CLIENT_ID } from './drive-sync.svelte'
import { ALLOWED_EMAILS } from './allowlist'

const APPROVED_KEY = 'accessGate.approvedEmail'

export const gate = $state({
  status: 'checking' as 'checking' | 'signed_out' | 'denied' | 'approved',
  email: '',
})

function decodeIdToken(credential: string): { email?: string; email_verified?: boolean } {
  const payload = credential.split('.')[1]
  const json = decodeURIComponent(
    atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(''),
  )
  return JSON.parse(json)
}

function handleCredential(credential: string) {
  const { email, email_verified } = decodeIdToken(credential)
  if (email && email_verified && ALLOWED_EMAILS.includes(email)) {
    localStorage.setItem(APPROVED_KEY, email)
    gate.email = email
    gate.status = 'approved'
  } else {
    gate.email = email ?? ''
    gate.status = 'denied'
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
  await loadGis()
  window.google!.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (resp: { credential: string }) => handleCredential(resp.credential),
  })
  gate.status = 'signed_out'
}

export function renderSignInButton(el: HTMLElement) {
  window.google!.accounts.id.renderButton(el, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'ko' })
}
