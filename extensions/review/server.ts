import { readFile, realpath, stat } from 'node:fs/promises'
import { join, resolve as resolvePath } from 'node:path'
import type { Context } from '@earendil-works/chord'
import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context'
import { defineEntry, ROOT_CONVERSATION_ID } from '@earendil-works/pi-durable'
import type { ConversationId } from '@earendil-works/pi-durable'
import { implementAction } from '../../lib/actions.ts'
import { formatAgo } from '../../lib/ago.ts'
import { UserInputEvent } from '../../shared/events.ts'
import { git, isolatable } from '../../lib/git.ts'
import type { ExtensionHost } from '../../server/extensions.ts'
import { LineageApi } from '../lineage/api.ts'
import { SubagentsApi } from '../subagents/api.ts'
import { SubmissionLanded, WorkspacesApi } from '../workspaces/api.ts'
import { checkReview, reviewText } from './comments.ts'
import type { ReviewComments } from './comments.ts'
import { forkPoint, reviewDiff, treeOf, treePath, treeSpec, worktrees } from './diff.ts'
import { copyOf, locate } from './open.ts'
import {
  DiffAction,
  OpenAction,
  RangesAction,
  RecipientAction,
  ResolveAction,
  SendAction,
} from './refs.ts'
import type { ReviewOf, ReviewRange } from './refs.ts'

/** A review the user sent: the input its recipient reads as `reviewText`; card.tsx renders it. */
export const ReviewCommentsEntry = defineEntry<ReviewComments>('review.comments')

const index = (host: ExtensionHost, ctx: Context) =>
  host.harness().snapshot(host.need(WorkspacesApi).doc, ROOT_CONVERSATION_ID, ctx)

/** Conversation `id`'s worktree while it is ready, else undefined. */
async function readyWorktree(host: ExtensionHost, id: unknown) {
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1)
    throw new Error('conversation must be a conversation id')
  const workspace = (await index(host, context))?.items[String(id)]
  return workspace?.state === 'ready' ? workspace.path : undefined
}

/** Conversation `id`'s worktree while it is ready, else the project's checkout (also once it was released). */
async function where(host: ExtensionHost, id: unknown) {
  if (id === undefined) return host.projectRoot
  return (await readyWorktree(host, id)) ?? host.projectRoot
}

/** The conversation whose ready worktree is the folder `root`, as `treeOf` gives it (real path, its top), with it. */
async function ownerOf(host: ExtensionHost, root: string) {
  for (const [id, item] of Object.entries((await index(host, context))?.items ?? {})) {
    if (item.state !== 'ready') continue
    const real = await realpath(item.path).catch(
      // Gone from disk while still listed: it is no worktree to own anything.
      () => undefined,
    )
    if (real === root) return { id: Number(id), item }
  }
  return undefined
}

/**
 * Where `spec`'s files open for editing: a `tree:<folder>` spec's worktree while it is one (with the conversation it
 * belongs to), the ready worktree of an `uncommitted:<id>` spec, a `branch:<name>` spec's owner or `conversation`, else
 * the project checkout.
 */
async function openIn(
  host: ExtensionHost,
  spec: string,
  conversation: unknown,
): Promise<{ worktree?: number; tree?: string; folder: string }> {
  if (treePath(spec) !== undefined) {
    const tree = await treeOf(host.projectRoot, spec).catch(
      // No worktree any more: a landed tree's diff opens in the checkout or as a copy.
      () => undefined,
    )
    if (!tree) return { folder: host.projectRoot }
    const owner = await ownerOf(host, tree.path)
    return { ...(owner && { worktree: owner.id }), tree: tree.path, folder: tree.path }
  }
  const items = Object.entries((await index(host, context))?.items ?? {})
  const uncommitted = worktreeOf(spec)
  const branch = spec.startsWith('branch:') ? spec.slice('branch:'.length) : undefined
  const owner = items.find(
    ([id, item]) =>
      item.state === 'ready' &&
      (uncommitted === undefined
        ? item.branch === branch || Number(id) === conversation
        : Number(id) === uncommitted),
  )
  return owner
    ? { worktree: Number(owner[0]), folder: owner[1].path }
    : { folder: host.projectRoot }
}

