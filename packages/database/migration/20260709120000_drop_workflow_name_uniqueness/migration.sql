-- Workflow names no longer need to be unique per workspace: workflows are identified by id, and
-- the instant-create flow starts every draft with the same default name ("New workflow"), which a
-- uniqueness constraint would reject on the second create.
DROP INDEX IF EXISTS "Workflow_workspaceId_name_not_archived_key";
