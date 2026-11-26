// Native (Capacitor/Android) Google sign-in. Used only inside the wrapped Android app —
// the web build keeps using the Google Identity Services flow in drive-sync.svelte.ts,
// since Google blocks that flow from inside an embedded WebView (origin_mismatch /
// disallowed_useragent). This uses Android's Credential Manager instead, via a plugin,
// which Google does trust from inside an app.
//
// Known limitation of this phase: on a stock (unmodified) Capacitor MainActivity, the
// plugin can't request the extra Drive scope, so `accessToken` below is usually null and
// Drive sync stays off in the native app for now — only the access-gate login works here.
import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'
import { GOOGLE_CLIENT_ID } from './drive-sync.svelte'

export const isNative = Capacitor.isNativePlatform()

let initialized = false
async function ensureInitialized() {
  if (initialized) return
  await SocialLogin.initialize({ google: { webClientId: GOOGLE_CLIENT_ID } })
  initialized = true
}

export interface NativeGoogleResult {
  email: string
  emailVerified: boolean
  accessToken: string | null
}

export async function nativeSignIn(): Promise<NativeGoogleResult> {
  await ensureInitialized()
  const { result } = await SocialLogin.login({ provider: 'google', options: {} })
  if (result.responseType !== 'online' || !result.idToken) {
    throw new Error('로그인에 실패했어요. 다시 시도해주세요.')
  }
  let emailVerified = false
  try {
    const { claims } = await SocialLogin.decodeIdToken({ idToken: result.idToken })
    emailVerified = claims.email_verified === true
  } catch {
    // leave emailVerified false; signIn() will then show "denied" rather than let it slide
  }
  return { email: result.profile.email ?? '', emailVerified, accessToken: result.accessToken?.token ?? null }
}

export async function nativeSignOut(): Promise<void> {
  await ensureInitialized()
  try {
    await SocialLogin.logout({ provider: 'google' })
  } catch {
    // best-effort — the access gate clears its own local state regardless
  }
}
