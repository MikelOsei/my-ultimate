import type { EntryRecord } from '@earendil-works/pi-durable'
import type { UserMessage } from '@earendil-works/pi-ai'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import {
  excerptOf,
  replyInput,
  replyLine,
  selectionEnd,
  withReply,
} from '../../web/src/app/reply.ts'
import { skillInput, UserView } from '../../web/src/app/user-turn.tsx'

vi.mock('../../web/src/sdk/hooks.ts', async () => ({
  ExtensionNameContext: (await import('react')).createContext<string | undefined>(undefined),
  useExtensions: () => [],
  useCopy: () => ({ copied: false, copy: () => {} }),
}))
vi.stubGlobal('localStorage', { getItem: () => null })

it('quotes the first line of a message, short, and reads the quote back from the sent text', () => {
  const excerpt = excerptOf(
    `\n  Two things:   the "build" broke ${'and more '.repeat(10)}\nsecond line`,
  )
  expect(excerpt.length).toBeLessThanOrEqual(80)
  expect(excerpt).toMatch(/^Two things: the "build" broke and more .*…$/)
  expect(excerptOf('Alpha.\nBeta.', 'Alpha.\n  Beta.')).toBe('Alpha. Beta.')
  const sent = withReply('fix the build first', { id: 42, excerpt })
  expect(replyInput(sent)).toEqual({ id: 42, excerpt, text: 'fix the build first' })
  expect(replyInput('↪ re #42 is how I would write it')).toBeUndefined()
})

it("floats the selection's Reply above its last highlighted character, past an empty box on the next line", () => {
  const box = (right: number, top: number, width: number) => ({ right, top, width })
  expect(selectionEnd([box(300, 10, 200), box(140, 30, 120), box(20, 50, 0)])).toEqual({
    left: 140,
    top: 30,
  })
  expect(selectionEnd([])).toBeUndefined()
})

it('keeps a skill command at the start of a reply, where the server expands it', () => {
  const sent = withReply('/skill:review the diff', { id: 7, excerpt: 'Ready' })
  expect(sent).toBe('/skill:review ↪ re #7: "Ready"\n\nthe diff')
  const expanded = `<skill name="review" location="/skills/review">\nReferences are relative to /skills.\n\nReview it.\n</skill>\n\n${sent.slice('/skill:review '.length)}`
  expect(replyInput(skillInput(expanded)!.request)).toEqual({
    id: 7,
    excerpt: 'Ready',
    text: 'the diff',
  })
})

it("shows a reply's quote as a quiet line in the user's bubble, above their own words", () => {
  const message: UserMessage = {
    role: 'user',
    content: `${replyLine({ id: 42, excerpt: 'The build broke' })}\n\nfix it first`,
    timestamp: 0,
  }
  const html = renderToStaticMarkup(
    createElement(UserView, { entry: { id: 50, conversationId: 3 } as EntryRecord, message }),
  )
  expect(html).toContain('data-reply-quote="42"')
  expect(html).toContain('The build broke')
  expect(html).toContain('fix it first')
  expect(html).not.toContain('↪ re #42')
})
