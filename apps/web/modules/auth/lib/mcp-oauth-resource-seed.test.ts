import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { isDeferredMcpOauthResourceSeedError, mcpOauthResourceSeedPlugin } from "./mcp-oauth-resource-seed";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "./oauth-urls";

vi.mock("@formbricks/database", () => ({
  prisma: {
    $executeRaw: vi.fn(),
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    WEBAPP_URL: "http://localhost:3000",
    BETTER_AUTH_URL: undefined,
    NEXTAUTH_URL: undefined,
    PUBLIC_URL: undefined,
  },
}));

const executeRawMock = vi.mocked(prisma.$executeRaw);

describe("mcpOauthResourceSeedPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeRawMock.mockResolvedValue(1);
  });

  test("uses one conflict-safe statement with the production resource and scope set", async () => {
    await mcpOauthResourceSeedPlugin.init?.();

    expect(executeRawMock).toHaveBeenCalledOnce();
    const [query, ...parameters] = executeRawMock.mock.calls[0];
    expect(Array.isArray(query)).toBe(true);
    if (!Array.isArray(query)) {
      throw new Error("Expected a tagged-template SQL query");
    }
    expect(query.join(" ")).toContain('ON CONFLICT ("identifier") DO NOTHING');
    expect(parameters).toContain(getMcpResourceUrl());
    expect(parameters).toContainEqual([...MCP_OAUTH_SCOPES]);
  });

  test.each([
    { code: "P1003" },
    { code: "P2021" },
    { meta: { driverAdapterError: { cause: { originalCode: "3D000" } } } },
    { meta: { driverAdapterError: { cause: { originalCode: "42P01" } } } },
    { message: 'relation "oauthResource" does not exist' },
  ])("defers when the database schema is not ready", async (error) => {
    executeRawMock.mockRejectedValueOnce(error);

    await expect(mcpOauthResourceSeedPlugin.init?.()).resolves.toBeUndefined();
  });

  test("propagates connectivity and permission failures", async () => {
    const error = Object.assign(new Error("connection refused"), { code: "P1001" });
    executeRawMock.mockRejectedValueOnce(error);

    await expect(mcpOauthResourceSeedPlugin.init?.()).rejects.toBe(error);
  });
});

describe("isDeferredMcpOauthResourceSeedError", () => {
  test.each([undefined, null, "P1003", { code: "P1001" }, new Error("permission denied")])(
    "does not hide unrelated errors",
    (error) => {
      expect(isDeferredMcpOauthResourceSeedError(error)).toBe(false);
    }
  );
});

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
