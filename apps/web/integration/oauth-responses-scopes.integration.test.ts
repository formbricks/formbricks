import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { MCP_OAUTH_SCOPES } from "@/modules/auth/lib/oauth-urls";
// The data migration under test (auto-discovered by the migration runner at deploy).
import { eng2862GrantResponsesScopes } from "../../../packages/database/migration/20260915120000_eng_2862_grant_responses_scopes/migration";

/**
 * ENG-2862 against real Postgres. This migration exists because the failure it prevents is silent:
 * `resolveResourcePolicy` *intersects* an authorize request against `oauthResource.allowedScopes`, so a
 * row stuck at the pre-ENG-2862 list drops `responses:*` with no error anywhere — the operator sees a
 * working MCP server whose response tools are simply missing. Nothing in the unit suite can catch a
 * broken `UPDATE`, and the sibling seed test only proves the *literal lists* agree, not that an already
 * upgraded row is repaired.
 *
 * The runner supplies `run` with its interactive transaction; here `prisma` stands in, the same shape
 * the credential-backfill and repair-account-issuer tests use.
 */
const runGrant = () => eng2862GrantResponsesScopes.run!({ prisma, tx: prisma as never });

/** The scope list exactly as it stood before this change — what an upgraded instance actually holds. */
const PRE_ENG2862_SCOPES = [
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

const seedResource = async (identifier: string, allowedScopes: string[]) =>
  prisma.oauthResource.create({
    data: { identifier, name: "Formbricks MCP", allowedScopes },
  });

const scopesOf = async (identifier: string): Promise<string[]> =>
  prisma.oauthResource
    .findUniqueOrThrow({ where: { identifier }, select: { allowedScopes: true } })
    .then((row) => row.allowedScopes);

describe("ENG-2862 responses scope grant", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("adds both scopes to a resource row left behind by the ENG-2343 backfill", async () => {
    const identifier = "https://app.example.com/api/mcp";
    await seedResource(identifier, PRE_ENG2862_SCOPES);

    await runGrant();

    // Appended, not reordered: everything the row already allowed is still there, in order.
    expect(await scopesOf(identifier)).toEqual([...PRE_ENG2862_SCOPES, "responses:read", "responses:write"]);
  });

  test("leaves the row able to grant every scope the app advertises", async () => {
    // The property that actually matters, stated independently of ordering: after the migration no
    // scope the app can grant is intersected away.
    const identifier = "https://app.example.com/api/mcp";
    await seedResource(identifier, PRE_ENG2862_SCOPES);

    await runGrant();

    const allowed = new Set(await scopesOf(identifier));
    expect(MCP_OAUTH_SCOPES.filter((scope) => !allowed.has(scope))).toEqual([]);
  });

  test("is idempotent — a second run changes nothing", async () => {
    const identifier = "https://app.example.com/api/mcp";
    await seedResource(identifier, PRE_ENG2862_SCOPES);

    await runGrant();
    const afterFirst = await scopesOf(identifier);
    await runGrant();

    expect(await scopesOf(identifier)).toEqual(afterFirst);
  });

  test("adds only what is missing when one of the two is already present", async () => {
    const identifier = "https://app.example.com/api/mcp";
    await seedResource(identifier, [...PRE_ENG2862_SCOPES, "responses:read"]);

    await runGrant();

    const scopes = await scopesOf(identifier);
    expect(scopes.filter((scope) => scope === "responses:read")).toHaveLength(1);
    expect(scopes).toContain("responses:write");
  });

  test("leaves a non-MCP resource alone", async () => {
    const mcp = "https://app.example.com/api/mcp";
    const other = "https://app.example.com/api/something-else";
    await seedResource(mcp, PRE_ENG2862_SCOPES);
    await seedResource(other, ["surveys:read"]);

    await runGrant();

    expect(await scopesOf(other)).toEqual(["surveys:read"]);
    expect(await scopesOf(mcp)).toContain("responses:write");
  });

  test("leaves a NULL allowedScopes untouched rather than half-repairing it", async () => {
    // Not because NULL is permissive — it is not. Prisma types the field `String[]`, so a genuinely
    // NULL column reads back as `[]`, and an empty allow-list intersects every request down to zero
    // scopes (ENG-2343). Such a row is already broken for every scope, which is a different fix from
    // this one and is not reachable through the product: the DDL defaults to `[]` and Prisma never
    // writes NULL, so only hand-written SQL produces one.
    //
    // The migration still must not touch it. `@>` against NULL yields NULL so the WHERE never matches,
    // and `NULL || ARRAY[…]` is NULL so appending could not repair it anyway. Coalescing to `'{}'` is
    // the tempting "fix" that makes things worse: the append compares against the original NULL column,
    // `= ANY(NULL)` is NULL, nothing is appended, and the row is left at an empty list — the same
    // instance-down state, now made permanent. This is the test that catches that mutation.
    const identifier = "https://app.example.com/api/mcp";
    await prisma.$executeRawUnsafe(
      `INSERT INTO "oauthResource" ("id", "identifier", "name", "allowedScopes") VALUES ($1, $2, $3, NULL)`,
      "clnullscope000000000001",
      identifier,
      "Formbricks MCP"
    );

    await runGrant();

    const [row] = await prisma.$queryRawUnsafe<{ allowedScopes: string[] | null }[]>(
      `SELECT "allowedScopes" FROM "oauthResource" WHERE "identifier" = $1`,
      identifier
    );
    expect(row.allowedScopes).toBeNull();
  });

  test("is a no-op on a fresh database, as the migration harness requires", async () => {
    await expect(runGrant()).resolves.not.toThrow();
    expect(await prisma.oauthResource.count()).toBe(0);
  });
});
