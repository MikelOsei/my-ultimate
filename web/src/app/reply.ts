/** The message a draft replies to: its entry in the conversation and the words quoted from it. */
export type Reply = { id: number; excerpt: string }

const longest = 80

/**
 * What a reply quotes from message `text`, on one line cut at 80 characters: the words selected in it, or else its first
 * non-empty line.
 */
export function excerptOf(text: string, selection = '') {
  const quoted = selection.trim() || text.split('\n').find((line) => line.trim()) || ''
  const line = quoted.replace(/\s+/g, ' ').trim()
  return line.length > longest ? `${line.slice(0, longest - 1).trimEnd()}…` : line
}

/**
 * Where a selection's last highlighted character ends, from its range's client rects: the right edge and top of the
 * last box with width. A selection ending at the start of a line also reports an empty box there, which it skips.
 */
export function selectionEnd(rects: ArrayLike<{ right: number; top: number; width: number }>) {
  const last = Array.from(rects).findLast((rect) => rect.width > 0)
  return last && { left: last.right, top: last.top }
}

/** The plain line a reply's input starts with, so the agent reads which message it answers. */
export const replyLine = ({ id, excerpt }: Reply) => `↪ re #${id}: "${excerpt}"`

/** The text an input sends: the quote of the message it replies to, then the user's words. */
export function withReply(text: string, reply: Reply | undefined) {
  if (!reply) return text
  // A skill command keeps the start, where the server expands it; the quote leads its request instead.
  const command = /^\/skill:\S+\s*/.exec(text)?.[0] ?? ''
  const lead = command && `${command.trimEnd()} `
  return `${lead}${replyLine(reply)}\n\n${text.slice(command.length)}`
}

/** A sent input that replies to a message: the message it quoted, and the user's words after the quote. */
export function replyInput(text: string) {
  const match = /^↪ re #(\d+): "(.*)"(?:\n\n([\s\S]*))?$/.exec(text)
  return match ? { id: Number(match[1]), excerpt: match[2], text: match[3] ?? '' } : undefined
}

/** The reply draft `key` kept across a reload. */
export function storedReply(key: string): Reply | undefined {
  const stored = localStorage.getItem(`${key}.reply`)
  return stored ? (JSON.parse(stored) as Reply) : undefined
}

/** Keep draft `key`'s reply across a reload, as its text is kept. */
export function storeReply(key: string, reply: Reply | undefined) {
  if (reply) localStorage.setItem(`${key}.reply`, JSON.stringify(reply))
  else localStorage.removeItem(`${key}.reply`)
}
