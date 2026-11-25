import { cn } from 'cn'
import type { ReactNode } from 'react'

/**
 * Label/value rows with aligned values, as the Info panel shows them. They follow their own width, not the window's:
 * below 18rem a value's parts wrap onto the next line instead of overlapping, and below 13rem each label sits above
 * its value.
 */
export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="@container">
      <dl
        className={cn(
          'grid grid-cols-[5.25rem_minmax(0,1fr)] gap-x-3 gap-y-[3px] font-mono text-[11.5px] leading-[1.5] @max-[13rem]:grid-cols-1 @max-[13rem]:gap-y-0',
          className,
        )}
      >
        {children}
      </dl>
    </div>
  )
}

/** One muted label and its value. */
export function Row({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <>
      <dt className="truncate text-muted-foreground/70 @max-[13rem]:not-first:pt-1.5">{label}</dt>
      <dd
        className={cn(
          'flex min-w-0 items-center gap-1.5 text-foreground/85 @max-[18rem]:flex-wrap @max-[18rem]:gap-y-0',
          className,
        )}
      >
        {children}
      </dd>
    </>
  )
}
