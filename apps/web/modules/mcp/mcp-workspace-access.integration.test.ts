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
import { createUser, grant, registerClient, signIn } from "@/integration/oauth-flow";
import { resetDb } from "@/integration/reset-db";
import { auth } from "@/modules/auth/lib/auth";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { DEFAULT_CREATIVE_STYLING } from "@/modules/ee/creatives/lib/creative";
import { getIsContactsEnabled, getIsWorkflowsEnabled } from "@/modules/ee/license-check/lib/utils";
import { editMcpGrant } from "./connections";
import type { TMcpGrantAccessSelection, TMcpGrantPermissions } from "./grant";
import { getMcpGrant } from "./grant-store";

/**
 * ENG-7153 (ADR-0042) against the real Better Auth instance, Postgres and SpiceDB: a grant's organization
 * & workspace access is enforced on every MCP call, whichever way the tool finds its workspace. Tokens
 * come from the real OAuth flow and every call goes through `POST /api/mcp`.
 *
 * Layout: the user owns organization "Acme" (workspaces "In" and "Out") and organization "Globex"
 * (workspace "Elsewhere"), each holding one of every resource a tool can name by id. The grant's
 * selection is saved through Edit (`editMcpGrant`), which writes it to SpiceDB before it returns, so no
 * test projects it by hand before the next call. Fixture writes that bypass the product (a seeded
 * workspace, a deleted organization) still converge through the outbox.
 */

vi.mock("@/modules/ee/audit-logs/lib/handler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/audit-logs/lib/handler")>()),
  queueAuditEventBackground: vi.fn(async () => undefined),
}));
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => true),
  getIsCreativesEnabled: vi.fn(async () => true),
  getIsWorkflowsEnabled: vi.fn(async () => true),
  getIsContactsEnabled: vi.fn(async () => true),
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
const EVERYTHING = MCP_OAUTH_SCOPES.join(" ");
/** Every permission at Read: what the reads below need, and no more. */
const READ_ALL: TMcpGrantPermissions = {
  surveys: "read",
  creatives: "read",
  responses: "read",
  workflows: "read",
  workflowRuns: "read",
  charts: "read",
  dashboards: "read",
  feedbackRecords: "read",
  feedbackDatasets: "read",
};

type TWorkspaceResources = {
  workspaceId: string;
  surveyId: string;
  responseId: string;
  chartId: string;
  dashboardId: string;
  creativeId: string;
  workflowId: string;
  runId: string;
};

type TSetup = {
  cookie: string;
  userId: string;
  clientId: string;
  accessToken: string;
  acmeId: string;
  globexId: string;
  inside: TWorkspaceResources;
  outside: TWorkspaceResources;
  elsewhere: TWorkspaceResources;
};

const seedWorkspace = async (
  organizationId: string,
  name: string,
  userId: string
): Promise<TWorkspaceResources> => {
  const workspace = await prisma.workspace.create({ data: { name, organizationId } });
  const workspaceId = workspace.id;
  const survey = await prisma.survey.create({
    data: { name: `${name} survey`, type: "link", workspaceId, blocks: BLOCKS as never },
  });
  const response = await prisma.response.create({
    data: { surveyId: survey.id, finished: true, data: { improve: "More" } },
  });
  const dataset = await prisma.feedbackDirectory.create({
    data: { name: `${name} dataset`, organizationId, workspaces: { create: { workspaceId } } },
  });
  const chart = await prisma.chart.create({
    data: {
      name: `${name} chart`,
      type: "bar",
      workspaceId,
      feedbackDirectoryId: dataset.id,
      query: { measures: ["FeedbackRecords.count"] },
      config: {},
    },
  });
  const dashboard = await prisma.dashboard.create({
    data: { name: `${name} dashboard`, workspaceId, createdBy: userId },
  });
  const creative = await prisma.creative.create({
    data: {
      name: `${name} creative`,
      type: "feedbackButton",
      workspaceId,
      content: { label: { "en-US": "Feedback" }, icon: null },
      styling: DEFAULT_CREATIVE_STYLING.feedbackButton,
    },
  });
  const workflow = await prisma.workflow.create({
    data: {
      name: `${name} workflow`,
      workspaceId,
      definition: {
        entryNodeId: "trigger",
        trigger: {
          id: "trigger",
          type: "trigger",
          triggerType: "response.completed",
          config: { surveyId: survey.id, endingCardIds: [] },
        },
        nodes: [],
        edges: [],
      },
    },
  });
  const run = await prisma.workflowRun.create({
    data: {
      workflowId: workflow.id,
      workspaceId,
      status: "completed",
      triggerType: "response.completed",
      surveyId: survey.id,
      isDryRun: true,
      responseId: response.id,
      triggerPayload: {
        type: "response.completed",
        workspaceId,
        surveyId: survey.id,
        responseId: response.id,
        triggeredAt: new Date().toISOString(),
      },
    },
  });
  return {
    workspaceId,
    surveyId: survey.id,
    responseId: response.id,
    chartId: chart.id,
    dashboardId: dashboard.id,
    creativeId: creative.id,
    workflowId: workflow.id,
    runId: run.id,
  };
};

