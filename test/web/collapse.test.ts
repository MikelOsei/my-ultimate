import type { EntryRecord } from '@earendil-works/pi-durable'
import type { UserMessage } from '@earendil-works/pi-ai'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { setCollapsed } from '../../web/src/app/collapse.tsx'
import { UserView } from '../../web/src/app/user-turn.tsx'

vi.mock('../../web/src/sdk/hooks.ts', async () => ({
  ExtensionNameContext: (await import('react')).createContext<string | undefined>(undefined),
  useExtensions: () => [],
  useCopy: () => ({ copied: false, copy: () => {} }),
}))

const stored = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => stored.set(key, value),
  removeItem: (key: string) => stored.delete(key),
})
beforeEach(() => stored.clear())

const message: UserMessage = { role: 'user', content: 'a pasted thread', timestamp: 0 }
const entry = (id: number) => ({ id, conversationId: 3 }) as EntryRecord
const look = (id: number) =>
  renderToStaticMarkup(createElement(UserView, { entry: entry(id), message }))

it('collapses one message to a line that expands it, kept in this browser, storing only collapsed ones', () => {
  expect(look(5)).toContain('a pasted thread')
  setCollapsed(entry(5), true)
  expect(look(5)).not.toContain('a pasted thread')
  expect(look(5)).toContain('Message collapsed')
  expect(look(6)).toContain('a pasted thread')
  setCollapsed(entry(5), false)
  expect(look(5)).toContain('a pasted thread')
  expect([...stored.keys()]).toEqual([])
})
