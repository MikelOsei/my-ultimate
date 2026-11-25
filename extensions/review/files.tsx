import {
  ChevronDownIcon,
  ChevronRightIcon,
  Columns2Icon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  HexagonIcon,
  MessageSquareIcon,
  Rows3Icon,
} from 'lucide-react'
import { useState } from 'react'
import { DiffStat } from '@/components/ui/diff-stat'
import { InsetCard } from '@/components/ui/inset-card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, formatKeys, ResizeHandle, usePaneWidth, useSystem } from '@/sdk'
import type { ReviewFile } from './refs.ts'

export type Layout = 'split' | 'unified'

const status: Record<ReviewFile['status'], [string, string]> = {
  added: ['A', 'text-diff-add'],
  deleted: ['D', 'text-diff-del'],
  modified: ['M', 'text-muted-foreground'],
  renamed: ['R', 'text-brand'],
  copied: ['C', 'text-brand'],
}

const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1)
const directoryOf = (path: string) => {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? '' : path.slice(0, slash)
}

/**
 * Files by directory, directories in path order and files in diff order within each, and the leading directories
 * every file shares, said once in the root row instead of in each folder.
 */
function byDirectory(files: ReviewFile[]) {
  const groups = [...Map.groupBy(files, (file) => directoryOf(file.path))].toSorted(([a], [b]) =>
    a.localeCompare(b),
  )
  const parts = groups.map(([directory]) => (directory ? directory.split('/') : []))
  let shared = 0
  while (
    parts.length &&
    parts.every((part) => shared < part.length && part[shared] === parts[0][shared])
  )
    shared++
  // Keep one level in each folder row, so no directory loses its row.
  if (parts.some((part) => part.length === shared)) shared = Math.max(0, shared - 1)
  const root = parts[0]?.slice(0, shared).join('/') ?? ''
  return {
    root,
    groups: groups.map(([directory, items]) => ({
      directory,
      label: directory.slice(root ? root.length + 1 : 0),
      items,
    })),
  }
}

/** A path cut at its start, where directories repeat, so its end stays readable. */
function Tail({ path, className }: { path: string; className?: string }) {
  return (
    <span className={cn('min-w-0 truncate [direction:rtl]', className)} title={path}>
      <bdi>{path}</bdi>
    </span>
  )
}

/** A count of draft comments, in the accent colour. */
function Drafted({ count }: { count: number }) {
  return (
    <span
      className="flex shrink-0 items-center gap-0.5 font-mono text-[10.5px] text-brand"
      title={`${count} draft comment${count === 1 ? '' : 's'}`}
    >
      <MessageSquareIcon className="size-2.5" />
      {count}
    </span>
  )
}