const setUp = async (): Promise<TSetup> => {
  await resetDb();
  await prisma.oauthResource.createMany({
    data: [{ identifier: getMcpResourceUrl(), name: "Formbricks MCP", allowedScopes: [...MCP_OAUTH_SCOPES] }],
    skipDuplicates: true,
  });
  await createUser("workspace-access@example.com", PASSWORD, "Access owner");
  const { cookie, userId } = await signIn("workspace-access@example.com", PASSWORD);
  const acme = await prisma.organization.create({ data: { name: "Acme" } });
  const globex = await prisma.organization.create({ data: { name: "Globex" } });
  for (const organizationId of [acme.id, globex.id]) {
    await prisma.membership.create({ data: { userId, organizationId, role: "owner", accepted: true } });
  }
  const inside = await seedWorkspace(acme.id, "In", userId);
  const outside = await seedWorkspace(acme.id, "Out", userId);
  const elsewhere = await seedWorkspace(globex.id, "Elsewhere", userId);
  await synchronizeAuthzedIntegrationFixture();
  const clientId = await registerClient("workspace access client");
  const { access_token } = await grant(cookie, clientId, EVERYTHING);
  return {
    cookie,
    userId,
    clientId,
    accessToken: access_token,
    acmeId: acme.id,
    globexId: globex.id,
    inside,
    outside,
    elsewhere,
  };
};

/**
 * Sets the grant's access through Edit, as Authorized apps does. Nothing projects it afterwards: the
 * next call has to see it because the save itself wrote it to SpiceDB (spec story 32), not the outbox.
 */
const setAccess = async (
  setup: TSetup,
  access: TMcpGrantAccessSelection,
  permissions: TMcpGrantPermissions = READ_ALL
) => {
  const edited = await editMcpGrant({
    userId: setup.userId,
    clientId: setup.clientId,
    permissions,
    access,
    isDashboardViewer: false,
  });
  expect(edited.status).toBe("saved");
};

/** One read per way a tool finds its workspace: an explicit `workspaceId`, or a resource's id. */
const READS: [tool: string, args: (resources: TWorkspaceResources) => Record<string, unknown>][] = [
  ["list_surveys", ({ workspaceId }) => ({ workspaceId })],
  ["get_survey", ({ surveyId }) => ({ surveyId })],
  ["get_response", ({ responseId }) => ({ responseId })],
  ["get_chart", ({ chartId }) => ({ chartId })],
  ["get_dashboard", ({ dashboardId }) => ({ dashboardId })],
  ["get_creative", ({ creativeId }) => ({ creativeId })],
  ["get_workflow", ({ workflowId }) => ({ workflowId })],
  ["get_workflow_run", ({ runId }) => ({ runId })],
];

const problemOf = (outcome: TMcpToolCallOutcome) =>
  (JSON.parse(toolText(outcome)) as { error: { status: number; code: string; requestId: string } }).error;

/** Out of the grant: the same "not found" a made-up id gets, never "forbidden". */
const expectNotFound = (outcome: TMcpToolCallOutcome) => {
  expect(outcome.result?.isError, toolText(outcome)).toBe(true);
  expect(problemOf(outcome)).toMatchObject({ status: 404, code: "not_found" });
};

const listedWorkspaceIds = async (setup: TSetup): Promise<string[]> => {
  const outcome = await callMcpTool({ accessToken: setup.accessToken }, "list_workspaces", {});
  expect(succeeded(outcome), toolText(outcome)).toBe(true);
  const { data } = JSON.parse(toolText(outcome)) as { data: { id: string }[] };
  return data.map(({ id }) => id).sort((a, b) => a.localeCompare(b));
};

const sorted = (...ids: string[]) => ids.sort((a, b) => a.localeCompare(b));

beforeAll(() => {
  serveJwksFromAuthHandler();
});

