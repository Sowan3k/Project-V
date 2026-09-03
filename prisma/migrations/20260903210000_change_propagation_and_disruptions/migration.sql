-- Phase 10 — change propagation, shadow route and temporary disruptions.
-- FR-28, FR-29, FR-30, FR-32, FR-59, FR-60, FR-61, FR-63, FR-76, FR-77, FR-22.
-- BR-08, BR-17, BR-26, BR-27. Invariants 8, 19, 21.
--
-- Additive only: two enum types, three new tables, their indexes and foreign keys. There is
-- no DROP, no ALTER of an existing column and no change to any revision table — the shadow
-- route is reconstructed from the existing append-only ledger rather than stored, so nothing
-- about route history is touched by this migration (invariants 1, 2, 4).

-- CreateEnum
CREATE TYPE "RouteChangeKind" AS ENUM ('structural', 'field_correction');

-- CreateEnum
CREATE TYPE "FollowerChangeStance" AS ENUM ('applies', 'already_handled', 'not_applicable');

-- CreateTable
CREATE TABLE "route_changes" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "kind" "RouteChangeKind" NOT NULL,
    "severity" "ChangeSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "announcedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveAt" TIMESTAMP(3),
    "stepId" TEXT,
    "fieldId" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temporary_disruptions" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "severity" "ChangeSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedNote" TEXT,
    "locationScope" TEXT,
    "stepId" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "temporary_disruptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_change_notes" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "changeId" TEXT NOT NULL,
    "stance" "FollowerChangeStance" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journey_change_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "route_changes_routeId_announcedAt_idx" ON "route_changes"("routeId", "announcedAt");

-- CreateIndex
CREATE INDEX "route_changes_routeId_effectiveAt_idx" ON "route_changes"("routeId", "effectiveAt");

-- CreateIndex
CREATE INDEX "route_changes_stepId_idx" ON "route_changes"("stepId");

-- CreateIndex
CREATE INDEX "temporary_disruptions_routeId_startsAt_idx" ON "temporary_disruptions"("routeId", "startsAt");

-- CreateIndex
CREATE INDEX "temporary_disruptions_routeId_endsAt_idx" ON "temporary_disruptions"("routeId", "endsAt");

-- CreateIndex
CREATE INDEX "temporary_disruptions_stepId_idx" ON "temporary_disruptions"("stepId");

-- CreateIndex
CREATE INDEX "journey_change_notes_changeId_idx" ON "journey_change_notes"("changeId");

-- CreateIndex
CREATE UNIQUE INDEX "journey_change_notes_journeyId_changeId_key" ON "journey_change_notes"("journeyId", "changeId");

-- AddForeignKey
ALTER TABLE "route_changes" ADD CONSTRAINT "route_changes_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_changes" ADD CONSTRAINT "route_changes_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_changes" ADD CONSTRAINT "route_changes_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_changes" ADD CONSTRAINT "route_changes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temporary_disruptions" ADD CONSTRAINT "temporary_disruptions_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temporary_disruptions" ADD CONSTRAINT "temporary_disruptions_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temporary_disruptions" ADD CONSTRAINT "temporary_disruptions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_change_notes" ADD CONSTRAINT "journey_change_notes_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_change_notes" ADD CONSTRAINT "journey_change_notes_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "route_changes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

