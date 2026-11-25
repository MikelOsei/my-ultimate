import { MessageCircleQuestionIcon } from 'lucide-react'
import { cn, useDocOf, useUltimate } from '@/sdk'
import { Address, MessagesDoc, emptyMessages, useAccentOf } from '../messages/ui.tsx'
import { waiting } from '../questions/ui.tsx'
import { gist, useOpenQuestion } from './panel.tsx'
import type { Asked } from './panel.tsx'

/** Chips shown at most; the rest are counted and open the To-dos tab. */
const shown = 3

/**
 * One line above the composer while questions wait on the user, from any conversation: a chip per question, newest
 * first, that opens its conversation at the card. Too narrow for chips (a phone), it is one count that opens the
 * To-dos tab. It disappears with the last answer or dismissal.
 */
export function WaitingStrip() {
  const asked = waiting((useDocOf(1, MessagesDoc) ?? emptyMessages).messages)
  const { openPanel } = useUltimate()
  if (!asked.length) return null
  const rest = asked.length - shown
  return (
    <div className="@container mb-1.5 font-mono text-[11px] whitespace-nowrap" data-waiting-strip>
      <button
        className="flex cursor-pointer items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground @md:hidden"
        onClick={() => openPanel('todos')}
        type="button"
      >
        <MessageCircleQuestionIcon className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
        {asked.length} waiting on you
      </button>
      <div className="flex min-w-0 items-center gap-1.5 overflow-hidden @max-md:hidden">
        <span className="shrink-0 pr-0.5 text-muted-foreground/70">waiting on you</span>
        {asked.slice(0, shown).map((message) => (
          <Chip key={message.id} message={message} />
        ))}
        {rest > 0 && (
          <button
            className="shrink-0 cursor-pointer rounded-full px-1.5 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => openPanel('todos')}
            title="Show every open question"
            type="button"
          >
            +{rest}
          </button>
        )}
      </div>
    </div>
  )
}

function Chip({ message }: { message: Asked }) {
  const open = useOpenQuestion()
  const accent = useAccentOf(message.from)
  const text = message.questions?.[0]?.text ?? gist(message.text)
  const local = typeof message.from === 'number'
  return (
    <button
      className="flex min-w-0 max-w-72 shrink cursor-pointer items-center gap-1.5 rounded-full border border-border/70 bg-card px-2 py-0.5 text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:cursor-default"
      data-waiting-chip={message.id}
      disabled={!local}
      onClick={() => open(message)}
      title={local ? `${text}\nAnswer in #${message.from}` : text}
      type="button"
    >
      <MessageCircleQuestionIcon className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className={cn('flex shrink-0 font-semibold', accent.name)}>
        <Address id={message.from} remote={message.remote} />
      </span>
      <span className="min-w-0 truncate">{text}</span>
    </button>
  )
}