/**
 * The branch `branch` lands on: its worktree's target (for a `tree:`, the target of the conversation owning that
 * worktree, whichever branch it has checked out), else the project checkout's branch.
 */
async function target(host: ExtensionHost, branch: string, tree?: string) {
  const owner = tree === undefined ? undefined : await ownerOf(host, tree)
  if (owner) return owner.item.target
  const items = Object.values((await index(host, context))?.items ?? {})
  const owned = items.find((item) => item.branch === branch)
  if (owned) return owned.target
  const checkout = await isolatable(host.projectRoot)
  if ('reason' in checkout) throw new Error(checkout.reason)
  return checkout.target
}

/**
 * What a `branch:<name>` or `tree:<folder>` spec shows once its ref or worktree is gone (it landed and its worktree was
 * removed): its latest landing as `<base>...<tip>`, the commits it submitted against the target they landed on. That is
 * the diff the branch showed just before it landed, so draft comments keep their lines. Without a known landing a
 * branch shows `uncommitted` and a tree its spec, whose diff says it is no worktree; any other spec stays itself.
 */
async function resolve(host: ExtensionHost, spec: string) {
  const path = treePath(spec)
  const branch = spec.startsWith('branch:') ? spec.slice('branch:'.length) : undefined
  if (path === undefined && branch === undefined) return spec
  const present =
    path === undefined
      ? await git(
          host.projectRoot,
          'rev-parse',
          '--verify',
          '--quiet',
          '--end-of-options',
          `refs/heads/${branch}`,
        ).catch(
          // `--quiet` exits 1 for an unknown ref: the branch is gone.
          () => '',
        )
      : await treeOf(host.projectRoot, spec).catch(
          // Not a worktree (any more): its landing, if any, is what is left.
          () => undefined,
        )
  if (present) return spec
  const doc = await index(host, context)
  const owner = Object.entries(doc?.items ?? {}).find(([, item]) =>
    path === undefined ? item.branch === branch : item.path === path,
  )?.[0]
  const landed = Object.values(doc?.results ?? {}).findLast(
    (result) => result.outcome === 'landed' && String(result.conversationId) === owner,
  )
  if (landed?.base) return `${landed.base}...${landed.tip}`
  // Past the index's latest outcomes, the landing event: what the target gained, merged with what landed meanwhile.
  const [event] = await host.eventLog
    .recent({ events: [SubmissionLanded], limit: 200 })
    .then((landings) => landings.filter(({ data }) => String(data.conversationId) === owner))
  if (event) return `${event.data.base}...${event.data.sha}`
  return path === undefined ? 'uncommitted' : spec
}

/**
 * When the worktree at `path` was last worked in, in seconds: its index's modification time, which Git updates on
 * every add, checkout and commit (and status refresh); 0 when it cannot be read.
 */
async function touched(path: string) {
  // A linked worktree's `.git` is a file naming its git dir; the main worktree's is the git dir itself.
  const link = await readFile(join(path, '.git'), 'utf8').catch(
    // A directory (or unreadable): the main worktree's own git dir.
    () => '',
  )
  const gitdir = /^gitdir: (.+)$/m.exec(link)?.[1] ?? '.git'
  const info = await stat(resolvePath(path, gitdir, 'index')).catch(
    // No index yet: never worked in.
    () => undefined,
  )
  return info ? info.mtimeMs / 1000 : 0
}

/**
 * The repository's other worktrees on a branch, newest work first (at most ten): neither the project checkout nor a
 * conversation's worktree, which the list offers already, nor a detached one such as a lander's.
 */
