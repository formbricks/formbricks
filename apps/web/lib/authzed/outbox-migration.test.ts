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

  test("watches only the columns that can change a projected relationship", () => {
    expect(migration).toContain('UPDATE OF "role", "accepted", "organizationId", "userId"');
    expect(migration).toContain('UPDATE OF "permission", "workspaceId", "teamId"');
    expect(migration).toContain('UPDATE OF "permission", "apiKeyId", "workspaceId"');
    expect(migration).not.toContain('UPDATE OF "lastUsedAt"');
  });

  // Whether the classifier is *correct* is only observable against a real PostgreSQL, so the
  // transition table lives in outbox-trigger.integration.test.ts. What a text assertion can see, and
  // a runtime one cannot, is that no future target type is added without a deliberate decision:
  // the CASE has no catch-all beyond `ELSE false`, so an unmapped type is a revocation.
  test("classifies updates through a deny-by-default grant predicate", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION authzed_projection_is_grant(");
    expect(migration).toContain("ELSE NOT authzed_projection_is_grant(target_type, previous_source, source)");
    expect(migration).toContain("ELSE false");
    expect(migration).not.toContain("TG_OP <> 'INSERT'");
  });

  test("keeps every hot-path index off the seven days of retained history", () => {
    const createIndexStatements = migration.match(/CREATE INDEX IF NOT EXISTS[\s\S]*?;/g) ?? [];
    expect(createIndexStatements).not.toHaveLength(0);
    for (const statement of createIndexStatements) {
      expect(statement).toMatch(/WHERE "processedAt" IS (NULL|NOT NULL)/);
    }
  });

  // Repeated execution and catalog convergence are verified against PostgreSQL in
  // outbox-trigger.integration.test.ts. This source-level count remains intentionally exhaustive so
  // a new relationship source cannot omit its matching trigger replacement.
  test("declares every relationship-source trigger replacement", () => {
    expect(migration.match(/DROP TRIGGER IF EXISTS/g)).toHaveLength(11);
  });
});
