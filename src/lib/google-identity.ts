// Shared loader for Google Identity Services (GIS) — used both by the Drive
// sync OAuth2 token flow and the sign-in access gate, so the script is
// injected at most once no matter which feature touches it first.
declare global {
  interface Window { google?: any }
}

let gisLoaded: Promise<void> | null = null
export function loadGis(): Promise<void> {
  gisLoaded ??= new Promise((resolve, reject) => {
    if (window.google?.accounts) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Google 로그인 스크립트를 불러오지 못했어요.'))
    document.head.appendChild(s)
  })
  return gisLoaded
}
