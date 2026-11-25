/**
 * The appearance beyond light and dark: whether the theme follows the system, which dark theme dark is, the accent
 * and the conversation text size. Kept in `localStorage` as `ultimate.appearance`, which `web/index.html` applies
 * before the first paint; the light or dark choice itself stays the shell's `ultimate.theme`. The accent is the
 * project's (`server/appearance.ts`), or when it has none the theme's: the copy here only paints it before the server
 * says it.
 */
import { ACCENTS } from '../../shared/protocol.ts'
import type { Accent } from '../../shared/protocol.ts'

export { ACCENTS }

/**
 * The themes: Light, and the dark ones dark can be. Their tokens are in `web/src/index.css`; `bar` is the background
 * in hex for the browser's bar, as `web/index.html` has it too.
 */
export const THEMES = [
  { id: 'charcoal', label: 'Charcoal', accent: 'violet', bar: '#1d1e20' },
  { id: 'ruby', label: 'Ruby', accent: 'ruby', bar: '#1b1617' },
  { id: 'dracula', label: 'Dracula', accent: 'violet', bar: '#282a36' },
  { id: 'candy', label: 'Candy', accent: 'pink', bar: '#1d111c' },
  { id: 'midnight', label: 'Midnight', accent: 'blue', bar: '#161f2a' },
  { id: 'light', label: 'Light', accent: 'violet', bar: '#f9fafb' },
] as const satisfies readonly { id: string; label: string; accent: Accent; bar: string }[]
export type ThemeId = (typeof THEMES)[number]['id']
export type DarkTheme = Exclude<ThemeId, 'light'>
const DARK_THEMES = THEMES.filter((theme) => theme.id !== 'light').map((theme) => theme.id)

/** The theme shown: Light, or the dark theme. */
export const themeOf = (appearance: Appearance, mode: 'dark' | 'light') =>
  THEMES.find((theme) => theme.id === (mode === 'light' ? 'light' : appearance.dark))!

/** Conversation prose in px; 15 is the default. */
export const TEXT_SIZES = [14, 15, 16, 17] as const
export type TextSize = (typeof TEXT_SIZES)[number]

export interface Appearance {
  system: boolean
  dark: DarkTheme
  accent: Accent
  text: TextSize
}

const KEY = 'ultimate.appearance'
export const DEFAULT_APPEARANCE: Appearance = {
  system: false,
  dark: 'charcoal',
  accent: 'violet',
  text: 15,
}

/** The stored appearance; a value this version does not offer reads as its default. */
export function readAppearance(): Appearance {
  const stored: Partial<Record<keyof Appearance, unknown>> = JSON.parse(
    localStorage.getItem(KEY) ?? '{}',
  )
  return {
    system: stored.system === true,
    dark: DARK_THEMES.find((theme) => theme === stored.dark) ?? DEFAULT_APPEARANCE.dark,
    accent: ACCENTS.find((accent) => accent === stored.accent) ?? DEFAULT_APPEARANCE.accent,
    text: TEXT_SIZES.find((size) => size === stored.text) ?? DEFAULT_APPEARANCE.text,
  }
}

/** Stores only what differs from the default, so a default appearance leaves the page exactly as it was. */
export function writeAppearance(appearance: Appearance) {
  const changed = Object.fromEntries(
    Object.entries(appearance).filter(
      ([key, value]) => value !== DEFAULT_APPEARANCE[key as keyof Appearance],
    ),
  )
  if (Object.keys(changed).length === 0) localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, JSON.stringify(changed))
}

/**
 * Puts the dark theme, accent and text size on the root element and the accent on the tab's icon, as index.html does
 * at load. The dark theme counts only while the root is dark.
 */
export function applyAppearance(appearance: Appearance, root: HTMLElement) {
  if (appearance.dark === DEFAULT_APPEARANCE.dark) delete root.dataset.theme
  else root.dataset.theme = appearance.dark
  if (appearance.accent === DEFAULT_APPEARANCE.accent) delete root.dataset.accent
  else root.dataset.accent = appearance.accent
  const icon = document.querySelector<HTMLLinkElement>('link[rel=icon]')
  if (icon) icon.href = `/api/icon.svg?shape=favicon&accent=${appearance.accent}`
  if (appearance.text === DEFAULT_APPEARANCE.text) root.style.removeProperty('--prose-size')
  else root.style.setProperty('--prose-size', `${appearance.text}px`)
}