describe("organization & workspace access on MCP calls", () => {
  let setup: TSetup;
  beforeEach(async () => {
    setup = await setUp();
  }, 120_000);

  test("Only selected workspaces: in-grant resources are reached, every other one is not found", async () => {
    await setAccess(setup, { access: "workspaces", workspaceIds: [setup.inside.workspaceId] });

    for (const [tool, args] of READS) {
      const inGrant = await callMcpTool({ accessToken: setup.accessToken }, tool, args(setup.inside));
      expect(succeeded(inGrant), `${tool}: ${toolText(inGrant)}`).toBe(true);
      expectNotFound(await callMcpTool({ accessToken: setup.accessToken }, tool, args(setup.outside)));
      expectNotFound(await callMcpTool({ accessToken: setup.accessToken }, tool, args(setup.elsewhere)));
    }
    expect(await listedWorkspaceIds(setup)).toEqual([setup.inside.workspaceId]);
  }, 120_000);

  test("an id outside the grant answers exactly as a made-up one", async () => {
    await setAccess(setup, { access: "workspaces", workspaceIds: [setup.inside.workspaceId] });

    const outOfGrant = await callMcpTool({ accessToken: setup.accessToken }, "get_survey", {
      surveyId: setup.outside.surveyId,
    });
    const madeUp = await callMcpTool({ accessToken: setup.accessToken }, "get_survey", {
      surveyId: "z6p0x2v7q0m7r4c9k1n3b5h8",
    });
    expect(problemOf(outOfGrant)).toEqual({
      ...problemOf(madeUp),
      requestId: problemOf(outOfGrant).requestId,
    });
  });

  test("Only selected organizations reaches every workspace in them, a later one included", async () => {
    await setAccess(setup, { access: "organizations", organizationIds: [setup.acmeId] });
    const later = await seedWorkspace(setup.acmeId, "Later", setup.userId);
    await synchronizeAuthzedIntegrationFixture();

    for (const [tool, args] of READS) {
      for (const resources of [setup.inside, setup.outside, later]) {
        const outcome = await callMcpTool({ accessToken: setup.accessToken }, tool, args(resources));
        expect(succeeded(outcome), `${tool}: ${toolText(outcome)}`).toBe(true);
      }
      expectNotFound(await callMcpTool({ accessToken: setup.accessToken }, tool, args(setup.elsewhere)));
    }
    expect(await listedWorkspaceIds(setup)).toEqual(
      sorted(setup.inside.workspaceId, setup.outside.workspaceId, later.workspaceId)
    );
  }, 120_000);

  test("Only selected workspaces leaves a later workspace out", async () => {
    await setAccess(setup, { access: "workspaces", workspaceIds: [setup.inside.workspaceId] });
    const later = await seedWorkspace(setup.acmeId, "Later", setup.userId);
    await synchronizeAuthzedIntegrationFixture();

    expectNotFound(
      await callMcpTool({ accessToken: setup.accessToken }, "get_survey", { surveyId: later.surveyId })
    );
    expect(await listedWorkspaceIds(setup)).toEqual([setup.inside.workspaceId]);
  });

  test("All access reaches every organization the user belongs to, one joined later included", async () => {
    await setAccess(setup, { access: "all" });
    const joined = await prisma.organization.create({ data: { name: "Joined" } });
    await prisma.membership.create({
      data: { userId: setup.userId, organizationId: joined.id, role: "owner", accepted: true },
    });
    const later = await seedWorkspace(joined.id, "Joined", setup.userId);
    await synchronizeAuthzedIntegrationFixture();

    for (const resources of [setup.inside, setup.elsewhere, later]) {
      const outcome = await callMcpTool({ accessToken: setup.accessToken }, "get_survey", {
        surveyId: resources.surveyId,
      });
      expect(succeeded(outcome), toolText(outcome)).toBe(true);
    }
    expect(await listedWorkspaceIds(setup)).toEqual(
      sorted(
        setup.inside.workspaceId,
        setup.outside.workspaceId,
        setup.elsewhere.workspaceId,
        later.workspaceId
      )
    );
  });

  test("an edit narrowing the access applies on the next call with the same token", async () => {
    // Starts from a selection, not All access: removing a workspace has to drop its relationship
    // before the next call, which All access (no relationships at all) would not show.
    await setAccess(setup, {
      access: "workspaces",
      workspaceIds: [setup.inside.workspaceId, setup.outside.workspaceId],
    });
    const before = await callMcpTool({ accessToken: setup.accessToken }, "get_survey", {
      surveyId: setup.outside.surveyId,
    });
    expect(succeeded(before), toolText(before)).toBe(true);

    const edited = await editMcpGrant({
      userId: setup.userId,
      clientId: setup.clientId,
      permissions: READ_ALL,
      access: { access: "workspaces", workspaceIds: [setup.inside.workspaceId] },
      isDashboardViewer: false,
    });
    expect(edited.status).toBe("saved");

    expectNotFound(
      await callMcpTool({ accessToken: setup.accessToken }, "get_survey", {
        surveyId: setup.outside.surveyId,
      })
    );
    const kept = await callMcpTool({ accessToken: setup.accessToken }, "get_survey", {
      surveyId: setup.inside.surveyId,
    });
    expect(succeeded(kept), toolText(kept)).toBe(true);
  });

  test("an edit widening the access applies on the next call with the same token", async () => {
    await setAccess(setup, { access: "workspaces", workspaceIds: [setup.inside.workspaceId] });
    expectNotFound(
      await callMcpTool({ accessToken: setup.accessToken }, "get_survey", {
        surveyId: setup.outside.surveyId,
      })
    );

    await setAccess(setup, { access: "organizations", organizationIds: [setup.acmeId] });

    const after = await callMcpTool({ accessToken: setup.accessToken }, "get_survey", {
      surveyId: setup.outside.surveyId,
    });
    expect(succeeded(after), toolText(after)).toBe(true);
  });

  // A plan refusal comes after authorization, so it reveals nothing outside the grant: it keeps its own
  // code rather than turning into not found, which would tell the agent the resource is gone.
  test.each([
    {
      feature: "Workflows",
      unentitle: () => vi.mocked(getIsWorkflowsEnabled).mockResolvedValue(false),
      tool: "list_workflows",
      code: "workflows_not_entitled",
      permissions: READ_ALL,
    },
    {
      feature: "Contacts",
      unentitle: () => vi.mocked(getIsContactsEnabled).mockResolvedValue(false),
      tool: "list_contact_attribute_keys",
      code: "contacts_not_entitled",
      permissions: { contactAttributes: "read" },
    },
  ] satisfies {
    feature: string;
    unentitle: () => unknown;
    tool: string;
    code: string;
    permissions: TMcpGrantPermissions;
  }[])(
    "without $feature, the plan refusal passes through a narrowed grant",
    async ({ unentitle, tool, code, permissions }) => {
      await setAccess(setup, { access: "workspaces", workspaceIds: [setup.inside.workspaceId] }, permissions);
      unentitle();
      try {
        const outcome = await callMcpTool({ accessToken: setup.accessToken }, tool, {
          workspaceId: setup.inside.workspaceId,
        });
        expect(outcome.result?.isError, toolText(outcome)).toBe(true);
        expect(problemOf(outcome)).toMatchObject({ status: 403, code });
      } finally {
        vi.mocked(getIsWorkflowsEnabled).mockResolvedValue(true);
        vi.mocked(getIsContactsEnabled).mockResolvedValue(true);
      }
    }
  );

  test("a grant whose workspaces were deleted stays, reaches nothing, and every call is not found", async () => {
    await setAccess(setup, { access: "workspaces", workspaceIds: [setup.outside.workspaceId] });

    await prisma.workspace.delete({ where: { id: setup.outside.workspaceId } });
    await synchronizeAuthzedIntegrationFixture();

    expect(await getMcpGrant(setup.userId, setup.clientId)).toMatchObject({
      access: "workspaces",
      workspaceIds: [],
    });
    for (const [tool, args] of READS) {
      expectNotFound(await callMcpTool({ accessToken: setup.accessToken }, tool, args(setup.inside)));
    }
    expect(await listedWorkspaceIds(setup)).toEqual([]);
  }, 120_000);

  test("a deleted organization drops its selection and its relationships", async () => {
    await setAccess(setup, { access: "organizations", organizationIds: [setup.globexId] });

    await prisma.organization.delete({ where: { id: setup.globexId } });
    // Converges only if no relationship of the deleted organization's grant selection is left behind.
    await synchronizeAuthzedIntegrationFixture();

    expect(await getMcpGrant(setup.userId, setup.clientId)).toMatchObject({
      access: "organizations",
      organizationIds: [],
    });
    expect(await listedWorkspaceIds(setup)).toEqual([]);
  });

  test("Revoke deletes the grant and its relationships", async () => {
    await setAccess(setup, { access: "workspaces", workspaceIds: [setup.inside.workspaceId] });
    const consent = await prisma.oauthConsent.findFirstOrThrow({
      where: { userId: setup.userId, clientId: setup.clientId },
    });

    await auth.api.deleteOAuthConsent({
      body: { id: consent.id },
      headers: new Headers({ cookie: setup.cookie }),
    });

    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
    // Converges only once the grant's relationships are gone from SpiceDB too.
    await synchronizeAuthzedIntegrationFixture();
  });

  test("a grant holding only Creatives can still list the workspaces it reaches", async () => {
    await setAccess(
      setup,
      { access: "workspaces", workspaceIds: [setup.inside.workspaceId] },
      { creatives: "read" }
    );

    expect(await listedWorkspaceIds(setup)).toEqual([setup.inside.workspaceId]);
  });

  test("a selection the user doesn't belong to is not stored", async () => {
    const stranger = await prisma.organization.create({ data: { name: "Stranger" } });
    await setAccess(setup, { access: "organizations", organizationIds: [setup.acmeId, stranger.id] });

    expect(await getMcpGrant(setup.userId, setup.clientId)).toMatchObject({
      access: "organizations",
      organizationIds: [setup.acmeId],
    });
  });
});