async function otherTrees(host: ExtensionHost, known: Set<string>): Promise<ReviewRange[]> {
  const [trees, checkout, tips] = await Promise.all([
    worktrees(host.projectRoot),
    git(host.projectRoot, 'rev-parse', '--show-toplevel'),
    git(
      host.projectRoot,
      'for-each-ref',
      '--format=%(refname:short)%09%(committerdate:unix)',
      'refs/heads/',
    ),
  ]).catch(
    // No repository: there are no worktrees to offer.
    () => [[], '', ''] as const,
  )
  const committed = new Map(tips.split('\n').map((line) => line.split('\t') as [string, string]))
  const others = trees.filter(
    (tree) => tree.branch && tree.path !== checkout && !known.has(tree.path),
  )
  const dated = await Promise.all(
    others.map(async (tree) => ({
      ...tree,
      at: Math.max(await touched(tree.path), Number(committed.get(tree.branch ?? '')) || 0),
    })),
  )
  return dated
    .toSorted((a, b) => b.at - a.at)
    .slice(0, 10)
    .map((tree) => {
      const spec = treeSpec(tree.path)
      return {
        spec,
        group: 'Trees' as const,
        label: `${tree.branch} · ${spec.slice('tree:'.length)}`,
        detail: tree.at ? ago(tree.at) : undefined,
      }
    })
}

/** A git or landing time in seconds, as the range list shows it. */
const ago = (seconds: number) => formatAgo(seconds * 1000)

async function ranges(host: ExtensionHost): Promise<ReviewRange[]> {
  const cwd = host.projectRoot
  const items = Object.entries((await index(host, context))?.items ?? {})
  const titles = new Map(host.conversations().map((item) => [item.id, item.title]))
  const owner = new Map(
    items
      .filter(([, item]) => item.state !== 'removed')
      .map(([id, item]) => [item.branch, Number(id)]),
  )
  const ready = items.filter(([, item]) => item.state === 'ready').toSorted(([a], [b]) => +b - +a)
  const [branches, commits, landings, edits, trees] = await Promise.all([
    git(
      cwd,
      'for-each-ref',
      '--sort=-committerdate',
      '--count=20',
      '--format=%(refname:short)%09%(committerdate:unix)',
      'refs/heads/ultimate/',
    ).catch(
      // No repository: the selector offers free entry only.
      () => '',
    ),
    git(cwd, 'log', '-n', '15', '--format=%H%x09%ct%x09%s').catch(
      // No commit yet: nothing to list.
      () => '',
    ),
    host.eventLog.recent({ events: [SubmissionLanded], limit: 50 }),
    Promise.all(
      ready.map(([id, item]) =>
        git(item.path, 'status', '--porcelain').then(
          (status) => ({ id: Number(id), files: status.split('\n').filter(Boolean).length }),
          // A worktree Git cannot read has nothing to list.
          () => ({ id: Number(id), files: 0 }),
        ),
      ),
    ),
    otherTrees(host, new Set(items.map(([, item]) => item.path))),
  ])
  const list: ReviewRange[] = [
    { spec: 'uncommitted', group: 'Working tree', label: 'Uncommitted changes' },
  ]
  for (const { id, files } of edits) {
    if (files === 0) continue
    list.push({
      spec: `uncommitted:${id}`,
      group: 'Working tree',
      label: `Uncommitted in #${id} ${titles.get(id) ?? ''}`.trim(),
      detail: `${files} file${files === 1 ? '' : 's'}`,
      conversation: id,
    })
  }
  list.push(...trees)
  for (const line of branches.split('\n').filter(Boolean)) {
    const [branch, at] = line.split('\t') as [string, string]
    const id = owner.get(branch)
    // Only branches of a live worktree: a landed and removed one has nothing left to review.
    if (id === undefined) continue
    list.push({
      spec: `branch:${branch}`,
      group: 'Branches',
      label: titles.get(id) ?? `#${id}`,
      detail: `#${id} · ${ago(Number(at))}`,
      conversation: id,
    })
  }
  for (const { data, at } of landings)
    list.push({
      spec: `${data.base}...${data.sha}`,
      group: 'Landings',
      label: data.feature ? `${data.feature} · ${data.title}` : data.title || data.sha.slice(0, 7),
      detail: `${data.sha.slice(0, 7)} · ${data.commitCount} commit${data.commitCount === 1 ? '' : 's'} · ${ago(Date.parse(at) / 1000)}`,
      conversation: data.conversationId,
    })
  for (const line of commits.split('\n').filter(Boolean)) {
    const [sha, at, subject] = line.split('\t') as [string, string, string]
    list.push({
      spec: sha,
      group: 'Commits',
      label: subject,
      detail: `${sha.slice(0, 7)} · ${ago(Number(at))}`,
    })
  }
  return list
}

