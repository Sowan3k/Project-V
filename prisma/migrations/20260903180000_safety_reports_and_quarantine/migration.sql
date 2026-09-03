-- Phase 9 — reporting and quarantine.
--
-- Additive only: two enum types, one table, one column on `users`, three on `fields`. No DROP
-- and no ALTER of an existing column, so nothing in the revision ledger is reachable by it.
--
-- Note what is NOT here, deliberately:
--
--   No threshold column, and no counter that a trigger could act on. FR-71 and invariant 14
--   forbid a raw report count being the sole automatic determinant of a state change, and
--   §23.2 leaves thresholds "an operational decision ... not fixed in this concept baseline"
--   (also CLAUDE.md §11). Quarantine is an administrator action, so the number never has to
--   be guessed.
--
--   No attachment, file or blob column on `reports`. Reports are structured and textual
--   (§8.6, decided 2026-09-02).
--
--   `fields.quarantinedAt` HIDES a value from current views. It deletes nothing: the field,
--   its revisions and its history are untouched, and lifting quarantine is setting the column
--   back to NULL. Containment, not destruction (FR-45, BR-15, invariants 1 and 4).

CREATE TYPE "UserRole" AS ENUM ('member', 'admin');

CREATE TYPE "ReportOutcome" AS ENUM ('no_action_needed', 'content_corrected', 'content_archived', 'content_removed', 'quarantine_upheld');

CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "detail" TEXT,
    "reporterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),
    "handledById" TEXT,
    "outcome" "ReportOutcome",
    "outcomeNote" TEXT,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'member';

ALTER TABLE "fields" ADD COLUMN "quarantinedAt" TIMESTAMP(3),
                       ADD COLUMN "quarantinedById" TEXT,
                       ADD COLUMN "quarantineNote" TEXT;

CREATE INDEX "fields_quarantinedAt_idx" ON "fields"("quarantinedAt");

CREATE INDEX "reports_fieldId_handledAt_idx" ON "reports"("fieldId", "handledAt");

CREATE INDEX "reports_reporterId_idx" ON "reports"("reporterId");

ALTER TABLE "reports" ADD CONSTRAINT "reports_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reports" ADD CONSTRAINT "reports_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fields" ADD CONSTRAINT "fields_quarantinedById_fkey" FOREIGN KEY ("quarantinedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
