import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { MCP_OAUTH_SCOPES } from "@/modules/auth/lib/oauth-urls";
// The data migrations under test (auto-discovered by the migration runner at deploy). The first two are
// what an instance upgrading from before round 3 has already run.
import { grantAgentSetupScopes } from "../../../packages/database/migration/20261029100000_grant_agent_setup_scopes/migration";
import { grantMembersTeamsScopes } from "../../../packages/database/migration/20261029110000_grant_members_teams_scopes/migration";

/**
 * Members and teams scopes (ADR 0018, round 3) against real Postgres, the resource-row half. Same failure as
 * ENG-2862: `resolveResourcePolicy` intersects an authorize request against `oauthResource.allowedScopes`, so
 * a row left at the previous list drops `members:read`, `teams:read` and `teams:write` with no error anywhere
 * and `list_members`, `list_teams` and the team tools are simply unreachable.
 *
 * The runner supplies `run` with its interactive transaction; here `prisma` stands in.
 */
const runGrant = () => grantMembersTeamsScopes.run!({ prisma, tx: prisma as never });

/** The list exactly as an instance that already ran the agent setup migration holds it. */
const PRE_ROUND_3_SCOPES = [
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
  "responses:read",
  "responses:write",
  "contacts:read",
  "contacts:write",
  "webhooks:read",
  "webhooks:write",
  "audit:read",
  "account:read",
  "workspaces:write",
  "organizations:write",
  "members:write",
];

const NEW_SCOPES = ["members:read", "teams:read", "teams:write"];

const seedResource = async (identifier: string, allowedScopes: string[]) =>
  prisma.oauthResource.create({
    data: { identifier, name: "Formbricks MCP", allowedScopes },
  });

const scopesOf = async (identifier: string): Promise<string[]> =>
  prisma.oauthResource
    .findUniqueOrThrow({ where: { identifier }, select: { allowedScopes: true } })
    .then((row) => row.allowedScopes);

describe("members and teams scope grant on the oauthResource row", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("appends the three scopes to a row left behind by the agent setup migration", async () => {
    const identifier = "https://app.example.com/api/mcp";
    await seedResource(identifier, PRE_ROUND_3_SCOPES);

    await runGrant();

    // Appended, not reordered: everything the row already allowed is still there, in order.
    expect(await scopesOf(identifier)).toEqual([...PRE_ROUND_3_SCOPES, ...NEW_SCOPES]);
  });

  test("an instance that skipped straight from the agent platform migration ends with every scope too", async () => {
    const identifier = "https://app.example.com/api/mcp";
    await seedResource(
      identifier,
      PRE_ROUND_3_SCOPES.filter(
        (scope) =>
          !["account:read", "workspaces:write", "organizations:write", "members:write"].includes(scope)
      )
    );

    await grantAgentSetupScopes.run!({ prisma, tx: prisma as never });
    await runGrant();

    const allowed = new Set(await scopesOf(identifier));
    expect(MCP_OAUTH_SCOPES.filter((scope) => !allowed.has(scope))).toEqual([]);
  });

  test("leaves the row able to grant every scope the app advertises", async () => {
    const identifier = "https://app.example.com/api/mcp";
    await seedResource(identifier, PRE_ROUND_3_SCOPES);

    await runGrant();

    const allowed = new Set(await scopesOf(identifier));
    expect(MCP_OAUTH_SCOPES.filter((scope) => !allowed.has(scope))).toEqual([]);
  });

  test("is idempotent: a second run changes nothing", async () => {
    const identifier = "https://app.example.com/api/mcp";
    await seedResource(identifier, PRE_ROUND_3_SCOPES);

    await runGrant();
    const afterFirst = await scopesOf(identifier);
    await runGrant();

    expect(await scopesOf(identifier)).toEqual(afterFirst);
  });

  test("adds only what is missing when some of the scopes are already present", async () => {
    const identifier = "https://app.example.com/api/mcp";
    await seedResource(identifier, [...PRE_ROUND_3_SCOPES, "teams:read"]);

    await runGrant();

    const scopes = await scopesOf(identifier);
    for (const scope of NEW_SCOPES) {
      expect(
        scopes.filter((entry) => entry === scope),
        scope
      ).toHaveLength(1);
    }
  });

  test("leaves a non-MCP resource alone", async () => {
    const mcp = "https://app.example.com/api/mcp";
    const other = "https://app.example.com/api/something-else";
    await seedResource(mcp, PRE_ROUND_3_SCOPES);
    await seedResource(other, ["surveys:read"]);

    await runGrant();

    expect(await scopesOf(other)).toEqual(["surveys:read"]);
    expect(await scopesOf(mcp)).toContain("teams:write");
  });

  test("is a no-op on a fresh database, as the migration harness requires", async () => {
    await expect(runGrant()).resolves.not.toThrow();
    expect(await prisma.oauthResource.count()).toBe(0);
  });
});