/** What conversation `id` changed, as of now: see `ResolveAction`. */
async function reviewOf(host: ExtensionHost, id: number): Promise<ReviewOf | null> {
  const item = (await index(host, context))?.items[String(id)]
  if (item?.state === 'ready') {
    // HEAD, not the worktree's own branch: the conversation may have checked out another one to work on.
    const [ahead, status] = await Promise.all([
      git(item.path, 'rev-parse', 'HEAD')
        .then((head) => forkPoint(item.path, item.target, head))
        .then(({ base }) => git(item.path, 'rev-list', '--count', `${base}..HEAD`, '--')),
      git(item.path, 'status', '--porcelain'),
    ]).catch(
      // A worktree Git cannot read has nothing to show; its landings still may.
      () => ['0', ''],
    )
    if (Number(ahead) > 0 || status.trim()) return { spec: treeSpec(item.path), kind: 'tree' }
  }
  const landings = await host.eventLog.recent({ events: [SubmissionLanded], limit: 200 })
  const landed = landings.find(({ data }) => data.conversationId === id)?.data
  return landed ? { spec: `${landed.base}...${landed.sha}`, kind: 'landed', sha: landed.sha } : null
}

/** The conversation of an `uncommitted:<id>` spec, else undefined. */
const worktreeOf = (spec: string) => {
  const id = /^uncommitted:([1-9]\d*)$/.exec(spec.trim())?.[1]
  return id === undefined ? undefined : Number(id)
}

const known = (host: ExtensionHost, id: number) =>
  host.conversations().some((conversation) => conversation.id === id)

/** Who a review of `spec` goes to unless the user picks another: see `RecipientAction`. */
async function recipient(host: ExtensionHost, spec: string): Promise<number> {
  const owner = async () => {
    const worktree = worktreeOf(spec)
    if (worktree !== undefined) return worktree
    const path = treePath(spec)
    if (path !== undefined) {
      const tree = await treeOf(host.projectRoot, spec).catch(
        // Gone: a landed conversation's worktree is still named by its stored folder below.
        () => undefined,
      )
      if (tree) return (await ownerOf(host, tree.path))?.id
      const items = Object.entries((await index(host, context))?.items ?? {})
      return Number(items.find(([, item]) => item.path === path)?.[0]) || undefined
    }
    if (spec.startsWith('branch:')) {
      const branch = spec.slice('branch:'.length)
      const items = Object.entries((await index(host, context))?.items ?? {})
      return Number(items.find(([, item]) => item.branch === branch)?.[0]) || undefined
    }
    const range = /^[^.]+\.\.\.([^.]+)$/.exec(spec)
    if (range) {
      const landings = await host.eventLog.recent({ events: [SubmissionLanded], limit: 200 })
      const sha = await git(
        host.projectRoot,
        'rev-parse',
        '--verify',
        '--quiet',
        '--end-of-options',
        `${range[1]}^{commit}`,
      )
      return landings.find(({ data }) => data.sha === sha)?.data.conversationId
    }
    if (spec === 'uncommitted' || spec.startsWith('-')) return undefined
    const trailer = await git(
      host.projectRoot,
      'log',
      '-1',
      '--format=%(trailers:key=Ultimate-Conversation,valueonly)',
      '--end-of-options',
      spec,
    )
    return Number(trailer.split('\n')[0]) || undefined
  }
  const found = await owner().catch(
    // An unknown ref or a missing repository has no owner: the review goes to the primary agent.
    () => undefined,
  )
  if (found !== undefined && known(host, found)) return found
  return host.need(SubagentsApi).standing('ultimate', context)
}

export const userActions = ['send', 'open']

