-- Phase 8 — community signals: confirmations and challenges.
--
-- Additive only: two new tables plus their indexes and foreign keys. No DROP, no ALTER of an
-- existing column, so no revision history is reachable by it.
--
-- Both reference `fields` with ON DELETE RESTRICT. A field carrying somebody's confirmation
-- or an open challenge cannot be deleted out from under it, and shared knowledge is never
-- hard-deleted anyway (FR-19, BR-02, invariant 1) — this is the floor under that rule.
--
-- `challenges.resolvedByRevisionId` points at the revision that answered the challenge.
-- There is no reviewer column, no status enum and no queue table, because there is no
-- approval gate: an update goes live and creates a revision, and the community corrects
-- afterwards (FR-16, FR-69, §43.1, CLAUDE.md §8.6).

CREATE TABLE "confirmations" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "confirmations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "challenges" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "reason" "ChallengeReason" NOT NULL,
    "note" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByRevisionId" TEXT,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "confirmations_fieldId_createdAt_idx" ON "confirmations"("fieldId", "createdAt");

CREATE UNIQUE INDEX "confirmations_fieldId_authorId_key" ON "confirmations"("fieldId", "authorId");

CREATE INDEX "challenges_fieldId_resolvedAt_idx" ON "challenges"("fieldId", "resolvedAt");

CREATE INDEX "challenges_authorId_idx" ON "challenges"("authorId");

ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "challenges" ADD CONSTRAINT "challenges_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "challenges" ADD CONSTRAINT "challenges_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "challenges" ADD CONSTRAINT "challenges_resolvedByRevisionId_fkey" FOREIGN KEY ("resolvedByRevisionId") REFERENCES "field_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
