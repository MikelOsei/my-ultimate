import { FileDiffIcon } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { cn, useAction } from '@/sdk'
import { conversationOf, openReview, reviewLink } from './link.tsx'
import type { Request } from './link.tsx'
import { ResolveAction } from './refs.ts'
import { shortSpec } from './selector.tsx'

/**
 * A `/?review=<spec>` link in a message (Markdown keeps only path-relative links) as a chip that opens Review in place: its text, then what it shows in quiet
 * mono (`in progress`, `landed f072d92`, a short spec). A `conversation:<id>` link with nothing to show
 * yet stays a dimmed chip that says so.
 */
export function ReviewChipLink({
  href,
  children,
  core,
}: {
  href: string
  children: ReactNode
  core: ReactNode
}) {
  const link = reviewLink(href)
  return link ? (
    <Chip href={href} link={link}>
      {children}
    </Chip>
  ) : (
    core
  )
}

function Chip({ href, link, children }: { href: string; link: Request; children: ReactNode }) {
  const id = conversationOf(link.spec)
  const resolved = useAction(
    ResolveAction,
    { conversation: id ?? 0 },
    { enabled: id !== undefined },
  )
  const of = resolved.data
  const empty = id !== undefined && !resolved.loading && !resolved.error && of === null
  const detail =
    id === undefined
      ? shortSpec(link.spec)
      : of
        ? of.kind === 'landed'
          ? `landed ${of.sha?.slice(0, 7)}`
          : 'in progress'
        : empty
          ? 'no changes yet'
          : undefined
  const open = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!empty) openReview(link.spec, link.at)
  }
  return (
    <a
      aria-disabled={empty || undefined}
      className={cn(
        'inline-flex max-w-[min(100%,26rem)] min-w-0 items-center gap-1.5 rounded-md border border-border/70 px-1.5 align-bottom font-mono text-[11.5px] leading-5 text-foreground no-underline transition-colors',
        empty ? 'cursor-default opacity-60' : 'hover:bg-accent',
      )}
      data-review-link={link.spec}
      href={href}
      onClick={open}
      title={empty ? `#${id} has no changes to review yet` : `Review ${shortSpec(link.spec)}`}
    >
      <FileDiffIcon className="size-3 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate font-sans text-[12.5px]">{children}</span>
      {detail && <span className="shrink-0 text-muted-foreground">{detail}</span>}
    </a>
  )
}
