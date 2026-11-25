import { decodeJwt } from "jose";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import {
  type TMcpToolCallOutcome,
  callMcpTool,
  serveJwksFromAuthHandler,
  succeeded,
  toolText,
} from "@/integration/mcp-client";
import {
  approve,
  authorize,
  createUser,
  exchangeCode,
  grant,
  refresh,
  registerClient,
  signIn,
  waitPastRevocation,
} from "@/integration/oauth-flow";
import { lockUserRow, waitForBlockOn } from "@/integration/postgres-locks";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { revokeAllUserOAuthGrants, revokeMcpClient } from "@/modules/auth/lib/mcp-grant-revocation";
import { mcpGrantAccessTokenClaims } from "@/modules/auth/lib/mcp-grant-token-claim";
import { markOAuthRevocation } from "@/modules/auth/lib/oauth-revocation-marker";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { revokeCredentials } from "@/modules/ee/data-retention/sweep/members-sweeper";
import { createApiKey } from "@/modules/organization/settings/api-keys/lib/api-key";
// The data migration under test (auto-discovered by the migration runner at deploy).
import { backfillMcpGrants } from "../../../../packages/database/migration/20261112120001_backfill_mcp_grants/migration";
import type { TMcpGrantPermissions } from "./grant";
import { getMcpGrant, lockMcpGrant, writeMcpGrant } from "./grant-store";

/**
 * ENG-7149 against the real Better Auth instance, Postgres and SpiceDB: every MCP connection has a grant,
 * and every tool call through `/api/mcp` is held to it. Tokens come from the real OAuth flow (DCR,
 * authorize, consent, code exchange) and every call goes through the route, as a client's would.
 *
 * A grant narrower than the client's scopes is set with `writeMcpGrant`, the store Authorized apps' Edit
 * will write through (ENG-7152), since no screen sets one yet.
 */

vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>()),
  queueAuditEventBackground: vi.fn(async () => undefined),
}));

