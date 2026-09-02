-- CreateEnum
CREATE TYPE "StudyLevel" AS ENUM ('bachelors', 'masters', 'phd', 'other');

-- CreateEnum
CREATE TYPE "RouteMechanism" AS ENUM ('direct_admission', 'government_scholarship', 'university_scholarship', 'other_mechanism');

-- CreateEnum
CREATE TYPE "StepEdgeKind" AS ENUM ('sequential', 'optional_branch', 'alternative', 'rejoin');

-- CreateEnum
CREATE TYPE "StepCategory" AS ENUM ('documents_preparation', 'language_testing', 'admission_university', 'funding_scholarship', 'immigration_visa', 'travel_departure');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "originCountry" CHAR(2) NOT NULL,
    "destinationCountry" CHAR(2) NOT NULL,
    "studyLevel" "StudyLevel" NOT NULL,
    "intake" TEXT,
    "mechanism" "RouteMechanism",
    "lifecycleState" "RouteLifecycleState" NOT NULL DEFAULT 'experimental',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "mergedIntoId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "currentRevisionId" TEXT,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_revisions" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "authorId" TEXT,
    "reason" TEXT,
    "previousRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steps" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "currentRevisionId" TEXT,

    CONSTRAINT "steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_revisions" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "StepCategory" NOT NULL,
    "earliestStartOffsetDays" INTEGER,
    "typicalDurationDays" INTEGER,
    "hardDeadline" TIMESTAMP(3),
    "authorId" TEXT,
    "reason" TEXT,
    "previousRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_edges" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "fromStepId" TEXT NOT NULL,
    "toStepId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "currentRevisionId" TEXT,

    CONSTRAINT "step_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_edge_revisions" (
    "id" TEXT NOT NULL,
    "stepEdgeId" TEXT NOT NULL,
    "kind" "StepEdgeKind" NOT NULL,
    "authorId" TEXT,
    "reason" TEXT,
    "previousRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_edge_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fields" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "category" "FieldCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "lastConfirmedAt" TIMESTAMP(3),
    "reviewDueAt" TIMESTAMP(3),
    "linkTrustClass" "LinkTrustClass",
    "currentRevisionId" TEXT,

    CONSTRAINT "fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_revisions" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "valueText" TEXT NOT NULL,
    "valueAmount" DECIMAL(14,2),
    "valueCurrency" CHAR(3),
    "valueDate" TIMESTAMP(3),
    "valueDurationDays" INTEGER,
    "sourceClass" "SourceClass" NOT NULL,
    "sourceUrl" TEXT,
    "sourceNote" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "authorId" TEXT,
    "reason" TEXT,
    "previousRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "routes_slug_key" ON "routes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "routes_currentRevisionId_key" ON "routes"("currentRevisionId");

-- CreateIndex
CREATE INDEX "routes_originCountry_destinationCountry_studyLevel_idx" ON "routes"("originCountry", "destinationCountry", "studyLevel");

-- CreateIndex
CREATE INDEX "routes_lifecycleState_idx" ON "routes"("lifecycleState");

-- CreateIndex
CREATE INDEX "route_revisions_routeId_createdAt_idx" ON "route_revisions"("routeId", "createdAt");

-- CreateIndex
CREATE INDEX "route_revisions_previousRevisionId_idx" ON "route_revisions"("previousRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "steps_currentRevisionId_key" ON "steps"("currentRevisionId");

-- CreateIndex
CREATE INDEX "steps_routeId_idx" ON "steps"("routeId");

-- CreateIndex
CREATE INDEX "step_revisions_stepId_createdAt_idx" ON "step_revisions"("stepId", "createdAt");

-- CreateIndex
CREATE INDEX "step_revisions_previousRevisionId_idx" ON "step_revisions"("previousRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "step_edges_currentRevisionId_key" ON "step_edges"("currentRevisionId");

-- CreateIndex
CREATE INDEX "step_edges_routeId_idx" ON "step_edges"("routeId");

-- CreateIndex
CREATE INDEX "step_edges_fromStepId_idx" ON "step_edges"("fromStepId");

-- CreateIndex
CREATE INDEX "step_edges_toStepId_idx" ON "step_edges"("toStepId");

-- CreateIndex
CREATE INDEX "step_edge_revisions_stepEdgeId_createdAt_idx" ON "step_edge_revisions"("stepEdgeId", "createdAt");

-- CreateIndex
CREATE INDEX "step_edge_revisions_previousRevisionId_idx" ON "step_edge_revisions"("previousRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "fields_currentRevisionId_key" ON "fields"("currentRevisionId");

-- CreateIndex
CREATE INDEX "fields_stepId_idx" ON "fields"("stepId");

-- CreateIndex
CREATE INDEX "fields_category_idx" ON "fields"("category");

-- CreateIndex
CREATE INDEX "field_revisions_fieldId_createdAt_idx" ON "field_revisions"("fieldId", "createdAt");

-- CreateIndex
CREATE INDEX "field_revisions_previousRevisionId_idx" ON "field_revisions"("previousRevisionId");

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "route_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_revisions" ADD CONSTRAINT "route_revisions_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_revisions" ADD CONSTRAINT "route_revisions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_revisions" ADD CONSTRAINT "route_revisions_previousRevisionId_fkey" FOREIGN KEY ("previousRevisionId") REFERENCES "route_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "step_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_revisions" ADD CONSTRAINT "step_revisions_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_revisions" ADD CONSTRAINT "step_revisions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_revisions" ADD CONSTRAINT "step_revisions_previousRevisionId_fkey" FOREIGN KEY ("previousRevisionId") REFERENCES "step_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_edges" ADD CONSTRAINT "step_edges_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_edges" ADD CONSTRAINT "step_edges_fromStepId_fkey" FOREIGN KEY ("fromStepId") REFERENCES "steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_edges" ADD CONSTRAINT "step_edges_toStepId_fkey" FOREIGN KEY ("toStepId") REFERENCES "steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_edges" ADD CONSTRAINT "step_edges_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "step_edge_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_edge_revisions" ADD CONSTRAINT "step_edge_revisions_stepEdgeId_fkey" FOREIGN KEY ("stepEdgeId") REFERENCES "step_edges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_edge_revisions" ADD CONSTRAINT "step_edge_revisions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_edge_revisions" ADD CONSTRAINT "step_edge_revisions_previousRevisionId_fkey" FOREIGN KEY ("previousRevisionId") REFERENCES "step_edge_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fields" ADD CONSTRAINT "fields_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fields" ADD CONSTRAINT "fields_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "field_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_revisions" ADD CONSTRAINT "field_revisions_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_revisions" ADD CONSTRAINT "field_revisions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_revisions" ADD CONSTRAINT "field_revisions_previousRevisionId_fkey" FOREIGN KEY ("previousRevisionId") REFERENCES "field_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

