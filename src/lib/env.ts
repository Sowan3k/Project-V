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

/**
 * Whether this environment has a database configured at all.
 *
 * Only DATABASE_URL is checked, because only DATABASE_URL is needed at runtime —
 * `directUrl` is read by the Prisma CLI, never by the running application (CLAUDE.md §4).
 * Returns a boolean and never the value, so a caller cannot leak the credential.
 */
export function isDatabaseConfigured(): boolean {
  const value = process.env.DATABASE_URL
  return value !== undefined && value.trim() !== ''
}

/** Direct connection — Prisma Migrate and Introspect only. */
export function databaseUrlUnpooled(): string {
  return required('DATABASE_URL_UNPOOLED')
}

/** The Neon branch this process is pointed at, for diagnostics. */
export function neonBranch(): string | null {
  return process.env.NEON_BRANCH ?? null
}