/** A survey `patch_survey` accepts: the v3 contract needs at least one block. */
const BLOCKS = [
  {
    id: "clbk1234567890123456789099",
    name: "Main Block",
    elements: [
      {
        id: "improve",
        type: "openText",
        headline: { default: "What should we improve?" },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

// The real grant claim, which a test can turn off for one token to mint one as the previous release did.
vi.mock("@/modules/auth/lib/mcp-grant-token-claim", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/auth/lib/mcp-grant-token-claim")>();
  return { ...actual, mcpGrantAccessTokenClaims: vi.fn(actual.mcpGrantAccessTokenClaims) };
});

const PASSWORD = "Correct-Horse1";
const EMAIL = "mcp-grants@example.com";
const EVERYTHING = MCP_OAUTH_SCOPES.join(" ");

type TSetup = {
  cookie: string;
  userId: string;
  organizationId: string;
  workspaceId: string;
  surveyId: string;
  clientId: string;
};

/**
 * The one account of a test (sign-up is only open on an instance with no users) in one organization with
 * one workspace and a draft survey. `role` is the user's own standing: an owner, or a member whose team
 * only reads the workspace.
 */
const setUp = async (role: "owner" | "readOnlyMember" = "owner"): Promise<TSetup> => {
  await resetDb();
  await prisma.oauthResource.createMany({
    data: [{ identifier: getMcpResourceUrl(), name: "Formbricks MCP", allowedScopes: [...MCP_OAUTH_SCOPES] }],
    skipDuplicates: true,
  });
  await createUser(EMAIL, PASSWORD, "Grant owner");
  const { cookie, userId } = await signIn(EMAIL, PASSWORD);
  const organization = await prisma.organization.create({ data: { name: "Grants org" } });
  await prisma.membership.create({
    data: {
      userId,
      organizationId: organization.id,
      role: role === "owner" ? "owner" : "member",
      accepted: true,
    },
  });
  const workspace = await prisma.workspace.create({
    data: { name: "Grants", organizationId: organization.id },
  });
  if (role === "readOnlyMember") {
    const team = await prisma.team.create({ data: { name: "Readers", organizationId: organization.id } });
    await prisma.teamUser.create({ data: { role: "contributor", teamId: team.id, userId } });
    await prisma.workspaceTeam.create({
      data: { permission: "read", teamId: team.id, workspaceId: workspace.id },
    });
  }
  const survey = await prisma.survey.create({
    data: { name: "Draft", type: "link", workspaceId: workspace.id, blocks: BLOCKS as never },
  });
  await synchronizeAuthzedIntegrationFixture();
  const clientId = await registerClient("grants client");
  return {
    cookie,
    userId,
    organizationId: organization.id,
    workspaceId: workspace.id,
    surveyId: survey.id,
    clientId,
  };
};

const setGrant = (setup: TSetup, permissions: TMcpGrantPermissions) =>
  prisma.$transaction(async (tx) => {
    const ids = { userId: setup.userId, clientId: setup.clientId };
    return writeMcpGrant(tx, { ...ids, before: await lockMcpGrant(tx, ids), permissions });
  });

const listSurveys = (accessToken: string, setup: TSetup) =>
  callMcpTool({ accessToken }, "list_surveys", { workspaceId: setup.workspaceId });

const renameSurvey = (accessToken: string, setup: TSetup) =>
  callMcpTool({ accessToken }, "patch_survey", { surveyId: setup.surveyId, data: { name: "Renamed" } });

const archiveSurvey = (accessToken: string, setup: TSetup) =>
  callMcpTool({ accessToken }, "archive_survey", { surveyId: setup.surveyId });

const restoreSurvey = (accessToken: string, setup: TSetup) =>
  callMcpTool({ accessToken }, "restore_survey", { surveyId: setup.surveyId });

const deleteSurvey = (accessToken: string, setup: TSetup) =>
  callMcpTool({ accessToken }, "delete_survey", { surveyId: setup.surveyId, confirm: true });

/** The problem a refused tool answered with; a tool result carries it under `error`. */
const problemOf = (outcome: TMcpToolCallOutcome) =>
  (JSON.parse(toolText(outcome)) as { error: { status: number; code: string; detail: string } }).error;

/** A tool the grant refused: a 403 tool result naming what the grant would have to give. */
const expectNotPermitted = (outcome: TMcpToolCallOutcome, needs: string) => {
  expect(outcome.result?.isError, toolText(outcome)).toBe(true);
  const problem = problemOf(outcome);
  expect(problem).toMatchObject({ status: 403, code: "forbidden" });
  expect(problem.detail).toMatch(/^Not permitted: /);
  expect(problem.detail).toContain(needs);
};

/** A request refused before any tool ran, the way an expired or revoked token is. */
const expectUnauthenticated = (outcome: TMcpToolCallOutcome) => {
  expect(outcome.status).toBe(401);
  expect(outcome.result).toBeUndefined();
};

beforeAll(() => {
  serveJwksFromAuthHandler();
});

describe("a connection's grant", () => {
  let setup: TSetup;
  beforeEach(async () => {
    vi.mocked(queueAuditEventBackground).mockClear();
    setup = await setUp();
  }, 120_000);

  test("Allow creates the grant at the levels the client asked for, and audits it", async () => {
    await grant(setup.cookie, setup.clientId, "openid offline_access surveys:read responses:write");

    const stored = await getMcpGrant(setup.userId, setup.clientId);
    expect(stored).toMatchObject({
      access: "all",
      permissions: {
        surveys: "read",
        creatives: "read",
        surveyStyling: "read",
        responses: "write",
        tags: "write",
      },
    });
    expect(Object.keys(stored?.permissions ?? {}).sort()).toEqual(
      ["creatives", "responses", "surveyStyling", "surveys", "tags"].sort()
    );
    expect(queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "created",
        targetType: "mcpGrant",
        targetId: stored?.id,
        userId: setup.userId,
        organizationId: setup.organizationId,
        status: "success",
        oldObject: null,
        newObject: {
          before: null,
          after: expect.objectContaining({
            clientId: setup.clientId,
            access: "all",
            // Every permission is spelled out, No access included.
            permissions: expect.objectContaining({ surveys: "read", tags: "write", contacts: "none" }),
          }),
        },
      })
    );
  });

  test("No access refuses the permission's tools, naming the permission and level", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    await setGrant(setup, { responses: "write" });

    expectNotPermitted(await listSurveys(access_token, setup), "Surveys: Read");
  });

  test("Read reads but can't write, archive or delete", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    await setGrant(setup, { surveys: "read" });

    expect(succeeded(await listSurveys(access_token, setup))).toBe(true);
    expectNotPermitted(await renameSurvey(access_token, setup), "Surveys: Write");
    expectNotPermitted(await archiveSurvey(access_token, setup), "Surveys: Write");
    expectNotPermitted(await deleteSurvey(access_token, setup), "Surveys: Write");
    expect(await prisma.survey.findUnique({ where: { id: setup.surveyId } })).toMatchObject({
      name: "Draft",
      archivedAt: null,
    });

    await prisma.survey.update({ where: { id: setup.surveyId }, data: { archivedAt: new Date() } });
    expectNotPermitted(await restoreSurvey(access_token, setup), "Surveys: Write");
    expect((await prisma.survey.findUnique({ where: { id: setup.surveyId } }))?.archivedAt).toBeInstanceOf(
      Date
    );
  });

  test("Write reads, writes, archives, restores and deletes", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    await setGrant(setup, { surveys: "write" });

    expect(succeeded(await listSurveys(access_token, setup))).toBe(true);
    const renamed = await renameSurvey(access_token, setup);
    expect(succeeded(renamed), toolText(renamed)).toBe(true);
    const archived = await archiveSurvey(access_token, setup);
    expect(succeeded(archived), toolText(archived)).toBe(true);
    expect(await prisma.survey.findUnique({ where: { id: setup.surveyId } })).toMatchObject({
      archivedAt: expect.any(Date),
    });

    const restored = await restoreSurvey(access_token, setup);
    expect(succeeded(restored), toolText(restored)).toBe(true);
    expect(await prisma.survey.findUnique({ where: { id: setup.surveyId } })).toMatchObject({
      archivedAt: null,
    });

    const deleted = await deleteSurvey(access_token, setup);
    expect(succeeded(deleted), toolText(deleted)).toBe(true);
    expect(await prisma.survey.findUnique({ where: { id: setup.surveyId } })).toBeNull();
  });

  test("a narrowed grant applies to the next call with the same token", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    expect(succeeded(await renameSurvey(access_token, setup))).toBe(true);

    await setGrant(setup, { surveys: "read" });

    expectNotPermitted(await renameSurvey(access_token, setup), "Surveys: Write");
  });

  test("the token's scopes still cap the grant", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, "openid surveys:read");
    await setGrant(setup, { surveys: "write" });

    const renamed = await renameSurvey(access_token, setup);
    expect(renamed.result?.isError).toBe(true);
    expect(toolText(renamed)).toContain("surveys:write");
  });

  test("Revoke deletes the consent and the grant, audits it, and the next call is refused", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    expect(succeeded(await listSurveys(access_token, setup))).toBe(true);
    const grantId = (await getMcpGrant(setup.userId, setup.clientId))?.id;
    const consent = await prisma.oauthConsent.findFirstOrThrow({
      where: { userId: setup.userId, clientId: setup.clientId },
    });

    await auth.api.deleteOAuthConsent({
      body: { id: consent.id },
      headers: new Headers({ cookie: setup.cookie }),
    });

    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
    expect(await prisma.oauthConsent.count({ where: { userId: setup.userId } })).toBe(0);
    expectUnauthenticated(await listSurveys(access_token, setup));
    expect(queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deleted",
        targetType: "mcpGrant",
        targetId: grantId,
        userId: setup.userId,
        organizationId: setup.organizationId,
        newObject: { before: expect.objectContaining({ clientId: setup.clientId }), after: null },
      })
    );
  });

  // A reconciling pass holds the grant row FOR SHARE across its SpiceDB calls, for up to 30 s. Revoke
  // waits that out rather than fail at the app client's 20-second transaction budget.
  test("Revoke waits for a reconciling pass holding the grant row, rather than timing out", async () => {
    await grant(setup.cookie, setup.clientId, EVERYTHING);
    const grantId = (await getMcpGrant(setup.userId, setup.clientId))?.id as string;

    let revoked: ReturnType<typeof revokeMcpClient> | undefined;
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "McpGrant" WHERE "id" = ${grantId} FOR SHARE`;
        revoked = revokeMcpClient({ userId: setup.userId, clientId: setup.clientId });
        await waitForBlockOn(tx);
        // Longer than the app client's 20-second transaction budget (APP_TRANSACTION_TIMEOUT_MS).
        await new Promise((resolve) => setTimeout(resolve, 21_000));
      },
      { timeout: 30_000 }
    );

    await expect(revoked).resolves.not.toBeNull();
    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
  }, 60_000);

  // N3: the token endpoint's before-hook accepts a code, then a Revoke and a new approval land before the
  // claim names the grant. The claim must not name the replacement grant for a code issued before the
  // Revoke: it re-checks the mark, under the user's row a revocation holds, and names none.
  test("a code issued before a Revoke never names the grant a later approval made", async () => {
    await grant(setup.cookie, setup.clientId, EVERYTHING);
    const pending = await authorize(setup.cookie, setup.clientId, EVERYTHING);
    const code = pending.target.searchParams.get("code") as string;
    expect(code, pending.target.toString()).toBeTruthy();

    let exchanged: ReturnType<typeof exchangeCode> | undefined;
    let replacementId = "";
    await prisma.$transaction(
      async (tx) => {
        await lockUserRow(tx, setup.userId);
        exchanged = exchangeCode(setup.clientId, code, pending.verifier);
        await waitForBlockOn(tx);
        // What Revoke then a new approval leave behind: the mark, and a new grant for the client.
        await markOAuthRevocation({ userId: setup.userId, clientId: setup.clientId });
        await tx.mcpGrant.deleteMany({ where: { userId: setup.userId, clientId: setup.clientId } });
        replacementId = (
          await tx.mcpGrant.create({
            data: {
              userId: setup.userId,
              clientId: setup.clientId,
              access: "all",
              permissions: { surveys: "read" },
            },
            select: { id: true },
          })
        ).id;
      },
      { timeout: 15_000 }
    );

    const response = await (exchanged as ReturnType<typeof exchangeCode>);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const claim = decodeJwt(response.body.access_token as string).mcp_grant;
    expect(claim).not.toBe(replacementId);
    expect(claim).toBeNull();
  });

  // The provider has spent the code by the time the claim reads the grant, so the exchange can't fail. With
  // the user's row held past the claim's 2 s lock timeout (a slow Revoke or member removal), the claim gives
  // up rather than holding the exchange for the Revoke's 35 s budget, and the token names no grant: it is
  // refused until the client authorizes again. (The provider's own token insert, whose foreign key takes
  // the user's row `FOR KEY SHARE`, still waits for the row; that wait is upstream's.)
  test("a code exchanged while the user's row is held past the lock timeout names no grant", async () => {
    await grant(setup.cookie, setup.clientId, EVERYTHING);
    const pending = await authorize(setup.cookie, setup.clientId, EVERYTHING);
    const code = pending.target.searchParams.get("code") as string;
    expect(code, pending.target.toString()).toBeTruthy();

    let exchanged: ReturnType<typeof exchangeCode> | undefined;
    await prisma.$transaction(
      async (tx) => {
        await lockUserRow(tx, setup.userId);
        exchanged = exchangeCode(setup.clientId, code, pending.verifier);
        await waitForBlockOn(tx);
        // Past the claim's 2 s lock timeout: what is being tested is that wait running out.
        await new Promise((resolve) => setTimeout(resolve, 2_500));
      },
      { timeout: 15_000 }
    );

    const response = await (exchanged as ReturnType<typeof exchangeCode>);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const accessToken = response.body.access_token as string;
    // The user still has the grant: only the lock timeout can have left the claim empty.
    expect(await getMcpGrant(setup.userId, setup.clientId)).not.toBeNull();
    expect(decodeJwt(accessToken).mcp_grant).toBeNull();
    expectUnauthenticated(await listSurveys(accessToken, setup));
  });

  // The grant is keyed on the user and the client, so approving the client again after Revoke makes a new
  // one under the same key. A token from before the Revoke must stay refused: it was ended with the old one.
  test("a token minted before Revoke stays refused after the user approves the client again", async () => {
    const before = await grant(setup.cookie, setup.clientId, EVERYTHING);
    expect(await revokeMcpClient({ userId: setup.userId, clientId: setup.clientId })).not.toBeNull();
    // A sign-in code issued within the skew of the Revoke is refused, so the new approval waits that out.
    await waitPastRevocation();

    const after = await grant(setup.cookie, setup.clientId, EVERYTHING);

    expectUnauthenticated(await listSurveys(before.access_token, setup));
    expect(succeeded(await listSurveys(after.access_token, setup))).toBe(true);
  });

  // N3 (round 5): a refresh in flight while a Revoke and a new approval commit can rotate a token the
  // Revoke's token update missed, then find the new grant and consent in place. What decides is the mark:
  // a presented refresh token issued before it was revoked, whatever grant stands now.
  test("a refresh presenting a token from before a Revoke is refused, though a new grant stands", async () => {
    const before = await grant(setup.cookie, setup.clientId, EVERYTHING);
    // What the Revoke and the new approval leave behind when the Revoke's token update missed this token:
    // the mark, a replacement grant, and the consent the approval wrote.
    await markOAuthRevocation({ userId: setup.userId, clientId: setup.clientId });
    const replaced = await getMcpGrant(setup.userId, setup.clientId);
    await prisma.mcpGrant.delete({ where: { id: replaced!.id } });
    await prisma.mcpGrant.create({
      data: {
        userId: setup.userId,
        clientId: setup.clientId,
        access: "all",
        permissions: replaced!.permissions,
      },
    });

    const refused = await refresh(setup.clientId, before.refresh_token);
    expect(refused.status, JSON.stringify(refused.body)).toBe(400);
    expect(refused.body).toMatchObject({ error: "invalid_grant" });

    // The new approval's own tokens, issued after the mark, keep refreshing.
    await waitPastRevocation();
    const after = await grant(setup.cookie, setup.clientId, EVERYTHING);
    expect((await refresh(setup.clientId, after.refresh_token)).status).toBe(200);
  });

  // Issue times count whole seconds and come from each pod's clock, so they can't tell an old token from a
  // new grant made in the same second, or on a pod whose clock runs behind. The grant a token was issued
  // under can: here the new grant is dated in the old token's own second.
  test("a token stays refused under a new grant made in the second it was issued", async () => {
    const before = await grant(setup.cookie, setup.clientId, EVERYTHING);
    const issuedAt = new Date((decodeJwt(before.access_token).iat as number) * 1000);
    const old = await getMcpGrant(setup.userId, setup.clientId);
    await prisma.mcpGrant.delete({ where: { id: old!.id } });
    await prisma.mcpGrant.create({
      data: {
        userId: setup.userId,
        clientId: setup.clientId,
        access: "all",
        permissions: old!.permissions,
        createdAt: issuedAt,
      },
    });

    expectUnauthenticated(await listSurveys(before.access_token, setup));
  });

  // A token minted while its connection had no grant names none (`mcp_grant: null`), so a grant made for
  // the connection later, even in the token's own second, doesn't take it in. Only a token from the
  // previous release, with no claim at all, is checked by its issue time.
  test("a token minted while the connection had no grant stays refused once one is made", async () => {
    const { code, verifier } = await approve(setup.cookie, setup.clientId, EVERYTHING);
    const old = await getMcpGrant(setup.userId, setup.clientId);
    await prisma.mcpGrant.deleteMany({ where: { userId: setup.userId } });
    const exchanged = await exchangeCode(setup.clientId, code, verifier);
    const accessToken = exchanged.body.access_token as string;
    expect(decodeJwt(accessToken)).toHaveProperty("mcp_grant", null);

    await prisma.mcpGrant.create({
      data: {
        userId: setup.userId,
        clientId: setup.clientId,
        access: "all",
        permissions: old!.permissions,
        createdAt: new Date((decodeJwt(accessToken).iat as number) * 1000),
      },
    });

    expectUnauthenticated(await listSurveys(accessToken, setup));
  });

  // The control for the skipConsent case (mcp-skip-consent-grant.integration.test.ts): a consent client's
  // pending code, issued before Revoke, is refused at the exchange too, and so after every bulk end.
  test.each([
    ["Revoke", (setup: TSetup) => revokeMcpClient({ userId: setup.userId, clientId: setup.clientId })],
    [
      "ending every grant the user holds",
      (setup: TSetup) => prisma.$transaction((tx) => revokeAllUserOAuthGrants(tx, setup.userId)),
    ],
  ])("a sign-in code issued before %s is refused at the exchange", async (_case, end) => {
    await grant(setup.cookie, setup.clientId, EVERYTHING);
    // The consent already covers the scopes, so authorize answers with a code at once.
    const pending = await authorize(setup.cookie, setup.clientId, EVERYTHING);
    const code = pending.target.searchParams.get("code");
    expect(code, pending.target.toString()).toBeTruthy();

    await end(setup);
    const exchanged = await exchangeCode(setup.clientId, code as string, pending.verifier);

    expect(exchanged.body.error, JSON.stringify(exchanged.body)).toBe("invalid_grant");
    expect(await prisma.oauthRefreshToken.count({ where: { userId: setup.userId, revoked: null } })).toBe(0);
  });

  test("ending every grant a user holds (deactivation, SSO recovery) refuses the next call", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);

    const revoked = await prisma.$transaction((tx) => revokeAllUserOAuthGrants(tx, setup.userId));

    expect(revoked.grantsDeleted).toBe(1);
    expectUnauthenticated(await listSurveys(access_token, setup));
  });

  test("a deactivated member's grants end with one audit entry each, by the system, under their organization", async () => {
    await grant(setup.cookie, setup.clientId, EVERYTHING);
    const grantId = (await getMcpGrant(setup.userId, setup.clientId))?.id;
    await prisma.user.update({ where: { id: setup.userId }, data: { isActive: false } });
    vi.mocked(queueAuditEventBackground).mockClear();

    await revokeCredentials(setup.userId);

    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
    expect(queueAuditEventBackground).toHaveBeenCalledTimes(1);
    expect(queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deleted",
        targetType: "mcpGrant",
        targetId: grantId,
        userId: "system",
        userType: "system",
        organizationId: setup.organizationId,
        newObject: {
          before: expect.objectContaining({ clientId: setup.clientId, access: "all" }),
          after: null,
        },
      })
    );
  });

  test("a connection with no grant is refused, and its refresh ends it", async () => {
    const { access_token, refresh_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    await prisma.mcpGrant.deleteMany({ where: { userId: setup.userId } });

    expectUnauthenticated(await listSurveys(access_token, setup));

    // The refresh is refused and the consent goes, so the client's next authorize shows the consent
    // screen again and Allow writes a grant, instead of skipping it on a consent with no grant.
    const refreshed = await refresh(setup.clientId, refresh_token);
    expect(refreshed.status).toBe(400);
    expect(refreshed.body).toMatchObject({ error: "invalid_grant" });
    expect(await prisma.oauthConsent.count({ where: { userId: setup.userId } })).toBe(0);
  });

  test("a refresh of a connection with a grant still works", async () => {
    const { refresh_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);

    const refreshed = await refresh(setup.clientId, refresh_token);

    expect(refreshed.status, JSON.stringify(refreshed.body)).toBe(200);
    expect(succeeded(await listSurveys(refreshed.body.access_token as string, setup))).toBe(true);
  });

  test("calls with an API key have no grant and work as before", async () => {
    const { actualKey } = await createApiKey(setup.organizationId, setup.userId, {
      label: "mcp",
      workspacePermissions: [{ workspaceId: setup.workspaceId, permission: "write" }],
      organizationAccess: { accessControl: { read: false, write: false } },
    });
    await synchronizeAuthzedIntegrationFixture();

    const listed = await callMcpTool({ apiKey: actualKey }, "list_surveys", {
      workspaceId: setup.workspaceId,
    });
    expect(succeeded(listed), toolText(listed)).toBe(true);
    const renamed = await callMcpTool({ apiKey: actualKey }, "patch_survey", {
      surveyId: setup.surveyId,
      data: { name: "By key" },
    });
    expect(succeeded(renamed), toolText(renamed)).toBe(true);
  });
});

describe("the user's own role caps the grant", () => {
  test("a Write grant can't write where the user may only read", async () => {
    const setup = await setUp("readOnlyMember");
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    expect((await getMcpGrant(setup.userId, setup.clientId))?.permissions.surveys).toBe("write");

    expect(succeeded(await listSurveys(access_token, setup))).toBe(true);
    const renamed = await renameSurvey(access_token, setup);
    expect(renamed.result?.isError).toBe(true);
    const problem = problemOf(renamed);
    expect(problem).toMatchObject({ status: 403, code: "forbidden" });
    expect(problem.detail).not.toMatch(/^Not permitted/);
    expect(await prisma.survey.findUnique({ where: { id: setup.surveyId } })).toMatchObject({
      name: "Draft",
    });
  }, 120_000);
});

describe("connections from before grants existed", () => {
  const runBackfill = () => backfillMcpGrants.run!({ prisma: prisma as never, tx: prisma as never });

  test("keep the access their scopes gave, with Tags at No access, and their tokens keep working", async () => {
    const setup = await setUp();
    // What an upgraded instance holds: a consent, no grant, and an access token without the grant claim,
    // issued by the previous release a while after the connection was made.
    const { code, verifier } = await approve(setup.cookie, setup.clientId, EVERYTHING);
    await prisma.mcpGrant.deleteMany({ where: { userId: setup.userId } });
    // The previous release minted tokens without the grant claim.
    vi.mocked(mcpGrantAccessTokenClaims).mockResolvedValueOnce({});
    const exchanged = await exchangeCode(setup.clientId, code, verifier);
    const accessToken = exchanged.body.access_token as string;
    expect(decodeJwt(accessToken)).not.toHaveProperty("mcp_grant");
    await prisma.oauthConsent.updateMany({
      where: { userId: setup.userId },
      data: { createdAt: new Date(Date.now() - 60_000) },
    });
    expectUnauthenticated(await listSurveys(accessToken, setup));
    // The backfill runs in a later second than the token was issued: a grant it dated when it ran would be
    // newer than the token, and the token refused.
    await new Promise((resolve) => setTimeout(resolve, 1_100));

    await runBackfill();

    const stored = await getMcpGrant(setup.userId, setup.clientId);
    expect(stored?.access).toBe("all");
    expect(stored?.permissions).toEqual({
      surveys: "write",
      creatives: "write",
      surveyStyling: "write",
      responses: "write",
      workflows: "write",
      workflowRuns: "read",
      charts: "write",
      dashboards: "write",
      feedbackRecords: "write",
      feedbackDatasets: "read",
    });
    expect(succeeded(await listSurveys(accessToken, setup))).toBe(true);
    expect(succeeded(await renameSurvey(accessToken, setup))).toBe(true);
  }, 120_000);

  test("a read-only consent stays read-only, and a re-run changes nothing", async () => {
    const setup = await setUp();
    await grant(setup.cookie, setup.clientId, "openid surveys:read responses:read");
    await prisma.mcpGrant.deleteMany({ where: { userId: setup.userId } });

    await runBackfill();
    const first = await getMcpGrant(setup.userId, setup.clientId);
    await runBackfill();

    expect(first?.permissions).toEqual({
      surveys: "read",
      creatives: "read",
      surveyStyling: "read",
      responses: "read",
    });
    expect(await getMcpGrant(setup.userId, setup.clientId)).toEqual(first);
    expect(await prisma.mcpGrant.count()).toBe(1);
  }, 120_000);
  test("a Dashboard viewer's wider consent becomes what the consent screen offers a viewer", async () => {
    const setup = await setUp();
    await grant(setup.cookie, setup.clientId, EVERYTHING);
    await prisma.mcpGrant.deleteMany({ where: { userId: setup.userId } });
    // Made a viewer after consenting, on an instance whose role change didn't end the consent.
    await prisma.membership.update({
      where: { userId_organizationId: { userId: setup.userId, organizationId: setup.organizationId } },
      data: { role: "dashboard_viewer" },
    });

    await runBackfill();

    expect((await getMcpGrant(setup.userId, setup.clientId))?.permissions).toEqual({
      charts: "read",
      dashboards: "read",
    });
  }, 120_000);

  test("a user who is a viewer in one organization and a member in another keeps their scopes' levels", async () => {
    const setup = await setUp();
    await grant(setup.cookie, setup.clientId, "openid dashboards:read dashboards:write");
    await prisma.mcpGrant.deleteMany({ where: { userId: setup.userId } });
    const other = await prisma.organization.create({ data: { name: "Viewer org" } });
    await prisma.membership.create({
      data: { userId: setup.userId, organizationId: other.id, role: "dashboard_viewer", accepted: true },
    });

    await runBackfill();

    expect((await getMcpGrant(setup.userId, setup.clientId))?.permissions).toEqual({
      charts: "write",
      dashboards: "write",
    });
  }, 120_000);
});
