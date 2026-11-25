// Applies the chosen theme (system / light / dark / custom) as inline CSS custom
// properties on <html>, overriding the defaults in app.css. "system" clears the
// overrides so the plain stylesheet (which already follows prefers-color-scheme) takes over.

export type ThemeMode = 'system' | 'light' | 'dark' | 'custom'

export type CustomColors = { bg: string; paper: string; ink: string; accent: string }

export const DEFAULT_CUSTOM_COLORS: CustomColors = { bg: '#f3f4f6', paper: '#ffffff', ink: '#1f2328', accent: '#1f3a5f' }

// Same values as the :root / prefers-color-scheme:dark blocks in app.css, so "라이트"/"다크"
// force one of them regardless of the OS setting.
const PALETTES: Record<'light' | 'dark', Record<string, string> & { colorScheme: 'light' | 'dark' }> = {
  light: {
    bg: '#f3f4f6', paper: '#ffffff', ink: '#1f2328', muted: '#646b75',
    line: '#d9dde3', 'line-soft': '#eceef1', accent: '#1f3a5f', 'accent-soft': '#e8edf4',
    mark: '#9a7b4f', sun: '#b0413e', sat: '#2f5b9a', danger: '#b0413e',
    shadow: '0 1px 2px rgb(20 30 45 / 0.06)', colorScheme: 'light',
  },
  dark: {
    bg: '#16181c', paper: '#1f2227', ink: '#e6e8eb', muted: '#9aa1ab',
    line: '#353a42', 'line-soft': '#2a2e34', accent: '#9db8dc', 'accent-soft': '#263345',
    mark: '#c9a874', sun: '#e0716d', sat: '#8fb0e0', danger: '#e0716d',
    shadow: '0 1px 2px rgb(0 0 0 / 0.3)', colorScheme: 'dark',
  },
}

const ALL_VARS = ['bg', 'paper', 'ink', 'muted', 'line', 'line-soft', 'accent', 'accent-soft', 'mark', 'sun', 'sat', 'danger', 'shadow']

/** Rough relative luminance from a #rgb/#rrggbb hex string, to pick a light/dark color-scheme hint. */
function isDark(hex: string): boolean {
  const m = hex.replace('#', '')
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const r = parseInt(n.slice(0, 2), 16) || 0
  const g = parseInt(n.slice(2, 4), 16) || 0
  const b = parseInt(n.slice(4, 6), 16) || 0
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5
}

/** Derives the rest of the palette from the 4 user-picked base colors via CSS color-mix(),
 *  so one pick (background/surface/text/accent) is enough instead of tuning every variable. */
function customPalette(c: CustomColors): Record<string, string> & { colorScheme: 'light' | 'dark' } {
  const dark = isDark(c.bg)
  return {
    bg: c.bg, paper: c.paper, ink: c.ink, accent: c.accent,
    muted: 'color-mix(in srgb, var(--ink) 55%, var(--bg) 45%)',
    line: 'color-mix(in srgb, var(--ink) 16%, var(--bg) 84%)',
    'line-soft': 'color-mix(in srgb, var(--ink) 8%, var(--bg) 92%)',
    'accent-soft': 'color-mix(in srgb, var(--accent) 14%, var(--bg) 86%)',
    mark: 'color-mix(in srgb, var(--accent) 55%, #8a6d3f 45%)',
    sun: 'color-mix(in srgb, #b0413e 80%, var(--bg) 20%)',
    sat: 'color-mix(in srgb, var(--accent) 60%, #2f5b9a 40%)',
    danger: 'color-mix(in srgb, #b0413e 80%, var(--bg) 20%)',
    shadow: dark ? '0 1px 2px rgb(0 0 0 / 0.3)' : '0 1px 2px rgb(20 30 45 / 0.06)',
    colorScheme: dark ? 'dark' : 'light',
  }
}

// index.html's two <meta name="theme-color" media="prefers-color-scheme:..."> tags pick the
// mobile browser chrome color by OS setting; when a mode is forced, both are set to match it.
function setMetaThemeColor(bg: string | null) {
  const metas = document.querySelectorAll('meta[name="theme-color"]')
  metas.forEach((m, i) => m.setAttribute('content', bg ?? (i === 0 ? PALETTES.light.bg : PALETTES.dark.bg)))
}

export function applyTheme(mode: ThemeMode, custom: CustomColors) {
  const root = document.documentElement.style
  if (mode === 'system') {
    for (const k of ALL_VARS) root.removeProperty(`--${k}`)
    root.removeProperty('color-scheme')
    setMetaThemeColor(null)
    return
  }
  const palette = mode === 'custom' ? customPalette(custom) : PALETTES[mode]
  for (const k of ALL_VARS) root.setProperty(`--${k}`, palette[k])
  root.setProperty('color-scheme', palette.colorScheme)
  setMetaThemeColor(palette.bg)
}
