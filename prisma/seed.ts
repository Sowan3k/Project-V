/**
 * Seed entry point.
 *
 * Phase 0 has nothing to seed: no domain tables exist yet (see prisma/schema/schema.prisma)
 * and real route content is the parallel content track that starts at Phase 1 (Phases.md).
 *
 * The script exists so the command contract in CLAUDE.md §4 is true from day one, and so
 * the seed path is exercised rather than disguised as coverage it does not have.
 */
function main(): void {
  process.stdout.write(
    'seed: nothing to seed yet.\n' +
      '  Domain tables land in Phase 2; sourced route content lands via the content track.\n' +
      '  Seeded routes must never carry mockup-derived values (CLAUDE.md §8.6).\n',
  )
}

main()
