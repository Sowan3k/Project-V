-- Phase 10, follow-up — the durable link between a change announcement and the revision
-- state it describes. FR-22, FR-31, FR-59, FR-77. Invariants 1, 2, 4, 15.
--
-- Replaces association-by-date, which this product cannot rely on: revisions written in one
-- transaction share a timestamp to the millisecond, and `previousRevisionId` is deliberately
-- non-unique so a chain may fork (FR-70, invariant 15) — leaving "the revision current at
-- time T" genuinely ambiguous. A specific revision id never is.
--
-- Only the "to" side is stored. The "from" side is each revision's own `previousRevisionId`,
-- which the ledger already holds immutably; storing it twice would let the two disagree.
--
-- Additive only: one new table, its indexes, its foreign keys and one CHECK constraint.
-- No DROP, no ALTER of an existing column, nothing touching a revision table.

-- CreateTable
CREATE TABLE "route_change_revisions" (
    "id" TEXT NOT NULL,
    "changeId" TEXT NOT NULL,
    "routeRevisionId" TEXT,
    "stepRevisionId" TEXT,
    "stepEdgeRevisionId" TEXT,
    "fieldRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_change_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "route_change_revisions_stepRevisionId_idx" ON "route_change_revisions"("stepRevisionId");

-- CreateIndex
CREATE INDEX "route_change_revisions_fieldRevisionId_idx" ON "route_change_revisions"("fieldRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "route_change_revisions_changeId_routeRevisionId_key" ON "route_change_revisions"("changeId", "routeRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "route_change_revisions_changeId_stepRevisionId_key" ON "route_change_revisions"("changeId", "stepRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "route_change_revisions_changeId_stepEdgeRevisionId_key" ON "route_change_revisions"("changeId", "stepEdgeRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "route_change_revisions_changeId_fieldRevisionId_key" ON "route_change_revisions"("changeId", "fieldRevisionId");

-- AddForeignKey
ALTER TABLE "route_change_revisions" ADD CONSTRAINT "route_change_revisions_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "route_changes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_change_revisions" ADD CONSTRAINT "route_change_revisions_routeRevisionId_fkey" FOREIGN KEY ("routeRevisionId") REFERENCES "route_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_change_revisions" ADD CONSTRAINT "route_change_revisions_stepRevisionId_fkey" FOREIGN KEY ("stepRevisionId") REFERENCES "step_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_change_revisions" ADD CONSTRAINT "route_change_revisions_stepEdgeRevisionId_fkey" FOREIGN KEY ("stepEdgeRevisionId") REFERENCES "step_edge_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_change_revisions" ADD CONSTRAINT "route_change_revisions_fieldRevisionId_fkey" FOREIGN KEY ("fieldRevisionId") REFERENCES "field_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Exactly one reference per row, enforced by the database rather than by the service alone.
--
-- A row naming two revisions, or none, would be a silently meaningless link — the shadow
-- reconstruction would read it, resolve nothing, and quietly produce a wrong "before". A
-- constraint turns that into a loud failure at the moment of writing. Prisma has no CHECK
-- syntax, so it is added here; `prisma migrate diff` does not surface CHECK constraints, so
-- it does not appear as drift.
ALTER TABLE "route_change_revisions"
  ADD CONSTRAINT "route_change_revisions_exactly_one_reference"
  CHECK (
    (CASE WHEN "routeRevisionId"    IS NULL THEN 0 ELSE 1 END) +
    (CASE WHEN "stepRevisionId"     IS NULL THEN 0 ELSE 1 END) +
    (CASE WHEN "stepEdgeRevisionId" IS NULL THEN 0 ELSE 1 END) +
    (CASE WHEN "fieldRevisionId"    IS NULL THEN 0 ELSE 1 END)
    = 1
  );
