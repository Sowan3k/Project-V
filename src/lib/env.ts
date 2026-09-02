/**
 * Runtime environment access.
 *
 * Read at call time, never at module load, so a missing variable fails the request that
 * needs it rather than the production build (CI builds without a database).
 */
export class MissingEnvError extends Error {
  constructor(name: string) {
    super(
      `Missing required environment variable ${name}. ` +
        'It is written into .env.local by `neon link` / `neon deploy` and must never be committed (CLAUDE.md §4).',
    )
    this.name = 'MissingEnvError'
  }
}

function required(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.trim() === '') throw new MissingEnvError(name)
  return value
}

/** Pooled connection — application queries. */
export function databaseUrl(): string {
  return required('DATABASE_URL')
}

/** Direct connection — Prisma Migrate and Introspect only. */
export function databaseUrlUnpooled(): string {
  return required('DATABASE_URL_UNPOOLED')
}

/** The Neon branch this process is pointed at, for diagnostics. */
export function neonBranch(): string | null {
  return process.env.NEON_BRANCH ?? null
}
