// Display preferences kept in localStorage (not secret, so not encrypted).

import { DEFAULT_CUSTOM_COLORS, type CustomColors, type ThemeMode } from './theme'

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : (JSON.parse(v) as T)
  } catch {
    return fallback
  }
}

function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* storage unavailable */
  }
}

/** pastYears: how many previous years of the same day to show under the editor (0 = none, -1 = all). */
export const prefs = $state({
  pastYears: load<number>('pref.pastYears', 5),
  /** Pen (handwriting) input on the entry page. Off by default until tablet support is finished. */
  ink: load<boolean>('pref.ink', false),
  /** When on, only a stylus draws; fingers scroll (palm rejection). */
  penOnly: load<boolean>('pref.penOnly', true),
  weekStart: load<0 | 1>('pref.weekStart', 0),
  /** "system" follows the OS light/dark setting (default); "custom" uses customColors. */
  themeMode: load<ThemeMode>('pref.themeMode', 'system'),
  customColors: load<CustomColors>('pref.customColors', DEFAULT_CUSTOM_COLORS),
})

// When these last changed, so Drive sync can tell which device's prefs are newer (see
// snapshotPrefs/applyPrefsSnapshot below) — not shown in the UI, just a merge timestamp.
let updatedAt = load<number>('pref.updatedAt', 0)

function touch() {
  updatedAt = Date.now()
  save('pref.updatedAt', updatedAt)
}

export function setPref<K extends keyof typeof prefs>(k: K, v: (typeof prefs)[K]) {
  prefs[k] = v
  save(`pref.${k}`, v)
  touch()
}

export function setCustomColor(k: keyof CustomColors, v: string) {
  prefs.customColors = { ...prefs.customColors, [k]: v }
  save('pref.customColors', prefs.customColors)
  touch()
}

export interface PrefsSnapshot {
  pastYears: number
  ink: boolean
  penOnly: boolean
  weekStart: 0 | 1
  themeMode: ThemeMode
  customColors: CustomColors
  updatedAt: number
}

export function snapshotPrefs(): PrefsSnapshot {
  return { ...prefs, updatedAt }
}

/** Applies a Drive-synced prefs snapshot, but only if it's newer than what's already here —
 *  so two devices open around the same time don't keep overwriting each other's choice. */
export function applyPrefsSnapshot(snap: PrefsSnapshot | undefined) {
  if (!snap || snap.updatedAt <= updatedAt) return
  prefs.pastYears = snap.pastYears
  prefs.ink = snap.ink
  prefs.penOnly = snap.penOnly
  prefs.weekStart = snap.weekStart
  prefs.themeMode = snap.themeMode
  prefs.customColors = snap.customColors
  save('pref.pastYears', snap.pastYears)
  save('pref.ink', snap.ink)
  save('pref.penOnly', snap.penOnly)
  save('pref.weekStart', snap.weekStart)
  save('pref.themeMode', snap.themeMode)
  save('pref.customColors', snap.customColors)
  updatedAt = snap.updatedAt
  save('pref.updatedAt', updatedAt)
}

export const PAST_YEAR_OPTIONS: { v: number; label: string }[] = [
  { v: 0, label: '보지 않음' },
  { v: 1, label: '지난 1년' },
  { v: 3, label: '지난 3년' },
  { v: 5, label: '지난 5년' },
  { v: 10, label: '지난 10년' },
  { v: -1, label: '전체' },
]
