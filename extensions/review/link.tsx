import { useEffect, useSyncExternalStore } from 'react'
import { api, errorMessage, useExtensionUiState, useUltimate } from '@/sdk'
import { store } from '@/sdk/client'
import { ResolveAction } from './refs.ts'

/** The spec on screen, in durable UI state: it survives reloads and follows every tab, as the surface does. */
export const useSpec = () => useExtensionUiState<string>('spec', 'uncommitted')

/** The specs Review showed last, newest first, for the picker's Recently opened. */
export const useRecent = () => useExtensionUiState<string[]>('recent', [])

/**
 * The conversation a `conversation:<id>` link names: it opens whatever that conversation changed when followed
 * (`ResolveAction`), so one link stays right from its branch to its landing. Review itself shows only concrete specs.
 */
export function conversationOf(spec: string) {
  const id = /^conversation:([1-9]\d*)$/.exec(spec.trim())?.[1]
  return id === undefined ? undefined : Number(id)
}

/** A line to scroll to and mark: `line` of `file`, on the new side unless `side` says old. */
export type ReviewTarget = { file: string; line: number; side?: 'old' | 'new' }

export type Request = { spec: string; at?: ReviewTarget }

const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const notify = () => {
  for (const listener of listeners) listener()
}

/**
 * A link to a review is followed once, when the page is opened at it. Not when this module hot-reloads (every saved
 * facet file), and not on a reload or back/forward: their address can still carry `?review=` from a review shown
 * earlier, and following it would switch to Review on its own.
 */
function fromAddress(): Request | undefined {
  const followed = import.meta.hot?.data.followed === true
  if (import.meta.hot) import.meta.hot.data.followed = true
  const [opened] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  if (followed || opened?.type !== 'navigate') return undefined
  return reviewLink(location.href)
}

/** The review an address of this app asks for with `?review=<spec>` (and `&file=&line=&side=`), else undefined. */
export function reviewLink(href: string): Request | undefined {
  const url = URL.parse(href, location.href)
  if (!url || url.origin !== location.origin || url.pathname !== '/') return undefined
  const params = url.searchParams
  const spec = params.get('review')
  if (!spec) return undefined
  const file = params.get('file')
  const line = Number(params.get('line'))
  const side = params.get('side') === 'old' ? 'old' : undefined
  return {
    spec,
    ...(file && Number.isSafeInteger(line) && line > 0
      ? { at: { file, line, ...(side && { side }) } }
      : {}),
  }
}

// A review someone asked for and the link has not shown yet: the page's `?review=` first, then `openReview` calls.
let requested = fromAddress()
// The line the surface should scroll to, until it has.
let target: ReviewTarget | undefined

/** Show the Review surface at `spec` (see `ReviewKind` in refs.ts), scrolled to `at` when given. */
export function openReview(spec: string, at?: ReviewTarget) {
  requested = { spec, ...(at && { at }) }
  notify()
}

/** The line the surface was asked to show, until `reachedTarget`. */
export const useTarget = () => useSyncExternalStore(subscribe, () => target)

/** The surface scrolled to the target line, or found it cannot. */
export function reachedTarget() {
  target = undefined
  notify()
}

/**
 * Mounted at the root: shows a requested review, and keeps `?review=<spec>` in the address while Review is on screen,
 * so the address can be shared. It replaces the history entry: switching surfaces adds none.
 */
export function ReviewLink() {
  const wanted = useSyncExternalStore(subscribe, () => requested)
  const [spec, setSpec] = useSpec()
  const [, setRecent] = useRecent()
  const { surface, showSurface } = useUltimate()
  useEffect(() => {
    if (wanted === undefined) return
    requested = undefined
    const show = (next: string) => {
      target = wanted.at
      setSpec(next)
      showSurface('review')
      notify()
    }
    const id = conversationOf(wanted.spec)
    if (id === undefined) return show(wanted.spec)
    notify()
    void api.action(ResolveAction, { conversation: id }).then(
      (found) =>
        found
          ? show(found.spec)
          : store.notify({ level: 'info', message: `#${id} has no changes to review yet` }),
      (error: unknown) => store.notify({ level: 'error', message: errorMessage(error) }),
    )
  }, [wanted, setSpec, showSurface])
  useEffect(() => {
    if (surface !== 'review') return
    setRecent((recent) =>
      recent[0] === spec ? recent : [spec, ...recent.filter((item) => item !== spec)].slice(0, 8),
    )
  }, [surface, spec, setRecent])
  useEffect(() => {
    if (requested !== undefined) return
    const url = new URL(location.href)
    const shown = surface === 'review' ? spec : null
    if (url.searchParams.get('review') === shown) return
    if (shown === null) url.searchParams.delete('review')
    else url.searchParams.set('review', shown)
    // A line belongs to the review it was asked with: a new spec or another surface drops it.
    for (const name of ['file', 'line', 'side']) url.searchParams.delete(name)
    history.replaceState(history.state, '', url)
  }, [surface, spec])
  return null
}
