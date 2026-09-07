-- Account closure (FR-26, BR-16, §24.1, invariant 5).
--
-- One nullable column, and a deliberate absence beside it.
--
-- Closing an account erases everything that identifies a real person — the email, the OAuth
-- links, every session, and every private journey, date, note and task — and keeps the
-- pseudonymous handle that the public revision ledger is attributed to.
--
-- It is NOT a soft delete waiting for a hard one, and there is deliberately no job here that
-- later removes the row. Two reasons, both of which had to hold:
--
--   1. `DELETE FROM users` cannot succeed. Every attribution is ON DELETE SET NULL, and
--      setting a revision's author_id to null is an UPDATE on a revision row — refused by
--      `vindeshi_revisions_are_immutable`, which the 20260902160000 migration installed on
--      route_revisions, step_revisions, step_edge_revisions and field_revisions. The delete
--      fails with restrict_violation. That trigger is load-bearing (FR-20, BR-03, invariant 2)
--      and is not being loosened to make a delete possible.
--
--   2. Even if it could, it would be wrong. The handle is generated and is never a real name
--      or an email (§24.3), so erasing it removes authorship from a public knowledge ledger to
--      delete an identifier that identifies nobody.
--
-- What makes this a real closure rather than a flag: the email goes to NULL, so the same
-- Google account signing in afterwards is a genuinely new user with a new handle. There is no
-- route back into a closed account.
ALTER TABLE "users" ADD COLUMN "closedAt" TIMESTAMP(3);

-- Read by the sign-in path and by the contributor page. Closed accounts are rare, so this is
-- a partial index: it stays small however many members there eventually are.
CREATE INDEX "users_closedAt_idx" ON "users" ("closedAt") WHERE "closedAt" IS NOT NULL;
