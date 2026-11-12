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
import { createUser, grant, refresh, registerClient, signIn } from "@/integration/oauth-flow";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { revokeAllUserOAuthGrants } from "@/modules/auth/lib/oauth-grant-revocation";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { createApiKey } from "@/modules/organization/settings/api-keys/lib/api-key";
// The data migration under test (auto-discovered by the migration runner at deploy).
import { backfillMcpGrants } from "../../../../packages/database/migration/20261112120001_backfill_mcp_grants/migration";
import type { TMcpGrantPermissions } from "./grant";
import { getMcpGrant, saveMcpGrant } from "./grant-store";

/**
 * ENG-7149 against the real Better Auth instance, Postgres and SpiceDB: every MCP connection has a grant,
 * and every tool call through `/api/mcp` is held to it. Tokens come from the real OAuth flow (DCR,
 * authorize, consent, code exchange) and every call goes through the route, as a client's would.
 *
 * A grant narrower than the client's scopes is set with `saveMcpGrant`, the store Authorized apps' Edit
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
  prisma.$transaction((tx) =>
    saveMcpGrant(tx, { userId: setup.userId, clientId: setup.clientId, permissions })
  );

const listSurveys = (accessToken: string, setup: TSetup) =>
  callMcpTool({ accessToken }, "list_surveys", { workspaceId: setup.workspaceId });

const renameSurvey = (accessToken: string, setup: TSetup) =>
  callMcpTool({ accessToken }, "patch_survey", { surveyId: setup.surveyId, data: { name: "Renamed" } });

const deleteSurvey = (accessToken: string, setup: TSetup) =>
  callMcpTool({ accessToken }, "delete_survey", { surveyId: setup.surveyId });

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
        status: "success",
        newObject: expect.objectContaining({ clientId: setup.clientId, access: "all" }),
      })
    );
  });

  test("No access refuses the permission's tools, naming the permission and level", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    await setGrant(setup, { responses: "write" });

    expectNotPermitted(await listSurveys(access_token, setup), "Surveys: Read");
  });

  test("Read reads but can't write or delete", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    await setGrant(setup, { surveys: "read" });

    expect(succeeded(await listSurveys(access_token, setup))).toBe(true);
    expectNotPermitted(await renameSurvey(access_token, setup), "Surveys: Write");
    expectNotPermitted(await deleteSurvey(access_token, setup), "Surveys: Write");
    expect(await prisma.survey.findUnique({ where: { id: setup.surveyId } })).toMatchObject({
      name: "Draft",
    });
  });

  test("Write reads, writes and deletes", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    await setGrant(setup, { surveys: "write" });

    expect(succeeded(await listSurveys(access_token, setup))).toBe(true);
    const renamed = await renameSurvey(access_token, setup);
    expect(succeeded(renamed), toolText(renamed)).toBe(true);
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
        oldObject: expect.objectContaining({ clientId: setup.clientId }),
      })
    );
  });

  test("ending every grant a user holds (deactivation, SSO recovery) refuses the next call", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);

    const revoked = await prisma.$transaction((tx) => revokeAllUserOAuthGrants(tx, setup.userId));

    expect(revoked.grantsDeleted).toBe(1);
    expectUnauthenticated(await listSurveys(access_token, setup));
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

  test("keep the access their scopes gave, with Tags at No access", async () => {
    const setup = await setUp();
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING);
    // What an upgraded instance holds: a consent and no grant.
    await prisma.mcpGrant.deleteMany({ where: { userId: setup.userId } });
    expectUnauthenticated(await listSurveys(access_token, setup));

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
    expect(succeeded(await listSurveys(access_token, setup))).toBe(true);
    expect(succeeded(await renameSurvey(access_token, setup))).toBe(true);
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
});
