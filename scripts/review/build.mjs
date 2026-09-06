import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * A production build for screenshots that leaves the working tree exactly as it found it.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **Why a build of its own at all.** Other sessions' dev servers have shared this checkout's
 * `.next` and corrupted each other's build manifests twice (Status.md, sessions 16 and 17) —
 * "it has now cost time twice". A review build writes to `.next-review` so photographing the
 * product cannot break somebody else's running server.
 *
 * **Why this wrapper.** `next build` adds the dist directory's own `types` glob to the
 * `include` list in `tsconfig.json`, and no flag stops it — so a custom dist directory means a
 * tracked file is rewritten as a side effect of taking pictures. The next person to run `git status` then finds a change
 * nobody made deliberately, which is exactly how a stray edit gets committed by accident.
 *
 * So the file is snapshotted before and written back after — byte for byte, including its line
 * endings, since this repository checks out CRLF on Windows and a normalised rewrite would show
 * up as every line changed.
 */

const tsconfig = resolve('tsconfig.json')
const before = readFileSync(tsconfig)

// Next's own binary through this Node, rather than `npx` through a shell: `shell: true` is
// what makes Node warn about unescaped arguments, and on Windows it is also the difference
// between spawning a program and spawning a command line.
const result = spawnSync(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'build'], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_DIST_DIR: '.next-review' },
})

const after = readFileSync(tsconfig)
if (!after.equals(before)) {
  writeFileSync(tsconfig, before)
  console.log('\ntsconfig.json restored — `next build` had rewritten it for the review dist dir')
}

process.exitCode = result.status ?? 1
