import type { EntryRecord } from '@earendil-works/pi-durable'
import { cn } from 'cn'
import { ChevronRightIcon, ChevronsDownUpIcon } from 'lucide-react'
import { useSyncExternalStore } from 'react'

/** Where a collapsed message is remembered in this browser: `ultimate.collapse.<conversation>.<entry>`. */
export const collapseKey = (entry: EntryRecord) =>
  `ultimate.collapse.${entry.conversationId}.${entry.id}`

const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Collapses or expands a message; only collapsed ones are stored. */
export function setCollapsed(entry: EntryRecord, collapsed: boolean) {
  if (collapsed) localStorage.setItem(collapseKey(entry), '1')
  else localStorage.removeItem(collapseKey(entry))
  for (const listener of listeners) listener()
}

/** Whether the reader collapsed this message, kept across reloads. */
export function useCollapsed(entry: EntryRecord | undefined) {
  const read = () => !!entry && localStorage.getItem(collapseKey(entry)) === '1'
  return useSyncExternalStore(subscribe, read, read)
}

/** The button that collapses a message; a hover action like copy. */
export function CollapseButton({ entry, className }: { entry: EntryRecord; className?: string }) {
  return (
    <button
      aria-label="Collapse message"
      className={cn(
        'cursor-pointer rounded p-0.5 transition-colors hover:text-foreground [&_svg]:size-3',
        className,
      )}
      onClick={() => setCollapsed(entry, true)}
      title="Collapse message"
      type="button"
    >
      <ChevronsDownUpIcon />
    </button>
  )
}

/** A collapsed message: one quiet line that expands it again. */
export function Collapsed({ entry, className }: { entry: EntryRecord; className?: string }) {
  return (
    <button
      aria-expanded={false}
      className={cn(
        'flex w-fit cursor-pointer items-center gap-1.5 font-mono text-[11px] text-muted-foreground/70 hover:text-muted-foreground',
        className,
      )}
      data-collapsed={entry.id}
      onClick={() => setCollapsed(entry, false)}
      title="Expand message"
      type="button"
    >
      <ChevronRightIcon className="size-3 shrink-0" />
      Message collapsed
    </button>
  )
}
