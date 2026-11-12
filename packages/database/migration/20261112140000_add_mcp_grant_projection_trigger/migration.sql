-- ENG-7153 (ADR-0042): project an MCP grant's organization & workspace access into SpiceDB through the
-- existing outbox, so saving, editing or revoking a grant, and deleting a selected workspace or
-- organization, change its relationships in the same transaction that changes its rows.
--
-- Three triggers, one target type: every event names the grant (`mcp_grant`, primary id = grant id),
-- and the reconciler (`apps/web/lib/authzed/mcp-grant.ts`) rebuilds that grant's relationships from its
-- rows. A selection deleted by a cascade (a workspace or organization deleted, a grant revoked) fires the
-- row-level trigger like any other delete.
--
-- `enqueue_authzed_projection` and `authzed_projection_is_grant` are reused unchanged: an insert is a
-- grant of reach, a delete and an `access` change are revocations (the classifier's `ELSE false`), which
-- is what they are, so the freshness guard covers a narrowing that has not been projected yet.
--
-- The app must already know the `mcp_grant` outbox target type when this runs (outbox-types.ts ships in
-- the same release): the claim dead-letters unknown types. The tables are new in this release, so no
-- existing row is affected and the triggers lock nothing in use.

SET lock_timeout = '1s';

DROP TRIGGER IF EXISTS "authzed_projection_mcp_grant" ON "McpGrant";
CREATE TRIGGER "authzed_projection_mcp_grant"
AFTER DELETE OR UPDATE OF "access" ON "McpGrant"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('mcp_grant', 'id', '');

DROP TRIGGER IF EXISTS "authzed_projection_mcp_grant_organization" ON "McpGrantOrganization";
CREATE TRIGGER "authzed_projection_mcp_grant_organization"
AFTER INSERT OR DELETE OR UPDATE OF "grantId", "organizationId" ON "McpGrantOrganization"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('mcp_grant', 'grantId', '');

DROP TRIGGER IF EXISTS "authzed_projection_mcp_grant_workspace" ON "McpGrantWorkspace";
CREATE TRIGGER "authzed_projection_mcp_grant_workspace"
AFTER INSERT OR DELETE OR UPDATE OF "grantId", "workspaceId" ON "McpGrantWorkspace"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('mcp_grant', 'grantId', '');

RESET lock_timeout;