/** How the diffs show, icons only; phones always show them unified. */
function LayoutToggle({
  layout,
  onLayout,
}: {
  layout: Layout
  onLayout: (layout: Layout) => void
}) {
  return (
    <span className="flex shrink-0 items-center rounded-md border border-border/70 p-px">
      {(
        [
          ['split', 'Side by side diff', Columns2Icon],
          ['unified', 'Unified diff', Rows3Icon],
        ] as const
      ).map(([name, label, Icon]) => (
        <button
          aria-label={label}
          aria-pressed={layout === name}
          className={cn(
            'flex size-5 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors',
            layout === name ? 'bg-accent text-foreground' : 'hover:text-foreground',
          )}
          key={name}
          onClick={() => onLayout(name)}
          title={label}
          type="button"
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </span>
  )
}

/** The file list's width bounds, like the agent sidebar's. */
export const FILES_WIDTH = { initial: 288, min: 200, max: 560, share: 0.35 }

/** The key held while clicking a file row to open it in the editor instead: ⌘ on macOS, Ctrl elsewhere. */
const mod = formatKeys('mod')[0]?.[0] ?? 'Ctrl'

/**
 * The changed files as a tree in an inset card: a root row with the directories they share, collapsible folders,
 * and each file with its counts and draft comments. A click shows a file's diff, a ⌘-click opens it in the editor.
 */
export function FileList({
  files,
  layout,
  onLayout,
  drafted,
  onPick,
  onOpen,
  editor,
}: {
  files: ReviewFile[]
  layout: Layout
  onLayout: (layout: Layout) => void
  drafted: Map<string, number>
  onPick: (path: string) => void
  onOpen: (file: ReviewFile) => void
  /** The editor `onOpen` opens, as its buttons name it ("VS Code"). */
  editor: string
}) {
  const { root, groups } = byDirectory(files)
  const project = useSystem()?.project.name
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const [picked, setPicked] = useState<string>()
  const [width, setWidth] = usePaneWidth('review-files', FILES_WIDTH)
  const toggle = (directory: string) =>
    setClosed((now) => {
      const next = new Set(now)
      if (!next.delete(directory)) next.add(directory)
      return next
    })
  const all = closed.size === groups.length
  const total = files.reduce(
    (sum, file) => ({
      additions: sum.additions + file.additions,
      deletions: sum.deletions + file.deletions,
    }),
    { additions: 0, deletions: 0 },
  )
  const chevron = (shut: boolean) => (
    <ChevronRightIcon
      className={cn('size-3 shrink-0 opacity-70 transition-transform', !shut && 'rotate-90')}
    />
  )
  return (
    <InsetCard
      as="nav"
      aria-label="Changed files"
      className="relative my-2 ml-2 flex shrink-0 flex-col"
      style={{ width }}
    >
      <ResizeHandle
        className="pointer-coarse:hidden"
        edge="right"
        label="file list"
        onReset={() => setWidth(undefined)}
        onResize={setWidth}
      />
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border/70 px-3 font-mono text-[11px] text-muted-foreground">
        <span className="shrink-0 text-foreground/85">Files</span>
        <span className="shrink-0 text-muted-foreground/70">{files.length}</span>
        <DiffStat className="text-[10.5px]" hideZero {...total} />
        <span className="ml-auto flex shrink-0 items-center">
          <LayoutToggle layout={layout} onLayout={onLayout} />
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-b-xl px-1.5 py-1.5 font-mono">
        <button
          aria-expanded={!all}
          className="flex h-6 w-full cursor-pointer items-center gap-1.5 rounded-md px-1 text-left text-[11.5px] text-foreground/85 hover:bg-accent/50"
          onClick={() =>
            setClosed(all ? new Set() : new Set(groups.map((group) => group.directory)))
          }
          title={all ? 'Expand all folders' : 'Collapse all folders'}
          type="button"
        >
          {chevron(all)}
          <HexagonIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <Tail path={[project, root].filter(Boolean).join('/') || '/'} />
        </button>
        {/* The indent guide: a thin line down from each chevron, under what it opens. */}
        <div className="ml-2.5 border-l border-border">
          {groups.map(({ directory, label, items }) => {
            const shut = closed.has(directory)
            const comments = items.reduce((sum, file) => sum + (drafted.get(file.path) ?? 0), 0)
            const Folder = shut ? FolderIcon : FolderOpenIcon
            return (
              <div key={directory}>
                {label && (
                  <button
                    aria-expanded={!shut}
                    className="flex h-6 w-full cursor-pointer items-center gap-1.5 rounded-md px-1 text-left text-[11.5px] text-foreground/80 hover:bg-accent/50 hover:text-foreground"
                    onClick={() => toggle(directory)}
                    type="button"
                  >
                    {chevron(shut)}
                    <Folder className="size-3.5 shrink-0 fill-brand/25 text-brand" />
                    <Tail path={label} />
                    {shut && (
                      <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-1 text-[10.5px]">
                        {comments > 0 && <Drafted count={comments} />}
                        <span className="text-muted-foreground/60">{items.length}</span>
                      </span>
                    )}
                  </button>
                )}
                {!shut && (
                  <div className={cn(label && 'ml-2.5')}>
                    {items.map((file, index) => {
                      const [letter, tone] = status[file.status]
                      const count = drafted.get(file.path) ?? 0
                      const selected = picked === file.path
                      const last = index === items.length - 1
                      return (
                        <button
                          aria-current={selected || undefined}
                          className={cn(
                            'relative flex h-6 w-full cursor-pointer items-center gap-1.5 rounded-r-md pr-1.5 pl-4 text-left',
                            selected ? 'bg-brand/12' : 'hover:bg-accent/60',
                          )}
                          key={file.path}
                          onClick={(event) => {
                            if (event.metaKey || event.ctrlKey) return onOpen(file)
                            setPicked(file.path)
                            onPick(file.path)
                          }}
                          title={`${file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}\n${mod}-click to open in ${editor}`}
                          type="button"
                        >
                          {label && (
                            <span
                              aria-hidden
                              className={cn(
                                'absolute top-0 -left-px w-2 border-l border-border',
                                last ? 'h-1/2 rounded-bl-sm border-b' : 'h-full',
                              )}
                            />
                          )}
                          {selected && (
                            <span
                              aria-hidden
                              className="absolute top-0 -left-px h-1/2 w-2.5 rounded-bl-sm border-b-2 border-l-2 border-brand"
                            />
                          )}
                          <FileIcon
                            className={cn(
                              'size-3.5 shrink-0',
                              selected ? 'text-brand' : 'text-muted-foreground/70',
                            )}
                          />
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-[11.5px]',
                              selected ? 'text-foreground' : 'text-foreground/90',
                            )}
                          >
                            {fileName(file.path)}
                          </span>
                          {file.status !== 'modified' && (
                            <span
                              className={cn('shrink-0 font-mono text-[10px]', tone)}
                              title={file.status}
                            >
                              {letter}
                            </span>
                          )}
                          {count > 0 && <Drafted count={count} />}
                          {file.binary ? (
                            <span className="shrink-0 text-[10.5px] text-muted-foreground">
                              bin
                            </span>
                          ) : (
                            <DiffStat
                              additions={file.additions}
                              className="text-[10.5px]"
                              deletions={file.deletions}
                              hideZero
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </InsetCard>
  )
}

/** The file list as a dropdown, on a phone. */
export function FileMenu({
  files,
  onPick,
}: {
  files: ReviewFile[]
  onPick: (path: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-8 w-full shrink-0 cursor-pointer items-center gap-1.5 border-b border-border/70 bg-sidebar px-3 font-mono text-[12px] text-muted-foreground">
        {files.length} file{files.length === 1 ? '' : 's'}
        <ChevronDownIcon className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[60vh] w-[calc(100vw-1rem)] overflow-y-auto"
      >
        {files.map((file) => (
          <DropdownMenuItem
            className="gap-2 font-mono text-[12px]"
            key={file.path}
            onSelect={() => onPick(file.path)}
          >
            <span className={cn('w-2.5 shrink-0 text-[10.5px]', status[file.status][1])}>
              {file.status !== 'modified' && status[file.status][0]}
            </span>
            <span className="flex min-w-0 flex-1 items-baseline gap-2" title={file.path}>
              <span className="shrink-0">{fileName(file.path)}</span>
              <Tail className="text-[11px] text-muted-foreground" path={directoryOf(file.path)} />
            </span>
            <DiffStat
              additions={file.additions}
              className="text-[10.5px]"
              deletions={file.deletions}
              hideZero
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
