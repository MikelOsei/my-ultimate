import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const read = (path: string) =>
  readFile(path, 'utf8').catch(
    // A missing lockfile or install reads as absent: no clone of Ultimate lacks both.
    () => undefined,
  )

/** Whether `pnpm-lock.yaml` differs from what pnpm last installed (`node_modules/.pnpm/lock.yaml`). */
export async function installOwed(root: string) {
  const wanted = await read(join(root, 'pnpm-lock.yaml'))
  return wanted !== undefined && wanted !== (await read(join(root, 'node_modules/.pnpm/lock.yaml')))
}

/**
 * Why the Ultimate at `root` must not restart yet, or undefined: a new core booting on the packages installed before a
 * dependency change crashes (the Pi 1.5 landing: "harness.observeTaskGraph is not a function").
 */
export async function restartRefusal(root: string) {
  return (await installOwed(root))
    ? `Restart refused: dependencies changed (pnpm-lock.yaml differs from the installed packages); run pnpm install --frozen-lockfile in ${root}, then restart`
    : undefined
}
