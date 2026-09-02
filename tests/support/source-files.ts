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

/**
 * Removes comments so prose cannot trip a source scan.
 *
 * Block comments go entirely; only whole-line `//` comments are removed, never a trailing
 * one, because truncating at a `//` inside a string literal — a URL, say — could hide a real
 * violation further along the line. Missing a comment is harmless; missing a violation is not.
 *
 * `tests/architecture/enum-single-source.test.ts` keeps its own copy of this deliberately:
 * it is Phase 0's exit criterion and depends on as little as possible, including as little
 * of this file as possible.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}
