import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import { layout, onSurfaceReselect } from '../sdk/actions.ts'
import { HOME } from '../sdk/registry.ts'

/** The id of the surface that is rendering; the host provides it. */
export const SurfaceContext = createContext<string>(HOME)
export const useSurfaceId = () => useContext(SurfaceContext)

/**
 * Calls `handler` when the user picks the surface it renders in while that surface is already on screen (its tab, the
 * switcher, `mod+1…9`), so the surface can go back to its start, as a list from one item it was showing.
 */
export function useSurfaceReselect(handler: () => void) {
  const surface = useSurfaceId()
  const latest = useRef(handler)
  latest.current = handler
  useEffect(() => onSurfaceReselect((id) => id === surface && latest.current()), [surface])
}

/** Whether the shown surface renders `region` (`Sidebar` or `Panels`). */
export function useRegion(region: 'sidebar' | 'panels') {
  return useSyncExternalStore(layout.subscribe, () => layout.has(region))
}
