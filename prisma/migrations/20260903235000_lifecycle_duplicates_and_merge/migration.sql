-- Phase 11 — route lifecycle history, duplicate flagging and merge metadata.
-- FR-11, FR-38, FR-39, FR-40, FR-45, FR-46, FR-58. BR-09, BR-10, BR-15, BR-25, BR-32.
-- D-20, D-38. Invariants 1, 4, 14, 20, 23.
--
-- Additive only: two new tables, three nullable columns on `routes` recording a merge
-- decision, their indexes and foreign keys. No DROP, no ALTER of an existing column's type
-- or nullability, nothing touching a revision table.
--
-- Note what is NOT here: no route content is moved by a merge. `routes.mergedIntoId` has
-- existed since Phase 2 and remains a pointer; the duplicate keeps every step, field,
-- revision and follower it had (BR-25, FR-58, §40.4).

-- AlterTable
ALTER TABLE "routes" ADD COLUMN     "mergeNote" TEXT,
ADD COLUMN     "mergedAt" TIMESTAMP(3),
ADD COLUMN     "mergedById" TEXT;

-- CreateTable
CREATE TABLE "route_lifecycle_events" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "fromState" "RouteLifecycleState" NOT NULL,
    "toState" "RouteLifecycleState" NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_lifecycle_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duplicate_flags" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "duplicateOfId" TEXT NOT NULL,
    "note" TEXT,
    "flaggedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duplicate_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "route_lifecycle_events_routeId_createdAt_idx" ON "route_lifecycle_events"("routeId", "createdAt");

-- CreateIndex
CREATE INDEX "duplicate_flags_routeId_resolvedAt_idx" ON "duplicate_flags"("routeId", "resolvedAt");

-- CreateIndex
CREATE INDEX "duplicate_flags_duplicateOfId_idx" ON "duplicate_flags"("duplicateOfId");

-- CreateIndex
CREATE UNIQUE INDEX "duplicate_flags_routeId_duplicateOfId_flaggedById_key" ON "duplicate_flags"("routeId", "duplicateOfId", "flaggedById");

-- AddForeignKey
ALTER TABLE "route_lifecycle_events" ADD CONSTRAINT "route_lifecycle_events_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_lifecycle_events" ADD CONSTRAINT "route_lifecycle_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_flags" ADD CONSTRAINT "duplicate_flags_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_flags" ADD CONSTRAINT "duplicate_flags_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_flags" ADD CONSTRAINT "duplicate_flags_flaggedById_fkey" FOREIGN KEY ("flaggedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_flags" ADD CONSTRAINT "duplicate_flags_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_mergedById_fkey" FOREIGN KEY ("mergedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

