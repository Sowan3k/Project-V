-- Revision immutability — Phase 3.
--
-- The database layer of "the revision service is the only write path". Application guards
-- catch application mistakes; this catches everything else, including a migration, a script
-- or a psql session.
--
-- Revision rows are append-only. A correction is a new revision, never an edit of an old
-- one, and history is never rewritten in place (FR-20, BR-03, CLAUDE.md invariant 2).
-- Deleting one would lose the prior value entirely (FR-21, FR-45, invariant 4).
--
-- Note for anyone extending this: Prisma does not model triggers, so `prisma migrate diff`
-- neither generates nor reports them. They live here by hand, deliberately, and the CI
-- drift check is unaffected.

CREATE OR REPLACE FUNCTION vindeshi_revisions_are_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'revision rows are immutable: % on %.% is refused. A correction is a new revision, never an edit of an old one (FR-20, BR-03).',
    TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER route_revisions_immutable
  BEFORE UPDATE OR DELETE ON "route_revisions"
  FOR EACH ROW EXECUTE FUNCTION vindeshi_revisions_are_immutable();

CREATE TRIGGER step_revisions_immutable
  BEFORE UPDATE OR DELETE ON "step_revisions"
  FOR EACH ROW EXECUTE FUNCTION vindeshi_revisions_are_immutable();

CREATE TRIGGER step_edge_revisions_immutable
  BEFORE UPDATE OR DELETE ON "step_edge_revisions"
  FOR EACH ROW EXECUTE FUNCTION vindeshi_revisions_are_immutable();

CREATE TRIGGER field_revisions_immutable
  BEFORE UPDATE OR DELETE ON "field_revisions"
  FOR EACH ROW EXECUTE FUNCTION vindeshi_revisions_are_immutable();

-- Shared knowledge is archived, never deleted. Archiving sets archivedAt; the row and its
-- history stay queryable (FR-21, FR-45, BR-15, invariants 1 and 4).
CREATE OR REPLACE FUNCTION vindeshi_shared_knowledge_is_not_deletable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'shared route knowledge is never deleted: DELETE on %.% is refused. Archive it instead — archived content leaves current views and stays in history (FR-21, FR-45).',
    TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER routes_not_deletable
  BEFORE DELETE ON "routes"
  FOR EACH ROW EXECUTE FUNCTION vindeshi_shared_knowledge_is_not_deletable();

CREATE TRIGGER steps_not_deletable
  BEFORE DELETE ON "steps"
  FOR EACH ROW EXECUTE FUNCTION vindeshi_shared_knowledge_is_not_deletable();

CREATE TRIGGER step_edges_not_deletable
  BEFORE DELETE ON "step_edges"
  FOR EACH ROW EXECUTE FUNCTION vindeshi_shared_knowledge_is_not_deletable();

CREATE TRIGGER fields_not_deletable
  BEFORE DELETE ON "fields"
  FOR EACH ROW EXECUTE FUNCTION vindeshi_shared_knowledge_is_not_deletable();
