import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { MCP_OAUTH_SCOPES } from "@/modules/auth/lib/oauth-urls";
// The data migration under test (auto-discovered by the migration runner at deploy).
import { grantAgentSetupScopes } from "../../../packages/database/migration/20261029100000_grant_agent_setup_scopes/migration";
import { grantMembersTeamsScopes } from "../../../packages/database/migration/20261029110000_grant_members_teams_scopes/migration";

/**
 * Agent-led setup scopes (ADR 0018) against real Postgres, the resource-row half. The failure it guards is
 * the one ENG-2862 described: `resolveResourcePolicy` *intersects* an authorize request against
 * `oauthResource.allowedScopes`, so a row left at the previous list drops `account:read`,
 * `workspaces:write`, `organizations:write` and `members:write` with no error anywhere, and the setup
 * tools are simply unreachable. The unit suite only proves the literal lists agree, not that an already
 * upgraded row is repaired.
 *
 * The runner supplies `run` with its interactive transaction; here `prisma` stands in, the same shape the
 * ENG-2862 suite uses.
 */
const runGrant = () => grantAgentSetupScopes.run!({ prisma, tx: prisma as never });

/** The list exactly as an instance that already ran the agent platform migration holds it. */
const PRE_SETUP_SCOPES = [
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
];

const SETUP_SCOPES = ["account:read", "workspaces:write", "organizations:write", "members:write"];

const seedResource = async (identifier: string, allowedScopes: string[]) =>
  prisma.oauthResource.create({
    data: { identifier, name: "Formbricks MCP", allowedScopes },
  });

const scopesOf = async (identifier: string): Promise<string[]> =>
  prisma.oauthResource
    .findUniqueOrThrow({ where: { identifier }, select: { allowedScopes: true } })
    .then((row) => row.allowedScopes);

describe("agent setup scope grant on the oauthResource row", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("appends the four setup scopes to a row left behind by the agent platform migration", async () => {
    const identifier = "https://app.example.com/api/mcp";
    await seedResource(identifier, PRE_SETUP_SCOPES);

    await runGrant();

    // Appended, not reordered: everything the row already allowed is still there, in order.
    expect(await scopesOf(identifier)).toEqual([...PRE_SETUP_SCOPES, ...SETUP_SCOPES]);
  });

  test("leaves the row able to grant every scope the app advertises", async () => {
    const identifier = "https://app.example.com/api/mcp";
    await seedResource(identifier, PRE_SETUP_SCOPES);

    // Every repair after the platform migration has to have run for the row to cover the whole list.
    await runGrant();
    await grantMembersTeamsScopes.run!({ prisma, tx: prisma as never });

    const allowed = new Set(await scopesOf(identifier));
    expect(MCP_OAUTH_SCOPES.filter((scope) => !allowed.has(scope))).toEqual([]);
  });

  test("is idempotent: a second run changes nothing", async () => {
    const identifier = "https://app.example.com/api/mcp";
    await seedResource(identifier, PRE_SETUP_SCOPES);

    await runGrant();
    const afterFirst = await scopesOf(identifier);
    await runGrant();

    expect(await scopesOf(identifier)).toEqual(afterFirst);
  });

  test("adds only what is missing when some of the scopes are already present", async () => {
    const identifier = "https://app.example.com/api/mcp";
    await seedResource(identifier, [...PRE_SETUP_SCOPES, "account:read", "members:write"]);

    await runGrant();

    const scopes = await scopesOf(identifier);
    for (const scope of SETUP_SCOPES) {
      expect(
        scopes.filter((entry) => entry === scope),
        scope
      ).toHaveLength(1);
    }
  });

  test("leaves a non-MCP resource alone", async () => {
    const mcp = "https://app.example.com/api/mcp";
    const other = "https://app.example.com/api/something-else";
    await seedResource(mcp, PRE_SETUP_SCOPES);
    await seedResource(other, ["surveys:read"]);

    await runGrant();

    expect(await scopesOf(other)).toEqual(["surveys:read"]);
    expect(await scopesOf(mcp)).toContain("members:write");
  });

  test("is a no-op on a fresh database, as the migration harness requires", async () => {
    await expect(runGrant()).resolves.not.toThrow();
    expect(await prisma.oauthResource.count()).toBe(0);
  });
});
