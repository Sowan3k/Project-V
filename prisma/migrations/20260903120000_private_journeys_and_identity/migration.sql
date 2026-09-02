-- Phase 7 — private journeys and identity.
--
-- Purely additive: five new tables, one new enum type, one new nullable column on `users`,
-- and their indexes and foreign keys. There is no DROP and no ALTER of an existing column,
-- so no revision history can be touched by it (CLAUDE.md §9, invariant 2).
--
-- Two foreign-key choices carry invariants rather than convenience:
--
--   ON DELETE RESTRICT from journey_step_progress.stepId and journey_tasks.stepId to steps.
--   The database itself now refuses to delete a step that a follower is tracking, so no
--   public edit can take somebody's private progress with it (FR-30, BR-17, D-12,
--   invariant 8). Archiving a step is not deleting it, so progress survives that too.
--
--   ON DELETE CASCADE from journeys, accounts and sessions to users. This is the opposite of
--   the rule for shared knowledge, and deliberately so: a person's private state is theirs
--   and goes when their account does, while their contributions remain the community's.
--
-- Generated with `prisma migrate diff --from-empty` and reduced to the new objects, because
-- `--from-schema-datasource` needs a reachable database and the remote branch was not
-- (Test.md §14). CI applies migrations to an empty database and then runs a drift check, so
-- an error here fails the build rather than reaching anything.

CREATE TYPE "JourneyStepStatus" AS ENUM ('not_started', 'in_progress', 'completed', 'skipped', 'not_applicable');

CREATE TABLE "journeys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "selfReportedCompletedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "journeys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journey_step_progress" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" "JourneyStepStatus" NOT NULL DEFAULT 'not_started',
    "targetDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "privateNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journey_step_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "journey_tasks" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "stepId" TEXT,
    "label" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journey_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "users" ADD COLUMN "email" TEXT;

CREATE INDEX "journeys_routeId_idx" ON "journeys"("routeId");

CREATE INDEX "journeys_userId_archivedAt_idx" ON "journeys"("userId", "archivedAt");

CREATE UNIQUE INDEX "journeys_userId_routeId_key" ON "journeys"("userId", "routeId");

CREATE INDEX "journey_step_progress_stepId_idx" ON "journey_step_progress"("stepId");

CREATE UNIQUE INDEX "journey_step_progress_journeyId_stepId_key" ON "journey_step_progress"("journeyId", "stepId");

CREATE INDEX "journey_tasks_journeyId_idx" ON "journey_tasks"("journeyId");

CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

ALTER TABLE "journeys" ADD CONSTRAINT "journeys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journeys" ADD CONSTRAINT "journeys_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "journey_step_progress" ADD CONSTRAINT "journey_step_progress_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journey_step_progress" ADD CONSTRAINT "journey_step_progress_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "journey_tasks" ADD CONSTRAINT "journey_tasks_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journey_tasks" ADD CONSTRAINT "journey_tasks_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
