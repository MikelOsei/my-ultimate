/**
 * The project's look on this machine: its accent and window title, kept in `appearance.json` in the project's home
 * (never in its repository), so every browser of the project shares them and the installed app's manifest and icon
 * carry them. Chrome reads the manifest at install and rechecks it from time to time, asking before it changes the
 * app's name or icon.
 */
import { join } from 'node:path'
import { readJson, updateJson } from '../lib/json-file.ts'
import { ACCENTS } from '../shared/protocol.ts'
import type { Accent, ProjectAppearance } from '../shared/protocol.ts'

const path = (home: string) => join(home, 'appearance.json')

/** Each accent on the icon's dark ground: the dark theme's `--brand` of that preset, in hex. */
const COLOURS: Record<Accent, string> = {
  violet: '#b79cf0',
  blue: '#73b1ff',
  teal: '#4dc2c2',
  green: '#80c182',
  pink: '#eb8ab9',
  ruby: '#f3606d',
  graphite: '#aeaeae',
}

/** The stored look; a value this version does not offer reads as unset. */
export const readAppearance = (home: string) => readFile(path(home))

const readFile = async (file: string) => parse(await readJson<Record<string, unknown>>(file, {}))

/** `value` when it names an accent preset. */
export const accentOf = (value: unknown) => ACCENTS.find((name) => name === value)

function parse(value: Record<string, unknown>): ProjectAppearance {
  const accent = accentOf(value.accent)
  const title = typeof value.title === 'string' ? value.title.trim().slice(0, 80) : ''
  return { ...(accent && { accent }), ...(title && { title }) }
}

/** Change the given fields; an empty title or a `null` accent (the theme's) unsets it. */
export async function writeAppearance(home: string, change: Record<string, unknown>) {
  if (change.accent !== undefined && change.accent !== null && !accentOf(change.accent))
    throw new Error('Unknown accent')
  if (change.title !== undefined && typeof change.title !== 'string')
    throw new Error('The title must be text')
  await updateJson(path(home), readFile, (look) => {
    const next = parse({ ...look, ...change })
    delete look.accent
    delete look.title
    if (next.accent) look.accent = next.accent
    if (next.title) look.title = next.title
  })
}

/**
 * Ultimate's U in an accent, as `/api/icon.svg?accent=…&shape=…` serves it. The app's is full bleed (the platform
 * rounds it), a `maskable` one keeps the U in the safe zone, and the tab's `favicon` rounds itself.
 */
export function icon(accent: Accent, shape: 'app' | 'maskable' | 'favicon') {
  const scale = shape === 'maskable' ? 0.7 : 1
  const radius = shape === 'favicon' ? 112 : 0
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="#17171c"/>
  <path transform="translate(256 256) scale(${scale}) translate(-256 -256)" d="M144 128v160a112 112 0 0 0 224 0V128" fill="none" stroke="${COLOURS[accent]}" stroke-width="51.2" stroke-linecap="round"/>
</svg>
`
}

/** The web app manifest, named for the project; `id` keeps the identity of apps installed from the static one. */
export function manifest(look: ProjectAppearance, folder: string) {
  const name = look.title ?? folder
  const accent = look.accent ?? 'violet'
  return {
    id: '/',
    name,
    short_name: name,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#1d1e20',
    theme_color: '#1d1e20',
    icons: [
      { src: `/api/icon.svg?accent=${accent}`, sizes: 'any', type: 'image/svg+xml' },
      {
        src: `/api/icon.svg?shape=maskable&accent=${accent}`,
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
