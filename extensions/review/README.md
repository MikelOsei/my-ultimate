The Review surface: the project's local Git diffs, its files on the left and their changes on the right, rendered with `@pierre/diffs` in Ultimate's fonts and colours.

What it shows is a **spec**:

- `uncommitted`: the work tree against `HEAD`, untracked files included (ignored ones not). `uncommitted:<id>` is the
  same in conversation `id`'s worktree (the project checkout once it has none); its default recipient is `id`.
- `<sha>` (or any ref naming a commit): that commit against its first parent; a root commit against the empty tree.
- `<a>...<b>`: what `b` changed since it forked from `a`, as a landing's `<base>...<sha>`.
- `branch:<name>`: the branch against the target branch it lands on (its worktree's target, else the project checkout's branch).
- `tree:<folder>`: all the work in a worktree of the project's repository, whichever branch it has checked out: its
  commits since it forked from the target and its uncommitted changes, untracked files included, in one diff. The
  folder is absolute or starts with `~/`, and may be inside the worktree; any folder that is not one of the
  repository's worktrees (`git worktree list`) is refused. A conversation's worktree that is gone shows its latest
  landing, as a gone `branch:` does.

Branches and trees fork from the target, or from its upstream (`origin/main`) when that one is newer: where work
merges through pull requests, the local target can lag far behind. `/?review=conversation:<id>` shows `tree:` of that
conversation's worktree while it has work, else its latest landing.

Each file header's name is a link, with an **Open in …** icon beside it, that opens the file (`open`) in the `editor`
setting's editor at its first changed line (the old side's for a deletion), clamped to the file it opens, for editing by
hand. They are never disabled: the file opens in the diff's ready `worktree` (an `uncommitted:<id>` or
`branch:<name>` spec whose conversation has one, or a `tree:<folder>`'s worktree) while it is there, else in the project checkout while it is there,
else (deleted, moved away, an old landing) as a read-only copy of the diff's version from the project's repository
(the new side's commit, the old side's for a deletion or uncommitted changes) under the OS temp folder,
`ultimate-review/<sha>/<path>`. Each file's `opens` says which, and its tooltip too ("as of `abc1234`, read-only
copy"). In the file list a ⌘-click (Ctrl-click elsewhere) on a file opens it the same way; a plain click scrolls to
its diff.

The header picks the spec (recent choices from `ranges`, or any spec typed in), sums `+N −M · K files`, switches split and
unified, and links the range to DiffsHub when `origin` is on GitHub. Coming back to the window loads the diff again, so
work that went on meanwhile shows. On a phone the file list is a dropdown and the
diff is unified. The diff stack is virtualized; the viewer loads with the surface, not with the app.

**Comments.** Click a line number (shift-click or drag for a range, on either side) or the gutter `+` to open an
inline composer; the range highlights as it grows, with a bar down its line numbers. **Add to review** keeps it as a
draft under its lines, which can be edited or deleted. Drafts are durable UI state (`drafts.ts`) keyed by spec and by
the conversation whose worktree the diff came from (`draftsKey`; a spec too long for a key is named by its SHA-256), so
a reload and other tabs keep them. A draft holds only its lines and text; its excerpt (at most 40 lines and 8 KB) is
read from the diff on screen when the review is sent. One spec's drafts may take 96 KB of the 256 KiB UI state: past
that the composer stays open and says it is too long to keep, and a write the server refuses shows a notice. While any are pending, a footer reads
`N comments pending · + note · Discard · Send review (N)` and the header has a **to** picker (standing agents and
recent conversations). Its default comes from `recipient`. Sending posts one `review.comments` input into that
conversation; the drafts it sent clear (ones added meanwhile stay), and the footer links to it (`Sent to #id`), or
says why it was not sent. The recipient's transcript shows a review card on the user's side (`card.tsx`), each
comment's `file:line` chip opening Review there. The model reads `reviewText` (`comments.ts`):
`Review of \`<spec>\` (N comments)`, the note, then per comment `` `path:start-end`(old|new) ``, a fenced excerpt
(language from the extension) and the text. Paths and specs are inline code delimited by a backtick run longer than any
in them, with control characters such as a newline written as`\n`.

Links: `/?review=<spec>` opens Review at that spec, and the address carries `?review=` while Review is on screen;
`&file=<path>&line=<n>` (and `&side=old`) scrolls to that line and marks it.
`openReview(spec, at?)` from `ui.tsx` does the same from code. Review provides the `workspaces.review` point, so the
landing card, the Activity feed and a root's landed list open a landing's commit count here (DiffsHub stays as a small
↗ beside it), and a branch row's menu has **Review changes**. Without review those stay plain DiffsHub links.

Actions (`refs.ts`):

- `diff { spec, conversation? }` → `{ spec, kind, title, base?, head?, patch, files, truncated?, worktree?, tree? }`, each
  file with where it `opens` and the `rev` of its copy. Runs in
  `conversation`'s worktree while it has one, else the project checkout. Every ref is checked with
  `git rev-parse --verify` as a commit, and any part starting with `-` is refused. A file's patch over 400 KB is listed
  as `tooLarge` without hunks; past 8 MB in all, later files are too and the diff is `truncated` (caps count bytes).
  An untracked symlink shows as a new file whose one line is its target (one with a path git would quote or a
  multi-line target is listed as `symlink`, without hunks); a file that became a symlink or stopped
  being one is listed as `typeChanged`, without hunks.
- `open { worktree?, tree?, file, line?, rev }` (user only) → `{ editor, opens }`: opens `file` as above, looked up
  again at the click; `tree` is the diff's `tree` folder, checked again to be a worktree of the repository. A path leading out of its folder is refused, and `rev` must be the full sha of a commit of the project's
  own repository; lineage's `openEditor` service launches the editor.
- `ranges` → recent specs: uncommitted, under Trees the repository's other worktrees on a branch (not the checkout, a
  conversation's or a detached one), the ten last worked in by their index's or branch tip's time, open `ultimate/*`
  branches with their conversation, the last ten landings
  (`workspaces.landed` events) and the last fifteen commits; branches and landings carry their `conversation`.
- `resolve { conversation }` → what a `conversation:<id>` link opens: `{ spec, kind: 'tree' }` while its worktree has
  work, `{ spec, kind: 'landed', sha }` after it landed, else null.
- `recipient { spec }` → `{ conversation }`: a `branch:` or `tree:` spec's worktree owner, a landing range's submitter (by its
  tip in `workspaces.landed`), a commit's `Ultimate-Conversation` trailer, else the primary agent.
- `send { conversation, spec, comments, note? }` (user only) → `{ conversation }`. At most 50 comments, each text up
  to 4,000 characters and excerpt up to 40 lines and 8 KB, to an existing conversation; it steers a busy one.
