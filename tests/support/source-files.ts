import { readdirSync, readFileSync } from 'node:fs'
import { join, posix, resolve, sep } from 'node:path'

/**
 * A dependency-free recursive file walk, used by the architecture tests.
 *
 * Deliberately not a glob library: these tests hold Phase 0's exit criteria, so they
 * should depend on as little as possible.
 */
export function walk(dir: string, extensions: readonly string[]): string[] {
  const root = resolve(process.cwd(), dir)
  const out: string[] = []

  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
        visit(full)
        continue
      }
      if (extensions.some((extension) => entry.name.endsWith(extension))) out.push(full)
    }
  }

  visit(root)

  return out
    .map((file) => file.slice(process.cwd().length + 1).split(sep).join(posix.sep))
    .sort()
}

export function read(repoRelativePath: string): string {
  return readFileSync(resolve(process.cwd(), repoRelativePath), 'utf8')
}
