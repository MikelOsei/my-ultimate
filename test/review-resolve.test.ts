import { expect, it } from 'vitest'
import type { JsonValue } from '@earendil-works/chord'
import { actions } from '../extensions/review/server.ts'
import type { ActionContext } from '../server/actions.ts'
import type { ExtensionHost } from '../server/extensions.ts'

// Newest first, as the server's event log answers; #7's worktree is gone, so its landings are all that is left.
const landings = [
  { id: 3, data: { conversationId: 9, base: 'b2', sha: 's3' } },
  { id: 2, data: { conversationId: 7, base: 'b1', sha: 's2' } },
  { id: 1, data: { conversationId: 7, base: 'b0', sha: 's1' } },
]
const ctx = {
  host: {
    need: () => ({ doc: 'workspaces' }),
    harness: () => ({
      snapshot: async () => ({ items: { 7: { state: 'removed', branch: 'ultimate/x-7' } } }),
    }),
    eventLog: { recent: async () => landings },
  } as unknown as ExtensionHost,
} as ActionContext
const resolve = (args: JsonValue) => actions.resolve(args, ctx)

it("opens a landed branch's latest landing, and nothing for a conversation without changes", async () => {
  expect(await resolve({ conversation: 7 })).toEqual({ spec: 'b1...s2', kind: 'landed', sha: 's2' })
  expect(await resolve({ conversation: 8 })).toBeNull()
  await expect(resolve({ conversation: 'x' })).rejects.toThrow('conversation id')
})
