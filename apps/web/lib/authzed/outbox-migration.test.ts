import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../packages/database/migration/20260818120000_add_authzed_projection_outbox/migration.sql",
    import.meta.url
  ),
  "utf8"
);

describe("AuthZed projection outbox migration contract", () => {
  test("covers every authorization relationship source table", () => {
    const sourceTables = [
      "ApiKey",
      "ApiKeyWorkspace",
      "FeedbackDirectory",
      "FeedbackDirectoryWorkspace",
      "Membership",
      "Organization",
      "Team",
      "TeamUser",
      "User",
      "Workspace",
      "WorkspaceTeam",
    ];

    for (const sourceTable of sourceTables) {
      expect(migration).toContain(` ON "${sourceTable}"`);
    }
    expect(migration.match(/CREATE TRIGGER/g)).toHaveLength(sourceTables.length);
  });

  test("enqueues the previous relationship key as a revocation when a source pair moves", () => {
    expect(migration).toContain(
      "previous_source ->> primary_field IS DISTINCT FROM source ->> primary_field"
    );
    expect(migration).toContain(
      "previous_source ->> secondary_field IS DISTINCT FROM source ->> secondary_field"
    );
    expect(migration).toContain("previous_source ->> primary_field");
    expect(migration).toMatch(/previous_source[\s\S]*?true,[\s\S]*?NOW\(\)/);
  });

  test("marks all updates and deletes as revocations and ignores non-authorization updates", () => {
    expect(migration).toContain("TG_OP <> 'INSERT'");
    expect(migration).toContain('UPDATE OF "role", "accepted", "organizationId", "userId"');
    expect(migration).toContain('UPDATE OF "permission", "workspaceId", "teamId"');
    expect(migration).toContain('UPDATE OF "permission", "apiKeyId", "workspaceId"');
    expect(migration).not.toContain('UPDATE OF "lastUsedAt"');
  });

  test("is safe to rerun after a development schema push", () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "AuthzedProjectionOutbox"');
    expect(migration.match(/DROP TRIGGER IF EXISTS/g)).toHaveLength(11);
    expect(migration).toContain("CREATE OR REPLACE FUNCTION enqueue_authzed_projection()");
  });
});
