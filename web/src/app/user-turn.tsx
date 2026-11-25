import type { ImageContent, TextContent, UserMessage } from '@earendil-works/pi-ai'
import type { EntryRecord } from '@earendil-works/pi-durable'
import { MentionText, Message, MessageContent } from '@/components/ai/message'
import { MessageResponse } from '@/components/ai/message'
import { Tool, ToolContent, ToolHeader, ToolImage, ToolSection } from '@/components/ai/tool'
import { cn } from 'cn'
import { ReplyIcon } from 'lucide-react'
import { events } from '../sdk/events.ts'
import { useExtensions } from '../sdk/hooks.ts'
import { messageItems } from '../sdk/registry.ts'
import { ExtensionBoundary } from './boundary.tsx'
import { CollapseButton, Collapsed, useCollapsed } from './collapse.tsx'
import { MessageActions } from './message-actions.tsx'
import { replyInput } from './reply.ts'

/** The text blocks of a user message, joined. */
export function textOf(content: string | readonly (TextContent | ImageContent)[]) {
  return typeof content === 'string'
    ? content
    : content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n')
}

/** A `/skill:name args` input as the server expanded it (Pi's `<skill>` block): the skill, its body, and the request. */
export function skillInput(text: string) {
  const match =
    /^<skill name="([^"]+)" location="([^"]+)">\nReferences are relative to [^\n]*\n\n([\s\S]*?)\n<\/skill>(?:\n\n([\s\S]*))?$/.exec(
      text,
    )
  return match
    ? { name: match[1], location: match[2], body: match[3], request: match[4] ?? '' }
    : undefined
}

/** The skill an input ran, folded: its name in the header, its instructions inside. */
function SkillRun({ name, location, body }: { name: string; location: string; body: string }) {
  return (
    <Tool className="bg-background">
      <ToolHeader
        name="skill"
        state="done"
        title={
          <>
            <span className="text-brand">{name}</span>
            <span className="text-muted-foreground/60" title={location}>
              {' '}
              · run by you
            </span>
          </>
        }
      />
      <ToolContent>
        <ToolSection>
          <MessageResponse className="text-[13px]">{body}</MessageResponse>
        </ToolSection>
      </ToolContent>
    </Tool>
  )
}

/** What a reply quoted, one quiet line atop the user's bubble that scrolls back to the message it answers. */
function Quote({ entry, id, excerpt }: { entry: EntryRecord; id: number; excerpt: string }) {
  return (
    <button
      className="-mb-1 flex min-w-0 cursor-pointer items-center gap-1.5 text-left font-mono text-[11px] text-muted-foreground/70 hover:text-muted-foreground"
      data-reply-quote={id}
      onClick={() =>
        events.emit('ultimate:reveal-entry', { conversationId: entry.conversationId, entryId: id })
      }
      title="Show the message this replies to"
      type="button"
    >
      <ReplyIcon className="size-3 shrink-0" />
      <span className="truncate">{excerpt}</span>
    </button>
  )
}

/** The user's words as written, with mentions as chips: the body of every user turn. */
export function UserText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn('break-words whitespace-pre-wrap', className)}>
      <MentionText text={text} />
    </p>
  )
}

/**
 * A turn of the user's: its text as written, with mentions as chips, and its images. `text` replaces the message's own,
 * such as the user's words inside a message an extension delivered.
 */
export function UserView({
  entry,
  message,
  text = textOf(message.content),
}: {
  entry: EntryRecord
  message: UserMessage
  text?: string
}) {
  const images =
    typeof message.content === 'string'
      ? []
      : message.content.filter((block) => block.type === 'image')
  const skill = skillInput(text)
  // A reply's quote leads its words, or a skill's request.
  const request = skill ? skill.request : text
  const reply = replyInput(request)
  const words = reply ? reply.text : request
  const additions = messageItems(useExtensions(), 'userBubble')
  if (useCollapsed(entry)) {
    return (
      <Message className="mt-3 first:mt-0" from="user">
        <Collapsed className="ml-auto" entry={entry} />
      </Message>
    )
  }
  return (
    <Message className="group/message mt-3 first:mt-0" from="user">
      <div className="relative">
        <CollapseButton
          className="absolute -top-2 -right-2 z-10 border border-border/70 bg-background p-1 text-muted-foreground/60 opacity-0 group-hover/message:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
          entry={entry}
        />
        <MessageContent>
          {reply && <Quote entry={entry} excerpt={reply.excerpt} id={reply.id} />}
          {skill && <SkillRun {...skill} />}
          {(!skill || words) && <UserText text={words} />}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((image, index) => (
                // oxlint-disable-next-line react/no-array-index-key -- Fixed message attachments may contain duplicates.
                <ToolImage alt={`Attached image ${index + 1}`} image={image} key={index} />
              ))}
            </div>
          )}
        </MessageContent>
        {additions.map(({ key, extension, version, component: Addition }) => (
          <ExtensionBoundary extension={extension} fallback={null} key={key} version={version}>
            <Addition entry={entry} />
          </ExtensionBoundary>
        ))}
      </div>
      <MessageActions
        className="-mt-1 justify-end"
        entry={entry}
        text={reply ? words : text}
        timestamp={message.timestamp}
      />
    </Message>
  )
}
