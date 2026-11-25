import { cn } from 'cn'

/** `+3 −1`, optionally leaving out a side with no lines. Size comes from the caller. */
export function DiffStat({
  additions,
  deletions,
  hideZero = false,
  className,
}: {
  additions: number
  deletions: number
  hideZero?: boolean
  className?: string
}) {
  const add = !hideZero || additions > 0
  const del = !hideZero || deletions > 0
  return (
    <span className={cn('shrink-0 font-mono tabular-nums', className)}>
      {add && <span className="text-diff-add">+{additions}</span>}
      {add && del && ' '}
      {del && <span className="text-diff-del">−{deletions}</span>}
    </span>
  )
}
