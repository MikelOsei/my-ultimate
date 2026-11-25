/**
 * The docked sidebar's and panel's widths, dragged by their inner edge and kept per browser in `localStorage` as
 * `ultimate.widths`, as the theme is. Each is a CSS variable on the root (`--sidebar-width`, `--panels-width`), so the
 * title bar's left part follows the sidebar on every surface. A width never passes its `max`, nor `share` of the
 * window once that is above its default, so the conversation keeps room between them.
 */
import { useState } from 'react'

const KEY = 'ultimate.widths'

type Bounds = { initial: number; min: number; max: number; share: number }

export const WIDTHS = {
  sidebar: { initial: 288, min: 160, max: 480, share: 0.3 },
  panels: { initial: 352, min: 200, max: 640, share: 0.4 },
} as const
export type Region = keyof typeof WIDTHS

const read = (): Partial<Record<Region, number>> => {
  const stored: Partial<Record<Region, unknown>> = JSON.parse(localStorage.getItem(KEY) ?? '{}')
  return Object.fromEntries(
    Object.entries(stored).filter(
      ([region, width]) => region in WIDTHS && typeof width === 'number',
    ),
  )
}

let widths: Partial<Record<Region, number>> = {}

/** `width` within the region's bounds on this window. */
export function clampWidth(region: Region, width: number) {
  return clamp(WIDTHS[region], width)
}

function clamp({ initial, min, max, share }: Bounds, width: number) {
  const room = Math.max(initial, share * window.innerWidth)
  return Math.round(Math.max(min, Math.min(width, max, room)))
}

// The same bound as clamp, in CSS, so a window made narrower later shrinks the region too.
const css = ({ initial, share }: Bounds, width: number) =>
  `min(${width}px, max(${initial}px, ${share * 100}vw))`

function apply(region: Region) {
  const bounds = WIDTHS[region]
  document.documentElement.style.setProperty(
    `--${region}-width`,
    css(bounds, widths[region] ?? bounds.initial),
  )
}

/** Sets the region's width, or its default when `width` is undefined. */
export function setWidth(region: Region, width: number | undefined) {
  if (width === undefined) delete widths[region]
  else widths[region] = clampWidth(region, width)
  apply(region)
  if (Object.keys(widths).length === 0) localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, JSON.stringify(widths))
}

/** Applies the stored widths; `main.tsx` calls it before the first render. */
export function loadWidths() {
  widths = read()
  apply('sidebar')
  apply('panels')
}

/**
 * An extension pane's width under the same rules, kept per browser as `ultimate.widths.<name>`: the CSS width to give
 * it, and a setter for its `ResizeHandle` (undefined resets it).
 */
export function usePaneWidth(name: string, bounds: Bounds) {
  const key = `${KEY}.${name}`
  const [width, setState] = useState(() => {
    const stored = Number(localStorage.getItem(key))
    return stored > 0 ? clamp(bounds, stored) : bounds.initial
  })
  const set = (next: number | undefined) => {
    if (next === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, String(clamp(bounds, next)))
    setState(next === undefined ? bounds.initial : clamp(bounds, next))
  }
  return [css(bounds, width), set] as const
}
