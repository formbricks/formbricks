import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { MCP_OAUTH_SCOPES } from "./oauth-urls";

/**
 * ENG-2343. The data migration seeds the `oauthResource` row for instances that already have MCP clients,
 * and it must carry the same `allowedScopes` the plugin would seed on a fresh install. It cannot import
 * that list — `packages/database` may not depend on `apps/web`, and the migration is not an exported
 * subpath — so it keeps a local copy, and this test is what makes the copy safe.
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

describe("the migration's seeded allowedScopes matches the advertised scope set (ENG-2343)", () => {
  test("is exactly MCP_OAUTH_SCOPES, in the same order", () => {
    expect(readSeededScopes()).toEqual([...MCP_OAUTH_SCOPES]);
  });

  // The failure mode that matters, stated on its own: a scope the app can grant that the resource row
  // would intersect away.
  test("allows every scope the app can grant", () => {
    const allowed = new Set(readSeededScopes());

    expect(MCP_OAUTH_SCOPES.filter((scope) => !allowed.has(scope))).toEqual([]);
  });
});
