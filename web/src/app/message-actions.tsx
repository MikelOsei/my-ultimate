import type { EntryRecord } from '@earendil-works/pi-durable'
import { cn } from 'cn'
import { CheckIcon, CopyIcon, LinkIcon, ReplyIcon } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { events } from '../sdk/events.ts'
import { formatTime } from '../sdk/format.ts'
import { useConversation, useCopy, useExtensions } from '../sdk/hooks.ts'
import { messageItems } from '../sdk/registry.ts'
import { MessageReference } from '../sdk/types.ts'
import { ExtensionBoundary, Provided } from './boundary.tsx'
import { CollapseButton } from './collapse.tsx'
import { excerptOf, selectionEnd } from './reply.ts'

/**
 * Hover actions on a stored message, always shown on touch screens: extensions' details (`messageDetails`), its time,
 * and copies of its text or of a reference another conversation can follow, around extensions' `messageActions`.
 * `entry` is the message they act on, such as the one going back returns to. They show while the nearest
 * `group/message` is hovered, or `group/bubble` with `bubble`, for a card nested inside another message. `replyable`
 * offers to reply to the message from the composer; `collapsible` ends the row with the button that collapses it.
 */
export function MessageActions({
  entry,
  text,
  timestamp,
  className,
  bubble = false,
  replyable = false,
  collapsible = false,
}: {
  entry: EntryRecord
  text: string
  timestamp: number
  className?: string
  bubble?: boolean
  replyable?: boolean
  collapsible?: boolean
}) {
  const extensions = useExtensions()
  const details = messageItems(extensions, 'messageDetails')
  const contributions = messageItems(extensions, 'messageActions')
  const { conversationId: conversation, id } = entry
  const date = new Date(timestamp)
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground/60 opacity-0 transition-opacity focus-within:opacity-100 pointer-coarse:opacity-100',
        bubble ? 'group-hover/bubble:opacity-100' : 'group-hover/message:opacity-100',
        className,
      )}
      data-message-actions={id}
    >
      {details.map(({ key, extension, version, component: Detail }) => (
        <ExtensionBoundary extension={extension} fallback={null} key={key} version={version}>
          <Detail entry={entry} />
        </ExtensionBoundary>
      ))}
      <time className="tabular-nums" dateTime={date.toISOString()} title={date.toLocaleString()}>
        {formatTime(date)}
      </time>
      {text && replyable && <ReplyButton entry={entry} text={text} />}
      {text && (
        <CopyButton label="Copy message" value={text}>
          <CopyIcon />
        </CopyButton>
      )}
      {contributions.map(({ key, extension, version, component: Action }) => (
        <ExtensionBoundary extension={extension} fallback={null} key={key} version={version}>
          <Action entry={entry} />
        </ExtensionBoundary>
      ))}
      <Provided input={{ conversation, id }} point={MessageReference}>
        {(reference) =>
          reference && (
            <CopyButton label={`Copy reference to message #${id}`} value={reference}>
              <LinkIcon />
            </CopyButton>
          )
        }
      </Provided>
      {collapsible && <CollapseButton entry={entry} />}
    </div>
  )
}

const messages = '[data-ui="message-card"], [data-from]'

/** The words selected inside `message` when it is the nearest message around both ends of the selection, else ''. */
function selectedIn(message: Element | null) {
  const selection = window.getSelection()
  if (!message || !selection || selection.isCollapsed) return ''
  const owner = (node: Node | null) =>
    (node instanceof Element ? node : node?.parentElement)?.closest(messages)
  return owner(selection.anchorNode) === message && owner(selection.focusNode) === message
    ? selection.toString()
    : ''
}

/**
 * Replies to the message from its conversation's composer, quoting the words selected inside it, or else its first line.
 * The selection is read on press, before the click can clear it. While words inside the message are selected, a second
 * Reply floats just above the end of the selection.
 */
function ReplyButton({ entry, text }: { entry: EntryRecord; text: string }) {
  // The shown conversation's composer: a fork's history also shows entries its parent stored.
  const conversation = useConversation((shown) => shown.id)
  const selected = useRef('')
  const button = useRef<HTMLButtonElement>(null)
  const reply = (words: string) => {
    if (conversation === undefined) return
    events.emit('ultimate:reply', {
      conversationId: conversation,
      reply: { id: entry.id, excerpt: excerptOf(text, words) },
    })
  }
  return (
    <>
      <button
        aria-label="Reply to message"
        className="cursor-pointer rounded p-0.5 transition-colors hover:text-foreground [&_svg]:size-3"
        onClick={() => {
          reply(selected.current)
          selected.current = ''
        }}
        onPointerDown={(event) => {
          selected.current = selectedIn(event.currentTarget.closest(messages))
        }}
        ref={button}
        title="Reply to message"
        type="button"
      >
        <ReplyIcon />
      </button>
      <SelectionReply message={() => button.current?.closest(messages) ?? null} onReply={reply} />
    </>
  )
}

/**
 * The Reply that floats above the last selected character of `message` once a selection inside it is made, following it
 * on scroll and resize. It hides while the pointer is still selecting, and when the selection collapses or leaves.
 */
function SelectionReply({
  message,
  onReply,
}: {
  message: () => Element | null
  onReply: (selected: string) => void
}) {
  const [shown, setShown] = useState<{ selected: string; left: number; top: number }>()
  const floating = useRef<HTMLButtonElement>(null)
  const read = useEffectEvent(() => {
    const selected = selectedIn(message())
    const end = selected
      ? selectionEnd(window.getSelection()!.getRangeAt(0).getClientRects())
      : undefined
    setShown(end && { selected, ...end })
  })
  useEffect(() => {
    let selecting = false
    const update = () => {
      if (!selecting) read()
    }
    const press = (event: PointerEvent) => {
      if (floating.current?.contains(event.target as Node)) return
      selecting = true
      setShown(undefined)
    }
    const release = () => {
      selecting = false
      update()
    }
    document.addEventListener('selectionchange', update)
    document.addEventListener('pointerdown', press)
    document.addEventListener('pointerup', release)
    return () => {
      document.removeEventListener('selectionchange', update)
      document.removeEventListener('pointerdown', press)
      document.removeEventListener('pointerup', release)
    }
  }, [])
  const visible = shown !== undefined
  useEffect(() => {
    if (!visible) return undefined
    const update = () => read()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [visible])
  if (!shown) return null
  return createPortal(
    <button
      aria-label="Reply to selection"
      className="fixed z-50 flex -translate-x-1/2 -translate-y-full cursor-pointer items-center gap-1 rounded-md border bg-popover px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground shadow-sm transition-colors hover:text-foreground [&_svg]:size-3"
      data-selection-reply=""
      onClick={() => {
        onReply(shown.selected)
        setShown(undefined)
      }}
      // Keep the selection: a press on the button would otherwise clear it.
      onMouseDown={(event) => event.preventDefault()}
      ref={floating}
      style={{ left: shown.left, top: shown.top - 4 }}
      title="Reply to selection"
      type="button"
    >
      <ReplyIcon />
      Reply
    </button>,
    document.body,
  )
}

function CopyButton({
  value,
  label,
  children,
}: {
  value: string
  label: string
  children: ReactNode
}) {
  const { copied, copy } = useCopy()
  return (
    <button
      aria-label={label}
      className="cursor-pointer rounded p-0.5 transition-colors hover:text-foreground [&_svg]:size-3"
      onClick={() => copy(value)}
      title={label}
      type="button"
    >
      {copied ? <CheckIcon className="text-success" /> : children}
    </button>
  )
}
