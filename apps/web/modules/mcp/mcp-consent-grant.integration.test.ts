import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  getConsentApprovalBody,
  isIdentityOnlyConsent,
} from "@/app/(app)/account/authorize/lib/consent-approval";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { callMcpTool, serveJwksFromAuthHandler, succeeded, toolText } from "@/integration/mcp-client";
import {
  authorize,
  consent,
  createUser,
  exchangeCode,
  grant,
  refresh,
  registerClient,
  signIn,
} from "@/integration/oauth-flow";
import { resetDb } from "@/integration/reset-db";
import { getAuthzedClient } from "@/lib/authzed/client";
import { readAllRelationships } from "@/lib/authzed/relationship-reads";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { getMcpGrantPermissionsForScopes } from "./grant";
import { getInitialMcpGrantPermissions } from "./grant-editor";
import { getMcpGrant } from "./grant-store";

/**
 * ENG-7150: Allow on the consent screen saves the grant the user picked in the permission matrix, and
 * the client's next call through `/api/mcp` is held to it. Tokens come from the real OAuth flow and the
 * approval is posted the way the consent page posts it, with the chosen grant beside `accept`.
 */

vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>()),
  queueAuditEventBackground: vi.fn(async () => undefined),
}));

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
const EMAIL = "mcp-consent-grant@example.com";
const EVERYTHING = MCP_OAUTH_SCOPES.join(" ");

type TSetup = { cookie: string; userId: string; workspaceId: string; surveyId: string; clientId: string };

/** The SpiceDB relationships that carry the grant's selection, to any organization or workspace. */
const grantRelationships = async (grantId: string) => {
  const client = getAuthzedClient();
  const subject = { objectId: grantId, objectType: "mcp_grant" };
  const reads = await Promise.all(
    (["organization", "workspace"] as const).map((resourceType) =>
      readAllRelationships(client, { relation: "mcp_grant", resourceType, subject })
    )
  );
  return reads.flatMap(({ relationships }) => relationships);
};

/** One owner in one organization with one workspace and a draft survey, and a registered client. */
const setUp = async (): Promise<TSetup> => {
  await resetDb();
  await prisma.oauthResource.createMany({
    data: [{ identifier: getMcpResourceUrl(), name: "Formbricks MCP", allowedScopes: [...MCP_OAUTH_SCOPES] }],
    skipDuplicates: true,
  });
  await createUser(EMAIL, PASSWORD, "Consent owner");
  const { cookie, userId } = await signIn(EMAIL, PASSWORD);
  const organization = await prisma.organization.create({ data: { name: "Consent org" } });
  await prisma.membership.create({
    data: { userId, organizationId: organization.id, role: "owner", accepted: true },
  });
  const workspace = await prisma.workspace.create({
    data: { name: "Consent", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: "Draft", type: "link", workspaceId: workspace.id, blocks: BLOCKS as never },
  });
  await synchronizeAuthzedIntegrationFixture();
  const clientId = await registerClient("consent client");
  return { cookie, userId, workspaceId: workspace.id, surveyId: survey.id, clientId };
};

const listSurveys = (accessToken: string, setup: TSetup) =>
  callMcpTool({ accessToken }, "list_surveys", { workspaceId: setup.workspaceId });

const renameSurvey = (accessToken: string, setup: TSetup) =>
  callMcpTool({ accessToken }, "patch_survey", { surveyId: setup.surveyId, data: { name: "Renamed" } });

const listResponses = (accessToken: string, setup: TSetup) =>
  callMcpTool({ accessToken }, "list_responses", { workspaceId: setup.workspaceId });

const expectNotPermitted = (outcome: Awaited<ReturnType<typeof callMcpTool>>, needs: string) => {
  expect(outcome.result?.isError, toolText(outcome)).toBe(true);
  expect(toolText(outcome)).toContain("Not permitted");
  expect(toolText(outcome)).toContain(needs);
};

beforeAll(() => {
  serveJwksFromAuthHandler();
});

