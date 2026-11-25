import { PaletteIcon } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  cn,
  defineWebExtension,
  errorMessage,
  getState,
  useStore,
  useSystem,
  useUltimate,
} from '@/sdk'
import type { Accent } from '../../shared/protocol.ts'
import {
  ACCENTS,
  THEMES,
  TEXT_SIZES,
  applyAppearance,
  readAppearance,
  themeOf,
  writeAppearance,
} from './appearance.tsx'
import type { Appearance } from './appearance.tsx'

let appearance = readAppearance()
const listeners = new Set<() => void>()
function update(change: Partial<Appearance>) {
  appearance = { ...appearance, ...change }
  writeAppearance(appearance)
  applyAppearance(appearance, document.documentElement)
  for (const listener of listeners) listener()
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const useAppearance = () => useSyncExternalStore(subscribe, () => appearance)
const useMode = () => useStore((state) => state.ui.theme)

/** The project's accent, as the server keeps it, or the theme's when it has none, over this browser's copy of it. */
function ProjectAccent() {
  const system = useSystem()
  const look = useAppearance()
  const mode = useMode()
  const accent = system
    ? (system.project.appearance.accent ?? themeOf(look, mode).accent)
    : undefined
  useEffect(() => {
    if (accent && accent !== appearance.accent) update({ accent })
  }, [accent])
  return null
}

/** The browser's bar and the installed app's chrome take the theme's background. */
function ThemeColor() {
  const bar = themeOf(useAppearance(), useMode()).bar
  useEffect(() => {
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', bar)
  }, [bar])
  return null
}

/** While the theme follows the system, every change of the system's theme switches it. */
function FollowSystem() {
  const { system } = useAppearance()
  const { setTheme } = useUltimate()
  useEffect(() => {
    if (!system) return undefined
    const dark = matchMedia('(prefers-color-scheme: dark)')
    const follow = () => setTheme(dark.matches ? 'dark' : 'light')
    follow()
    dark.addEventListener('change', follow)
    return () => dark.removeEventListener('change', follow)
  }, [system, setTheme])
  return null
}

const label = 'px-3 section-label'
const option =
  'flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[5px] px-1 text-[12px] whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'
const chosen = 'bg-accent text-foreground shadow-xs'
const tile =
  'rounded-md border border-transparent text-[12px] text-muted-foreground transition-colors outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'
const tileChosen = 'border-border/80 bg-accent text-foreground'
/** An accent's tile: tighter in a narrow panel, so the longest name still fits. */
const swatch = 'flex h-8 min-w-0 items-center gap-2 px-2 @max-[20rem]:gap-1.5 @max-[20rem]:px-1.5'

function Choices({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div
      aria-label={name}
      className="mx-3 mt-2 flex rounded-md border border-border/80 bg-background p-0.5"
      role="group"
    >
      {children}
    </div>
  )
}

/** A theme in miniature, in its own colours: a sidebar, two lines of text and one of the accent. */
function Preview({ theme, accent }: { theme: string; accent: Accent }) {
  return (
    <span
      className="flex h-11 overflow-hidden rounded-[5px] border border-border bg-background"
      data-preview={theme}
    >
      <span className="w-3.5 shrink-0 border-r border-border bg-sidebar" />
      <span className="flex flex-1 flex-col justify-center gap-1 px-2">
        <span className="h-1 w-3/4 rounded-full bg-foreground/85" />
        <span className="h-1 w-1/2 rounded-full bg-muted-foreground" />
        <span className="h-1 w-1/3 rounded-full bg-brand" data-accent={accent} />
      </span>
    </span>
  )
}

/** The project's window title: saved on Enter or leaving the field, reverted with Escape; empty is the folder name. */
function WindowTitle({ onError }: { onError: (error: string | undefined) => void }) {
  const project = useSystem()?.project
  const saved = project?.appearance.title ?? ''
  const [draft, setDraft] = useState(saved)
  useEffect(() => setDraft(saved), [saved])
  const { setAppearance } = useUltimate()
  const save = () => {
    if (draft.trim() === saved) return
    setAppearance({ title: draft.trim() }).then(
      () => onError(undefined),
      (error: unknown) => onError(errorMessage(error)),
    )
  }
  return (
    <div>
      <label className={label} htmlFor="theme-window-title">
        Window title
      </label>
      <input
        autoComplete="off"
        className="mx-3 mt-2 h-8 w-[calc(100%-1.5rem)] rounded-md border border-border/80 bg-background px-2.5 text-[12.5px] outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        id="theme-window-title"
        maxLength={80}
        onBlur={save}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') setDraft(saved)
        }}
        placeholder={project?.name}
        value={draft}
      />
    </div>
  )
}