export const actions = {
  diff: implementAction(DiffAction, async (args, { host, signal }) => {
    const input = args && typeof args === 'object' && !Array.isArray(args) ? args : {}
    if (typeof input.spec !== 'string') throw new Error('Expected { spec }')
    // `uncommitted:<id>` names a worktree's uncommitted changes: the same diff, run in that checkout.
    const worktree = worktreeOf(input.spec)
    const shown = worktree === undefined ? await resolve(host, input.spec.trim()) : 'uncommitted'
    const diff = await reviewDiff(await where(host, worktree ?? input.conversation), shown, {
      target: (branch, tree) => target(host, branch, tree),
      signal,
    })
    const open = await openIn(host, input.spec, input.conversation)
    const folders = {
      worktree: open.worktree === undefined && open.tree === undefined ? undefined : open.folder,
      checkout: host.projectRoot,
    }
    const files = await Promise.all(
      diff.files.map(async (file) => ({
        ...file,
        opens: await locate(folders, file.path),
        // The work tree is no commit: what Git has of an uncommitted file is its base's version.
        rev: diff.head && file.status !== 'deleted' ? diff.head : diff.base,
      })),
    )
    const opened = {
      ...diff,
      files,
      ...(open.worktree !== undefined && { worktree: open.worktree }),
      ...(open.tree !== undefined && { tree: open.tree }),
    }
    if (worktree !== undefined)
      return { ...opened, spec: input.spec, title: `Uncommitted changes in #${worktree}` }
    // A landed branch keeps its spec on screen, and so its drafts; one gone without a landing moves on to `shown`.
    return shown === 'uncommitted' ? opened : { ...opened, spec: input.spec }
  }),
  open: implementAction(OpenAction, async (args, { host }) => {
    const input = args && typeof args === 'object' && !Array.isArray(args) ? args : {}
    if (typeof input.file !== 'string') throw new Error('Expected { file }')
    if (input.line !== undefined && typeof input.line !== 'number')
      throw new Error('line must be a positive line number')
    if (input.tree !== undefined && typeof input.tree !== 'string')
      throw new Error('tree must be a worktree folder')
    // A worktree removed since the diff loaded: the file opens from the checkout or a copy instead.
    const worktree =
      input.tree !== undefined
        ? (
            await treeOf(host.projectRoot, `tree:${input.tree}`).catch(
              // Not a worktree of the repository (any more): the checkout or a copy instead.
              () => undefined,
            )
          )?.path
        : input.worktree === undefined
          ? undefined
          : await readyWorktree(host, input.worktree)
    const opens = await locate({ worktree, checkout: host.projectRoot }, input.file)
    const folder =
      opens === 'copy'
        ? await copyOf(host.projectRoot, input.rev, input.file)
        : opens === 'worktree' && worktree
          ? worktree
          : host.projectRoot
    const { editor } = await host.need(LineageApi).openEditor(folder, input.file, input.line)
    return { editor, opens }
  }),
  ranges: implementAction(RangesAction, (_args, { host }) => ranges(host)),
  resolve: implementAction(ResolveAction, async (args, { host }) => {
    const id =
      args && typeof args === 'object' && !Array.isArray(args) ? args.conversation : undefined
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1)
      throw new Error('conversation must be a conversation id')
    return reviewOf(host, id)
  }),
  recipient: implementAction(RecipientAction, async (args, { host }) => {
    const spec = args && typeof args === 'object' && !Array.isArray(args) ? args.spec : undefined
    if (typeof spec !== 'string') throw new Error('Expected { spec }')
    return { conversation: await recipient(host, spec) }
  }),
  send: implementAction(SendAction, async (args, { host, device }) => {
    const id =
      args && typeof args === 'object' && !Array.isArray(args) ? args.conversation : undefined
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || !known(host, id))
      throw new Error('conversation must be an existing conversation id')
    const review = checkReview(args)
    const conversation = await host.harness().conversation(id as ConversationId, context)
    if (!conversation) throw new Error(`No conversation #${id}`)
    const content = reviewText(review)
    const submission = await conversation.submit(
      {
        type: 'input',
        content,
        entry: { kind: ReviewCommentsEntry.kind, data: review },
        // A review is the user's input: it steers a busy recipient as a message typed into it would.
        whenBusy: 'steer',
      },
      context,
    )
    // In a commit of its own right after the input's, which Pi admits with no hook: a crash in between loses it.
    const admitted = await submission.status(context)
    await host.harness().commit(
      (tx) =>
        host.emit(tx, UserInputEvent, {
          conversation: id,
          kind: 'review',
          ...(admitted.entry === undefined
            ? { submission: submission.id }
            : { entry: admitted.entry }),
          length: content.length,
          ...device,
        }),
      context,
    )
    return { conversation: id }
  }),
}

export default { name: 'review' }
