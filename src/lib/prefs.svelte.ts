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

export function setPref<K extends keyof typeof prefs>(k: K, v: (typeof prefs)[K]) {
  prefs[k] = v
  save(`pref.${k}`, v)
}

export function setCustomColor(k: keyof CustomColors, v: string) {
  prefs.customColors = { ...prefs.customColors, [k]: v }
  save('pref.customColors', prefs.customColors)
}

export const PAST_YEAR_OPTIONS: { v: number; label: string }[] = [
  { v: 0, label: '보지 않음' },
  { v: 1, label: '지난 1년' },
  { v: 3, label: '지난 3년' },
  { v: 5, label: '지난 5년' },
  { v: 10, label: '지난 10년' },
  { v: -1, label: '전체' },
]