function AppearancePanel() {
  const look = useAppearance()
  const mode = useMode()
  const shown = themeOf(look, mode)
  const darkLabel = themeOf(look, 'dark').label
  const projectAccent = useSystem()?.project.appearance.accent
  const { setTheme, setAppearance } = useUltimate()
  const [error, setError] = useState<string>()
  /** `null` leaves the accent to the theme. */
  const chooseAccent = (accent: Accent | null) => {
    const previous = look.accent
    update({ accent: accent ?? shown.accent })
    setAppearance({ accent }).then(
      () => setError(undefined),
      (failure: unknown) => {
        update({ accent: previous })
        setError(errorMessage(failure))
      },
    )
  }
  return (
    <section className="@container flex flex-col gap-5 pt-3 pb-3.5">
      <WindowTitle onError={setError} />
      <div>
        <div className={label}>Theme</div>
        <div aria-label="Theme" className="mx-3 mt-2 grid grid-cols-3 gap-1" role="group">
          {THEMES.map((theme) => (
            <button
              aria-pressed={shown.id === theme.id}
              className={cn(
                tile,
                'flex flex-col gap-1.5 p-1 pb-1.5',
                shown.id === theme.id && tileChosen,
              )}
              key={theme.id}
              onClick={() => {
                if (theme.id === 'light') update({ system: false })
                else update({ system: false, dark: theme.id })
                setTheme(theme.id === 'light' ? 'light' : 'dark')
              }}
              type="button"
            >
              <Preview accent={projectAccent ?? theme.accent} theme={theme.id} />
              {theme.label}
            </button>
          ))}
        </div>
        <label className="mx-3 mt-2.5 flex cursor-pointer items-center justify-between gap-3 px-1 text-[12px] text-muted-foreground">
          <span>
            <span className="text-foreground">Match system</span>: Light by day, {darkLabel} by
            night
          </span>
          <Switch checked={look.system} onCheckedChange={(system) => update({ system })} />
        </label>
      </div>
      <div>
        <div className={label}>Accent</div>
        {/* Two columns in a narrow panel, so each name fits its tile. */}
        <div
          aria-label="Accent"
          className="mx-3 mt-2 grid grid-cols-3 gap-1 @max-[20rem]:grid-cols-2"
          role="group"
        >
          <button
            aria-pressed={projectAccent === undefined}
            className={cn(tile, swatch, projectAccent === undefined && tileChosen)}
            data-accent={shown.accent}
            onClick={() => chooseAccent(null)}
            title={`The theme's accent: ${shown.accent}`}
            type="button"
          >
            <span className="size-3 shrink-0 rounded-full bg-brand" />
            <span className="truncate">Theme</span>
          </button>
          {ACCENTS.map((name) => (
            <button
              aria-pressed={projectAccent === name}
              className={cn(tile, swatch, 'capitalize', projectAccent === name && tileChosen)}
              data-accent={name}
              key={name}
              onClick={() => chooseAccent(name)}
              type="button"
            >
              <span className="size-3 shrink-0 rounded-full bg-brand" />
              <span className="truncate">{name}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className={label}>Conversation text</div>
        <Choices name="Conversation text">
          {TEXT_SIZES.map((size) => (
            <button
              aria-pressed={look.text === size}
              className={cn(option, 'font-mono text-[11.5px]', look.text === size && chosen)}
              key={size}
              onClick={() => update({ text: size })}
              type="button"
            >
              {size}px
            </button>
          ))}
        </Choices>
      </div>
      {error && (
        <p className="mx-3 text-[11.5px] leading-snug text-destructive" role="alert">
          Not saved: {error}
        </p>
      )}
      <p className="mx-3 text-[11.5px] leading-snug text-muted-foreground/80">
        The title and accent are this project's and name and colour its installed app, which takes
        them on when the browser next checks it; Theme leaves the accent to the theme. The theme and
        text size are saved in this browser; to scale the whole window, use the browser's zoom.
      </p>
    </section>
  )
}

/** The title bar's way into the Appearance panel, beside the command palette. */
function AppearanceButton() {
  const { openPanel } = useUltimate()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label="Appearance"
          className="size-6 text-muted-foreground hover:text-foreground md:max-lg:size-7"
          onClick={() => openPanel('theme')}
          size="icon"
          variant="ghost"
        >
          <PaletteIcon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Appearance</TooltipContent>
    </Tooltip>
  )
}

export default defineWebExtension({
  slots: {
    overlay: [FollowSystem, ProjectAccent, ThemeColor],
    'titlebar.right': [AppearanceButton],
  },
  panels: [
    // Opened from ⌘K and the title bar.
    {
      id: 'theme',
      title: 'Appearance',
      icon: PaletteIcon,
      component: AppearancePanel,
      order: 9,
      tab: false,
    },
  ],
  commands: [
    {
      id: 'theme.panel',
      title: 'Appearance…',
      group: 'Ultimate',
      run: (context) => context.openPanel('theme'),
    },
    {
      id: 'theme.toggle',
      title: 'Toggle light and dark theme',
      group: 'Ultimate',
      run: (context) => {
        update({ system: false })
        context.setTheme(getState().ui.theme === 'dark' ? 'light' : 'dark')
      },
    },
  ],
})
