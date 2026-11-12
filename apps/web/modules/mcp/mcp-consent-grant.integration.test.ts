import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { callMcpTool, serveJwksFromAuthHandler, succeeded, toolText } from "@/integration/mcp-client";
import { authorize, consent, createUser, grant, registerClient, signIn } from "@/integration/oauth-flow";
import { resetDb } from "@/integration/reset-db";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
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
        newObject: expect.objectContaining({ permissions: { surveys: "read", responses: "write" } }),
      })
    );
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
  ])("refuses a grant with %s, and writes neither consent nor grant", async (_case, mcpGrant) => {
    const { target } = await authorize(setup.cookie, setup.clientId, EVERYTHING);

    const response = await consent(setup.cookie, target, { accept: true, mcp_grant: mcpGrant });

    expect(response.status).toBe(400);
    expect(await prisma.oauthConsent.count({ where: { userId: setup.userId } })).toBe(0);
    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
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
