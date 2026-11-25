/** Review in the browser: the local diff of a spec, and the specs worth choosing from. Browser-safe. */
import { actionRef } from '../../shared/extension-api.ts'
import type { ReviewComment } from './types.ts'

/**
 * What to review, as text: `uncommitted` (the work tree against `HEAD`, untracked files included; `uncommitted:<id>`
 * in conversation `id`'s worktree), a commit (`<sha>`
 * or any ref naming one), a range `<a>...<b>` (what `b` changed since it forked from `a`, as a landing's
 * `<base>...<sha>`), `branch:<name>` (the branch against the target branch it lands on), or `tree:<folder>` (all the
 * work in that worktree of the repository: its commits since it forked from the target and its uncommitted changes).
 * Branches and trees fork from the target, or from its upstream when that one is newer.
 */
export type ReviewKind = 'uncommitted' | 'commit' | 'range' | 'branch' | 'tree'

/** One changed file. Its hunks are in the diff's `patch` unless it is `binary`, `tooLarge`, `typeChanged` or `symlink`. */
export type ReviewFile = {
  /** The path after the change; the old path for a deleted file. */
  path: string
  /** The path before a rename or copy. */
  oldPath?: string
  status: 'added' | 'deleted' | 'modified' | 'renamed' | 'copied'
  additions: number
  deletions: number
  binary?: boolean
  /** Its patch was over the per-file cap, or past the whole diff's cap: listed, its hunks left out. */
  tooLarge?: boolean
  /** It became a symlink or stopped being one (Git's `T`): listed, its hunks left out. */
  typeChanged?: boolean
  /** A new symlink whose path or target cannot be written as a plain patch line: listed, its hunks left out. */
  symlink?: boolean
  /** Where its Open in … opens it, as of the diff (the `diff` action sets it). */
  opens?: ReviewOpens
  /**
   * The commit holding the diff's version of it, which a `copy` is read from: the new side, or the old side for a
   * deletion and for uncommitted changes (the `diff` action sets it).
   */
  rev?: string
}

/**
 * Where a file opens: the diff's ready `worktree` while the file is there, else the project checkout while it is
 * there, else (deleted, moved away, or an old landing) a read-only copy of it as of its `rev`.
 */
export type ReviewOpens = 'worktree' | 'checkout' | 'copy'

export type ReviewDiff = {
  /** The spec shown: as asked, or where a gone `branch:<name>` moved (its landing's range, else `uncommitted`). */
  spec: string
  kind: ReviewKind
  /** One line naming what is shown: `Uncommitted changes`, a commit's subject, `main...feature`. */
  title: string
  /** The full shas compared, where there are two commits: the merge base (or parent) and the tip. */
  base?: string
  head?: string
  /** `git diff` output of every file that fits, for `parsePatchFiles` of `@pierre/diffs`. */
  patch: string
  files: ReviewFile[]
  /** The diff was bigger than the whole cap: later files are listed without hunks. */
  truncated?: boolean
  /**
   * The conversation whose ready worktree its files open in (an `uncommitted:<id>` or `branch:<name>` spec, or the
   * `conversation` asked); without it, the project checkout.
   */
  worktree?: number
  /** The folder of a `tree:<folder>` spec's worktree, which its files open in. */
  tree?: string
}

/**
 * User only: `{ worktree?, tree?, file, line, rev }` → opens a diff's `file` at `line` (clamped to it) in the editor
 * every "Open in …" button uses, where `ReviewOpens` says, looked up again now: conversation `worktree`'s ready
 * worktree (or the `tree` folder, while it is a worktree of the repository), the project checkout, else a read-only copy of `rev:file` from the project's repository under the OS temp folder
 * (`ultimate-review/<sha>/<file>`). Throws on a path leading out of its folder or a `rev` that is not a full sha of a
 * commit there.
 */
export const OpenAction = actionRef<
  { worktree?: number; tree?: string; file: string; line?: number; rev?: string },
  { editor: string; opens: ReviewOpens }
>('review', 'open')

/** One choice of the range selector. */
export type ReviewRange = {
  spec: string
  group: 'Working tree' | 'Trees' | 'Branches' | 'Landings' | 'Commits'
  /** What it is, in a few words: a branch's conversation title, a landing's feature, a commit's subject. */
  label: string
  /** Quiet meta: a short sha, an age. */
  detail?: string
  /** The conversation behind it: a branch's owner, a landing's submitter. */
  conversation?: number
}

/**
 * `{ spec, conversation? }` → the diff of `spec` in the project's checkout, or in conversation `conversation`'s
 * worktree while it has one. A `branch:<name>` whose ref is gone shows its latest landing, else `uncommitted`, and says
 * so in `spec`. Throws on a spec or ref Git does not know as a commit, and on any part starting with `-`.
 */
export const DiffAction = actionRef<{ spec: string; conversation?: number }, ReviewDiff>(
  'review',
  'diff',
)
/**
 * No arguments → recent specs to choose from: uncommitted, `uncommitted:<id>` of each ready worktree with changes,
 * `tree:<folder>` of the repository's other worktrees on a branch, open `ultimate/*` branches, landings and commits.
 */
export const RangesAction = actionRef<null, ReviewRange[]>('review', 'ranges')

/** What a conversation's changes are now: all the work in its worktree, or its latest landing. */
export type ReviewOf = { spec: string; kind: 'tree' | 'landed'; sha?: string }
/**
 * `{ conversation }` → the spec showing what that conversation changed, as of now: `tree:<folder>` while its ready
 * worktree has commits since it forked or uncommitted changes (whichever branch it has checked out), else its latest
 * landing's `<base>...<sha>`; null when there is nothing (yet). A `conversation:<id>` link opens what this returns.
 */
export const ResolveAction = actionRef<{ conversation: number }, ReviewOf | null>(
  'review',
  'resolve',
)
/**
 * `{ spec }` → the conversation a review of `spec` goes to by default: a branch's owner, a landing's submitter, the
 * conversation a commit's `Ultimate-Conversation` trailer names, else the primary agent's.
 */
export const RecipientAction = actionRef<{ spec: string }, { conversation: number }>(
  'review',
  'recipient',
)
/**
 * User only: `{ conversation, spec, comments, note? }` → one `review.comments` input into `conversation`, which wakes
 * or steers it like a typed message. Throws on an unknown conversation or a review over the limits in comments.ts.
 */
export const SendAction = actionRef<
  { conversation: number; spec: string; comments: ReviewComment[]; note?: string },
  { conversation: number }
>('review', 'send')
