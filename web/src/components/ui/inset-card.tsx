import { cn } from 'cn'
import { createElement } from 'react'
import type { ComponentProps } from 'react'

/** An inset card, one shade lighter than the pane, as the composer sits in the agent pane. */
export function InsetCard<T extends 'div' | 'nav' | 'form' = 'div'>({
  as,
  className,
  ...props
}: ComponentProps<T> & { as?: T }) {
  return createElement(as ?? 'div', {
    ...props,
    className: cn('rounded-xl border border-input/80 bg-card shadow-sm', className),
  })
}