describe("Allow on the consent screen", () => {
  let setup: TSetup;
  beforeEach(async () => {
    vi.mocked(queueAuditEventBackground).mockClear();
    setup = await setUp();
  }, 120_000);

  test("saves the levels the user chose, and the client's next call is held to them", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING, {
      mcpGrant: { permissions: { surveys: "read", responses: "write" } },
    });

    expect((await getMcpGrant(setup.userId, setup.clientId))?.permissions).toEqual({
      surveys: "read",
      responses: "write",
    });
    expect(succeeded(await listSurveys(access_token, setup))).toBe(true);
    expectNotPermitted(await renameSurvey(access_token, setup), "Surveys: Write");
    expectNotPermitted(
      await callMcpTool({ accessToken: access_token }, "list_workflows", {
        workspaceId: setup.workspaceId,
      }),
      "Workflows: Read"
    );
    expect(queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "created",
        targetType: "mcpGrant",
        newObject: {
          before: null,
          after: expect.objectContaining({
            permissions: expect.objectContaining({ surveys: "read", responses: "write", workflows: "none" }),
          }),
        },
      })
    );
  });

  test("saves the organization & workspace access the user chose, and a reconnect that names none keeps it", async () => {
    const other = await prisma.workspace.create({
      data: {
        name: "Other",
        organizationId: (await prisma.workspace.findUniqueOrThrow({ where: { id: setup.workspaceId } }))
          .organizationId,
      },
    });
    await synchronizeAuthzedIntegrationFixture();

    await grant(setup.cookie, setup.clientId, EVERYTHING, {
      mcpGrant: { permissions: { surveys: "read" }, access: "workspaces", workspaceIds: [setup.workspaceId] },
    });
    expect(await getMcpGrant(setup.userId, setup.clientId)).toMatchObject({
      access: "workspaces",
      workspaceIds: [setup.workspaceId],
    });
    expect(queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "created",
        newObject: {
          before: null,
          after: expect.objectContaining({ access: "workspaces", workspaceIds: [setup.workspaceId] }),
        },
      })
    );

    await synchronizeAuthzedIntegrationFixture();
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING, {
      prompt: "consent",
      mcpGrant: { permissions: { surveys: "read" } },
    });
    expect(await getMcpGrant(setup.userId, setup.clientId)).toMatchObject({
      access: "workspaces",
      workspaceIds: [setup.workspaceId],
    });
    expect(succeeded(await listSurveys(access_token, setup))).toBe(true);
    const outside = await callMcpTool({ accessToken: access_token }, "list_surveys", {
      workspaceId: other.id,
    });
    expect(JSON.parse(toolText(outside))).toMatchObject({ error: { status: 404, code: "not_found" } });
  });

  test("never saves more than the client asked for", async () => {
    await grant(setup.cookie, setup.clientId, "openid offline_access surveys:read", {
      mcpGrant: { permissions: { surveys: "write", workflows: "write" } },
    });

    expect((await getMcpGrant(setup.userId, setup.clientId))?.permissions).toEqual({ surveys: "read" });
  });

  test("replaces the grant of a client that reconnects", async () => {
    await grant(setup.cookie, setup.clientId, EVERYTHING, {
      mcpGrant: { permissions: { surveys: "write" } },
    });

    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING, {
      prompt: "consent",
      mcpGrant: { permissions: { responses: "read" } },
    });

    expect((await getMcpGrant(setup.userId, setup.clientId))?.permissions).toEqual({ responses: "read" });
    expectNotPermitted(await listSurveys(access_token, setup), "Surveys: Read");
    const responses = await listResponses(access_token, setup);
    expect(succeeded(responses), toolText(responses)).toBe(true);
  });

  test.each([
    ["every permission at No access", { permissions: {} }],
    ["an unknown permission", { permissions: { surveys: "read", everything: "write" } }],
    ["a level the permission doesn't offer", { permissions: { workflowRuns: "write" } }],
    ["No access spelled out", { permissions: { surveys: "none" } }],
    ["no permissions at all", {}],
    ["not an object", "surveys:write"],
    ["Only selected workspaces with none picked", { permissions: { surveys: "read" }, access: "workspaces" }],
  ])("refuses a grant with %s, and writes neither consent nor grant", async (_case, mcpGrant) => {
    const { target } = await authorize(setup.cookie, setup.clientId, EVERYTHING);

    const response = await consent(setup.cookie, target, { accept: true, mcp_grant: mcpGrant });

    expect(response.status).toBe(400);
    expect(await prisma.oauthConsent.count({ where: { userId: setup.userId } })).toBe(0);
    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
  });

  // The request's own check passes a grant naming only what the client never asked for; capping it leaves
  // nothing, which would connect an app that can do nothing (spec story 17). Refused after the cap.
  test("refuses a grant the client's scopes leave nothing of, and writes neither consent nor grant", async () => {
    const { target } = await authorize(setup.cookie, setup.clientId, "openid offline_access surveys:read");

    const response = await consent(setup.cookie, target, {
      accept: true,
      mcp_grant: { permissions: { workflows: "read" } },
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("mcp_grant_beyond_scopes");
    expect(await prisma.oauthConsent.count({ where: { userId: setup.userId } })).toBe(0);
    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
  });

  // The /api/auth body guard refuses a list over 100 entries before any hook reads it; the grant's own
  // limit is the same, so a selection of exactly 100 reaches the hook and the consent screen can send it.
  test("takes a selection of as many workspaces as a grant holds, the /api/auth list bound", async () => {
    const { target } = await authorize(setup.cookie, setup.clientId, EVERYTHING);
    const workspaceIds = [
      setup.workspaceId,
      ...Array.from({ length: 99 }, (_unused, index) => `clwsunknown${index.toString().padStart(3, "0")}`),
    ];

    const response = await consent(setup.cookie, target, {
      accept: true,
      mcp_grant: { permissions: { surveys: "read" }, access: "workspaces", workspaceIds },
    });

    // Past both bounds: refused only because the user can't pick the 99 unknown ids.
    expect(response.status).toBe(422);
    expect(await response.text()).toContain("mcp_grant_selection_unavailable");

    const tooMany = await consent(
      setup.cookie,
      (await authorize(setup.cookie, setup.clientId, EVERYTHING)).target,
      {
        accept: true,
        mcp_grant: {
          permissions: { surveys: "read" },
          access: "workspaces",
          workspaceIds: [...workspaceIds, "clwsextra"],
        },
      }
    );
    expect(tooMany.status).toBe(400);
    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
  });

  // N1: a request for identity alone (no MCP scope) is approved with what the consent screen's Allow posts
  // for it, and stores a consent without a grant.
  test("approves an identity-only request as the consent screen posts it, storing no grant", async () => {
    const scope = "openid profile email offline_access";
    const { target, verifier } = await authorize(setup.cookie, setup.clientId, scope);
    expect(target.pathname).toBe("/account/authorize");
    const cap = getMcpGrantPermissionsForScopes(scope.split(" "));
    const permissions = getInitialMcpGrantPermissions({ existing: null, cap });

    const response = await consent(
      setup.cookie,
      target,
      getConsentApprovalBody({
        identityOnly: isIdentityOnlyConsent({ cap, isDashboardViewer: false }),
        grant: { permissions, access: { access: "all" } },
      })
    );

    expect(response.status, await response.clone().text()).toBe(200);
    const code = new URL((await response.json()).url as string).searchParams.get("code") as string;
    expect(code).toBeTruthy();
    expect((await exchangeCode(setup.clientId, code, verifier)).status).toBe(200);
    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
    expect(await prisma.oauthConsent.count({ where: { userId: setup.userId } })).toBe(1);
  });

  // A client that asked for no MCP scope could do nothing with a grant: none is stored, and its refresh,
  // which checks a grant for an MCP token, checks its consent alone.
  test("stores no grant for a client that asked for no MCP scope, and lets it refresh", async () => {
    const tokens = await grant(setup.cookie, setup.clientId, "openid offline_access");

    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
    expect(await prisma.oauthConsent.count({ where: { userId: setup.userId } })).toBe(1);
    const refreshed = await refresh(setup.clientId, tokens.refresh_token);
    expect(refreshed.status, JSON.stringify(refreshed.body)).toBe(200);
  });

  // A re-approval for no MCP scope leaves no consent that backs the old grant's access: the grant ends as
  // Revoke would end it, so Authorized apps can't show or edit access nothing backs.
  test("ends the grant of a client re-approved for no MCP scope, and audits it", async () => {
    const { access_token } = await grant(setup.cookie, setup.clientId, EVERYTHING, {
      mcpGrant: { permissions: { surveys: "read" }, access: "workspaces", workspaceIds: [setup.workspaceId] },
    });
    const grantId = (await getMcpGrant(setup.userId, setup.clientId))?.id as string;
    expect(grantId).toBeDefined();
    // The grant's selection is in SpiceDB as a relationship to the workspace.
    expect(await grantRelationships(grantId)).toHaveLength(1);
    vi.mocked(queueAuditEventBackground).mockClear();

    await grant(setup.cookie, setup.clientId, "openid offline_access", { prompt: "consent" });

    // Gone from SpiceDB as well as from the rows, as Revoke removes them once its delete has committed.
    expect(await grantRelationships(grantId)).toEqual([]);

    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
    expect(await prisma.mcpGrantWorkspace.count({ where: { grantId } })).toBe(0);
    expect(queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({ action: "deleted", targetType: "mcpGrant", targetId: grantId })
    );
    // The earlier token named that grant; it is refused now.
    const refused = await listSurveys(access_token, setup);
    expect(succeeded(refused)).toBe(false);
  });

  test("Deny ignores the grant and writes nothing", async () => {
    const { target } = await authorize(setup.cookie, setup.clientId, EVERYTHING);

    const response = await consent(setup.cookie, target, {
      accept: false,
      mcp_grant: { permissions: { surveys: "write" } },
    });

    expect(response.status).toBe(200);
    expect(await prisma.oauthConsent.count({ where: { userId: setup.userId } })).toBe(0);
    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
  });
});
