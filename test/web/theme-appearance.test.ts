import { beforeEach, expect, it, vi } from 'vitest'
import {
  DEFAULT_APPEARANCE,
  readAppearance,
  writeAppearance,
} from '../../extensions/theme/appearance.tsx'

const stored = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => stored.set(key, value),
  removeItem: (key: string) => stored.delete(key),
})
beforeEach(() => stored.clear())

it('keeps a chosen appearance, storing only what differs from the default', () => {
  writeAppearance({ system: true, dark: 'ruby', accent: 'teal', text: 15 })
  expect(JSON.parse(stored.get('ultimate.appearance')!)).toEqual({
    system: true,
    dark: 'ruby',
    accent: 'teal',
  })
  expect(readAppearance()).toEqual({ system: true, dark: 'ruby', accent: 'teal', text: 15 })

  writeAppearance(DEFAULT_APPEARANCE)
  expect(stored.has('ultimate.appearance')).toBe(false)
  expect(readAppearance()).toEqual(DEFAULT_APPEARANCE)
})

it('reads a value no longer offered as its default', () => {
  stored.set('ultimate.appearance', JSON.stringify({ dark: 'light', accent: 'mauve', text: 30 }))
  expect(readAppearance()).toEqual(DEFAULT_APPEARANCE)
})
