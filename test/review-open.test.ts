import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { JsonValue } from '@earendil-works/chord'
import { git } from '../lib/git.ts'
import { LineageApi } from '../extensions/lineage/api.ts'
import { actions } from '../extensions/review/server.ts'
import type { ActionContext } from '../server/actions.ts'
import type { ExtensionHost } from '../server/extensions.ts'

let checkout: string
let worktree: string
let rev: string
// What the editor was asked to open: lineage's openEditor, faked.
const opened: { folder: string; file?: string; line?: number }[] = []

beforeAll(async () => {
  checkout = await mkdtemp(join(tmpdir(), 'review-open-'))
  worktree = await mkdtemp(join(tmpdir(), 'review-open-worktree-'))
  await git(checkout, 'init', '-q')
  await mkdir(join(checkout, 'src'))
  await writeFile(join(checkout, 'src/kept.ts'), 'kept\n')
  await writeFile(join(checkout, 'src/gone.ts'), 'one\ntwo\n')
  await git(checkout, 'add', '.')
  await git(checkout, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'base')
  rev = await git(checkout, 'rev-parse', 'HEAD')
  await rm(join(checkout, 'src/gone.ts'))
  await mkdir(join(worktree, 'src'))
  await writeFile(join(worktree, 'src/kept.ts'), 'kept in the worktree\n')
})
afterAll(async () => {
  await Promise.all(
    [checkout, worktree, join(tmpdir(), 'ultimate-review', rev)].map((path) =>
      rm(path, { recursive: true, force: true }),
    ),
  )
})

const ctx = () =>
  ({
    host: {
      projectRoot: checkout,
      need: (api: unknown) =>
        api === LineageApi
          ? {
              openEditor: async (folder: string, file?: string, line?: number) => {
                opened.push({ folder, file, line })
                return { editor: 'code' }
              },
            }
          : { doc: 'workspaces' },
      harness: () => ({
        snapshot: async () => ({ items: { 7: { state: 'ready', path: worktree } } }),
      }),
    } as unknown as ExtensionHost,
  }) as ActionContext
const open = async (args: JsonValue) => {
  opened.length = 0
  const result = await actions.open(args, ctx())
  return { ...result, ...opened[0] }
}

it("opens a file in the diff's worktree while it is there, else in the project checkout", async () => {
  expect(await open({ worktree: 7, file: 'src/kept.ts', line: 3, rev })).toEqual({
    editor: 'code',
    opens: 'worktree',
    folder: worktree,
    file: 'src/kept.ts',
    line: 3,
  })
  // #8 has no worktree (any more): the checkout has the file.
  expect(await open({ worktree: 8, file: 'src/kept.ts', line: 1, rev })).toMatchObject({
    opens: 'checkout',
    folder: checkout,
  })
})

it('opens a read-only copy from Git of a file gone from both folders', async () => {
  const opens = await open({ worktree: 7, file: 'src/gone.ts', line: 2, rev })
  const folder = join(tmpdir(), 'ultimate-review', rev)
  expect(opens).toMatchObject({ opens: 'copy', folder, file: 'src/gone.ts', line: 2 })
  expect(await readFile(join(folder, 'src/gone.ts'), 'utf8')).toBe('one\ntwo\n')
  expect((await stat(join(folder, 'src/gone.ts'))).mode & 0o222).toBe(0)
  // Opened again, the copy is reused.
  expect(await open({ file: 'src/gone.ts', rev })).toMatchObject({ opens: 'copy', folder })
})

it('refuses a path out of its folder and a revision that is not a commit of the project', async () => {
  await expect(open({ worktree: 7, file: '../outside.ts', rev })).rejects.toThrow(
    'inside the folder',
  )
  await expect(open({ file: 'src/gone.ts', rev: 'HEAD' })).rejects.toThrow('full commit sha')
  await expect(open({ file: 'src/gone.ts', rev: 'f'.repeat(40) })).rejects.toThrow(
    'not a commit of this project',
  )
})
