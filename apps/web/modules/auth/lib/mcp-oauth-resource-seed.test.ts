import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { MCP_OAUTH_SCOPES } from "./oauth-urls";

/**
 * ENG-2343. The data migration seeds the `oauthResource` row for instances that already have MCP
 * clients. It cannot import the app's scope list — `packages/database` may not depend on `apps/web`,
 * and the migration is not an exported subpath — so it keeps a local copy, and this test is what makes
 * the copy safe.
 *
 * **What it may not assert is that the copy equals the app's *current* list.** It did, and that was
 * wrong in a way that cost a real edit: adding `responses:*` to `MCP_OAUTH_SCOPES` turned this test
 * red, and the obvious way to make it green was to add them to the 20260812110001 migration — an
 * already-applied one. That rewrites what a migration claims to have done. On instances that ran it
 * the edit changes nothing, so the drift it was meant to prevent is repaired by a *later* migration
 * instead, and the edit only makes history disagree with itself.
 *
 * So the invariant is stated across migrations, not against one of them: whatever 2343 seeded, plus
 * whatever each later repair grants, must cover everything the app can grant. A new scope adds a
 * repair migration and a line here — never an edit to a migration that has already run.
 *
 * Not cosmetic. `allowedScopes` **intersects** the requested scopes rather than validating them
 * (`resolveResourcePolicy` in `@better-auth/oauth-provider`), and it skips only NULL/undefined. So a
 * scope the app advertises but this row omits is silently intersected away, and a request for only that
 * scope fails `invalid_scope` at `/authorize`. With `resourceSeedMode: "insertOnly"` the row is never
 * repaired at boot, so any divergence is permanent for every upgraded instance.
 *
 * Read as text rather than imported: crossing the workspace boundary in a type-checked import would fight
 * the app's tsconfig, and the value under test is a literal, so parsing it is sufficient.
 */
const MIGRATION_PATH =
  "../../packages/database/migration/20260812110001_eng_2343_backfill_oauth_resource_links/migration.ts";

const readSeededScopes = (): string[] => {
  const source = readFileSync(resolve(process.cwd(), MIGRATION_PATH), "utf8");
  const declaration = /export const MCP_RESOURCE_ALLOWED_SCOPES = \[([^\]]*)\]/.exec(source);
  if (!declaration) {
    throw new Error(
      "MCP_RESOURCE_ALLOWED_SCOPES was not found in the migration — it was renamed or removed, which " +
        "means the seeded resource may no longer allow the scopes the app grants."
    );
  }
  return [...declaration[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
};

/**
 * What 20260812110001 actually seeded when it ran. Frozen deliberately: this is history, and the test
 * below exists to make editing it fail rather than pass quietly.
 */
const ENG_2343_SEEDED_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "surveys:read",
  "surveys:write",
  "workflows:read",
  "workflows:write",
  "feedbackRecords:read",
  "feedbackRecords:write",
];

/**
 * Repair migrations that grant further scopes to the same row, newest last. Each entry is the literal
 * that migration appends; a new scope goes here beside its migration rather than into the 2343 list.
 */
const REPAIR_MIGRATIONS = [
  {
    path: "../../packages/database/migration/20260915120000_eng_2862_grant_responses_scopes/migration.ts",
    declaration: /const RESPONSE_SCOPES = \[([^\]]*)\]/,
  },
];

const readScopeLiteral = (path: string, declaration: RegExp): string[] => {
  const source = readFileSync(resolve(process.cwd(), path), "utf8");
  const match = declaration.exec(source);
  if (!match) {
    throw new Error(
      `A scope literal was not found in ${path} — it was renamed or removed, which means the resource ` +
        "row may no longer allow every scope the app grants."
    );
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
};

describe("the oauthResource row allows every scope the app can grant (ENG-2343)", () => {
  test("the 2343 seed literal is unchanged — an applied migration is history, not a current list", () => {
    expect(
      readSeededScopes(),
      "20260812110001 has already run on every instance, so widening its literal repairs nothing and " +
        "makes it claim a scope it never seeded. If you are adding a scope: write a data migration that " +
        "grants it to existing rows, and add that migration to REPAIR_MIGRATIONS above. Do not edit this " +
        "constant to match — that hides the gap, and /authorize answers invalid_scope on every instance " +
        "that already upgraded."
    ).toEqual(ENG_2343_SEEDED_SCOPES);
  });

  /**
   * The failure mode that matters, and the reason any of this is asserted: a scope the app can grant
   * that the resource row would intersect away, leaving `invalid_scope` at `/authorize` with
   * `resourceSeedMode: "insertOnly"` meaning nothing repairs it at boot.
   */
  test("every scope the app can grant is allowed once every migration has run", () => {
    // Built from the frozen list rather than from the file. What an upgraded instance actually holds is
    // what 2343 seeded when it ran, whatever the file says today — and reading the file here is what
    // let the gap close itself: editing the applied migration made this pass, so the repair migration
    // that was the real fix never got written.
    const granted = new Set([
      ...ENG_2343_SEEDED_SCOPES,
      ...REPAIR_MIGRATIONS.flatMap((migration) => readScopeLiteral(migration.path, migration.declaration)),
    ]);

    expect(MCP_OAUTH_SCOPES.filter((scope) => !granted.has(scope))).toEqual([]);
  });
});
