/** Where Review's Open in … finds a diff's file: its worktree, the project checkout, else a read-only copy from Git. */
import { access, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { exec } from '../../lib/exec.ts'
import { git } from '../../lib/git.ts'
import type { ReviewOpens } from './refs.ts'

/** `file` resolved inside `folder`; throws when it leads out of it. */
function inside(folder: string, file: string) {
  const path = resolve(folder, file)
  if (!path.startsWith(folder + sep)) throw new Error('file must be a path inside the folder')
  return path
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    // Not there (or unreadable): it cannot be opened from here.
    () => false,
  )

/** Where `file` opens now: in `worktree` while it is there, else in `checkout` while it is there, else a copy. */
export async function locate(
  folders: { worktree?: string; checkout: string },
  file: string,
): Promise<ReviewOpens> {
  const inCheckout = inside(folders.checkout, file)
  if (folders.worktree && (await exists(inside(folders.worktree, file)))) return 'worktree'
  return (await exists(inCheckout)) ? 'checkout' : 'copy'
}

/**
 * The folder holding a read-only copy of `file` as of commit `rev`, read from `checkout`'s repository only:
 * `<tmp>/ultimate-review/<sha>/<file>`, written on first use (a commit's file never changes).
 */
export async function copyOf(checkout: string, rev: unknown, file: string) {
  if (typeof rev !== 'string' || !/^[0-9a-f]{40,64}$/.test(rev))
    throw new Error('rev must be a full commit sha')
  const sha = await git(
    checkout,
    'rev-parse',
    '--verify',
    '--quiet',
    '--end-of-options',
    `${rev}^{commit}`,
  ).catch(
    // `--quiet` exits 1 without a message for an unknown commit: say so below.
    () => '',
  )
  if (!sha) throw new Error(`${rev.slice(0, 7)} is not a commit of this project`)
  const folder = join(tmpdir(), 'ultimate-review', sha)
  const path = inside(folder, file)
  if (await exists(path)) return folder
  const { stdout } = await exec('git', ['show', `${sha}:${file}`], {
    cwd: checkout,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 30000,
  }).catch(() => {
    throw new Error(`${file} is not in ${sha.slice(0, 7)}`)
  })
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, stdout, { mode: 0o444, flag: 'wx' }).catch(
    (error: NodeJS.ErrnoException) => {
      // Another click wrote the same copy first: it is the same file.
      if (error.code !== 'EEXIST') throw error
    },
  )
  return folder
}
