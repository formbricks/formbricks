import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PATCH as patchGrant } from "@/app/api/internal/mcp-grants/[clientId]/route";
import { GET as listGrants } from "@/app/api/internal/mcp-grants/route";
import { listV3DashboardFilterFields } from "@/app/api/v3/dashboards/lib/filter-fields-operations";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { sessionOf } from "@/integration/dashboards-fixture";
import {
  type TMcpToolCallOutcome,
  callMcpTool,
  serveJwksFromAuthHandler,
  succeeded,
  toolText,
} from "@/integration/mcp-client";
import {
  authorize,
  consent,
  createUser,
  grant,
  refresh,
  registerClient,
  signIn,
} from "@/integration/oauth-flow";
import { resetDb } from "@/integration/reset-db";
import { reconcileMcpGrantRelationships } from "@/lib/authzed/mcp-grant";
import { auth } from "@/modules/auth/lib/auth";
import { MCP_OAUTH_SCOPES, getMcpResourceUrl } from "@/modules/auth/lib/oauth-urls";
import { DEFAULT_CREATIVE_STYLING } from "@/modules/ee/creatives/lib/creative";
import {
  getIsContactsEnabled,
  getIsFeedbackDirectoriesEnabled,
  getIsWorkflowsEnabled,
} from "@/modules/ee/license-check/lib/utils";
import { readMcpGrantReadableWorkspaceIds } from "./access-options";
import { editMcpGrant } from "./authorized-clients";
import type { TMcpGrantAccessSelection, TMcpGrantPermissions } from "./grant";
import { getMcpGrant, lockMcpGrant, narrowMcpGrantAccess, writeMcpGrant } from "./grant-store";

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

/** Set to make every SpiceDB relationship write fail, as during an outage; reads keep working. */
const spicedbWrites = vi.hoisted(() => ({ failing: false }));
/** Set to make every SpiceDB lookup fail, as during an outage. */
const spicedbLookups = vi.hoisted(() => ({ failing: false }));
/** The signed-in user the internal grant routes read, as Authorized apps sends it. */
const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/modules/auth/lib/session", () => ({
  getSession: vi.fn(async () => (session.userId ? { user: { id: session.userId } } : null)),
}));
vi.mock("@/lib/authzed/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/authzed/client")>();
  return {
    ...actual,
    getAuthzedClient: () => {
      const client = actual.getAuthzedClient();
      return {
        ...client,
        writeRelationships: async (...args: Parameters<typeof client.writeRelationships>) => {
          if (spicedbWrites.failing) throw new Error("SpiceDB is down");
          return client.writeRelationships(...args);
        },
        lookupResources: async (...args: Parameters<typeof client.lookupResources>) => {
          if (spicedbLookups.failing) throw new Error("SpiceDB is down");
          return client.lookupResources(...args);
        },
      };
    },
  };
});
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
  getIsFeedbackDirectoriesEnabled: vi.fn(async () => true),
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

  // The safe direction always wins (spec story 32): a narrowing removes the relationships before it
  // commits, or not at all; a widening commits and adds them after, best-effort.
  test("an edit narrowing the access is refused, and changes nothing, when SpiceDB can't drop the reach", async () => {
    await setAccess(setup, {
      access: "workspaces",
      workspaceIds: [setup.inside.workspaceId, setup.outside.workspaceId],
    });
    spicedbWrites.failing = true;
    try {
      await expect(
        editMcpGrant({
          userId: setup.userId,
          clientId: setup.clientId,
          permissions: READ_ALL,
          access: { access: "workspaces", workspaceIds: [setup.inside.workspaceId] },
          isDashboardViewer: false,
        })
      ).rejects.toThrow();
    } finally {
      spicedbWrites.failing = false;
    }

    expect(await getMcpGrant(setup.userId, setup.clientId)).toMatchObject({
      access: "workspaces",
      workspaceIds: sorted(setup.inside.workspaceId, setup.outside.workspaceId),
    });
    const still = await callMcpTool({ accessToken: setup.accessToken }, "get_survey", {
      surveyId: setup.outside.surveyId,
    });
    expect(succeeded(still), toolText(still)).toBe(true);
  });

  test("an edit widening the access is saved when SpiceDB is down, and the outbox adds the reach", async () => {
    await setAccess(setup, { access: "workspaces", workspaceIds: [setup.inside.workspaceId] });
    spicedbWrites.failing = true;
    try {
      await setAccess(setup, {
        access: "workspaces",
        workspaceIds: [setup.inside.workspaceId, setup.outside.workspaceId],
      });
    } finally {
      spicedbWrites.failing = false;
    }
    // Saved, but not reached until the relationship is written.
    expectNotFound(
      await callMcpTool({ accessToken: setup.accessToken }, "get_survey", {
        surveyId: setup.outside.surveyId,
      })
    );

    await synchronizeAuthzedIntegrationFixture();
    const after = await callMcpTool({ accessToken: setup.accessToken }, "get_survey", {
      surveyId: setup.outside.surveyId,
    });
    expect(succeeded(after), toolText(after)).toBe(true);
  });

  // Revoke doesn't depend on SpiceDB: the deleted grant row is what ends the access.
  test("Revoke goes through while SpiceDB is down, the next call answers 401, and the outbox cleans up", async () => {
    await setAccess(setup, { access: "workspaces", workspaceIds: [setup.inside.workspaceId] });
    const consentRow = await prisma.oauthConsent.findFirstOrThrow({
      where: { userId: setup.userId, clientId: setup.clientId },
    });
    spicedbWrites.failing = true;
    try {
      await auth.api.deleteOAuthConsent({
        body: { id: consentRow.id },
        headers: new Headers({ cookie: setup.cookie }),
      });
    } finally {
      spicedbWrites.failing = false;
    }

    expect(await getMcpGrant(setup.userId, setup.clientId)).toBeNull();
    const after = await callMcpTool({ accessToken: setup.accessToken }, "list_workspaces", {});
    expect(after.status).toBe(401);
    // The delete queued the grant; the outbox removes what the post-commit removal couldn't.
    await synchronizeAuthzedIntegrationFixture();
  });

  test("a consent re-approval narrowing the access fails, changing nothing, when SpiceDB can't drop it", async () => {
    await setAccess(setup, {
      access: "workspaces",
      workspaceIds: [setup.inside.workspaceId, setup.outside.workspaceId],
    });
    const { target } = await authorize(setup.cookie, setup.clientId, EVERYTHING, { prompt: "consent" });
    spicedbWrites.failing = true;
    let response: Response;
    try {
      response = await consent(setup.cookie, target, {
        accept: true,
        mcp_grant: { permissions: READ_ALL, access: "workspaces", workspaceIds: [setup.inside.workspaceId] },
      });
    } finally {
      spicedbWrites.failing = false;
    }

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: "mcp_grant_not_saved" });
    expect(await getMcpGrant(setup.userId, setup.clientId)).toMatchObject({
      access: "workspaces",
      workspaceIds: sorted(setup.inside.workspaceId, setup.outside.workspaceId),
    });
    const still = await callMcpTool({ accessToken: setup.accessToken }, "get_survey", {
      surveyId: setup.outside.surveyId,
    });
    expect(succeeded(still), toolText(still)).toBe(true);
  });

  test("a crafted approval naming a workspace the user can't select is refused, and saves nothing", async () => {
    await setAccess(setup, { access: "workspaces", workspaceIds: [setup.inside.workspaceId] });
    const stranger = await prisma.organization.create({ data: { name: "Stranger" } });
    const foreign = await prisma.workspace.create({
      data: { name: "Not mine", organizationId: stranger.id },
    });
    await synchronizeAuthzedIntegrationFixture();
    const { target } = await authorize(setup.cookie, setup.clientId, EVERYTHING, { prompt: "consent" });

    const response = await consent(setup.cookie, target, {
      accept: true,
      mcp_grant: { permissions: READ_ALL, access: "workspaces", workspaceIds: [foreign.id] },
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: "invalid_request",
      error_description: "Pick only workspaces you have access to.",
      code: "mcp_grant_selection_unavailable",
    });
    expect(await getMcpGrant(setup.userId, setup.clientId)).toMatchObject({
      access: "workspaces",
      workspaceIds: [setup.inside.workspaceId],
    });
  });

  // Smoke: Edit with SpiceDB down answered the wrapper's generic 500, which the toast showed as "An
  // unexpected error occurred". It answers what the consent screen does for the same failure.
  test("Edit answers mcp_grant_not_saved, changing nothing, when SpiceDB can't drop the reach", async () => {
    await setAccess(setup, {
      access: "workspaces",
      workspaceIds: [setup.inside.workspaceId, setup.outside.workspaceId],
    });
    session.userId = setup.userId;
    spicedbWrites.failing = true;
    let response: Response;
    try {
      response = await patchGrant(
        new NextRequest(`http://localhost/api/internal/mcp-grants/${setup.clientId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            permissions: READ_ALL,
            access: "workspaces",
            workspaceIds: [setup.inside.workspaceId],
          }),
        }),
        { params: Promise.resolve({ clientId: setup.clientId }) } as never
      );
    } finally {
      spicedbWrites.failing = false;
      session.userId = "";
    }

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      code: "mcp_grant_not_saved",
      detail: "The access you chose couldn't be saved, so nothing changed. Try again.",
    });
    expect(await getMcpGrant(setup.userId, setup.clientId)).toMatchObject({
      workspaceIds: sorted(setup.inside.workspaceId, setup.outside.workspaceId),
    });
  });

  // A failed Allow changes nothing, the consent the provider wrote before the grant hook ran included.
  // Each approval asks for fewer scopes than the consent it replaces, so a consent left as the provider
  // wrote it shows: a new client would skip the consent screen with no grant, and a re-approval would
  // leave a narrowed consent that the refresh check holds the earlier tokens to.
  describe("a failed approval leaves the consent as it was", () => {
    const NARROW = "offline_access surveys:read";
    const consentsOf = (setup: TSetup, clientId: string) =>
      prisma.oauthConsent.findMany({ where: { userId: setup.userId, clientId }, select: { scopes: true } });
    const sortedScopes = (scopes: string) => scopes.split(" ").sort((a, b) => a.localeCompare(b));
    const withSpiceDb = async <T>(down: { failing: boolean } | null, run: () => Promise<T>): Promise<T> => {
      if (down) down.failing = true;
      try {
        return await run();
      } finally {
        if (down) down.failing = false;
      }
    };

    test.each([
      ["422, a workspace the user can't select", 422, null],
      ["500, SpiceDB down while it checks the selection", 500, spicedbLookups],
    ] as const)("for a new client: %s", async (_case, status, down) => {
      const foreign = await prisma.workspace.create({
        data: {
          name: "Not mine",
          organizationId: (await prisma.organization.create({ data: { name: "Stranger" } })).id,
        },
      });
      await synchronizeAuthzedIntegrationFixture();
      const clientId = await registerClient("new client");
      const { target } = await authorize(setup.cookie, clientId, EVERYTHING);
      expect(target.pathname).toBe("/account/authorize");

      const response = await withSpiceDb(down, () =>
        consent(setup.cookie, target, {
          accept: true,
          scope: NARROW,
          mcp_grant: {
            permissions: { surveys: "read" },
            access: "workspaces",
            workspaceIds: [status === 422 ? foreign.id : setup.inside.workspaceId],
          },
        })
      );

      expect(response.status).toBe(status);
      expect(await consentsOf(setup, clientId)).toEqual([]);
      expect(await getMcpGrant(setup.userId, clientId)).toBeNull();
      // The next authorization asks again rather than issuing a code on a consent without a grant.
      expect((await authorize(setup.cookie, clientId, NARROW)).target.pathname).toBe("/account/authorize");
    });

    test.each([
      ["422, a workspace the user can't select", 422, null],
      ["500, SpiceDB down while it drops the narrowed reach", 500, spicedbWrites],
    ] as const)("for a re-approval with fewer scopes: %s", async (_case, status, down) => {
      await setAccess(setup, {
        access: "workspaces",
        workspaceIds: [setup.inside.workspaceId, setup.outside.workspaceId],
      });
      // Tokens of the wide consent, which a narrowed one would end at their next refresh.
      const wide = await grant(setup.cookie, setup.clientId, EVERYTHING);
      const stranger = await prisma.organization.create({ data: { name: "Stranger" } });
      const foreign = await prisma.workspace.create({
        data: { name: "Not mine", organizationId: stranger.id },
      });
      await synchronizeAuthzedIntegrationFixture();
      const { target } = await authorize(setup.cookie, setup.clientId, EVERYTHING, { prompt: "consent" });

      const response = await withSpiceDb(down, () =>
        consent(setup.cookie, target, {
          accept: true,
          scope: NARROW,
          mcp_grant: {
            permissions: { surveys: "read" },
            access: "workspaces",
            workspaceIds: status === 422 ? [foreign.id] : [setup.inside.workspaceId],
          },
        })
      );

      expect(response.status).toBe(status);
      const consents = await consentsOf(setup, setup.clientId);
      expect(consents).toHaveLength(1);
      expect([...consents[0].scopes].sort((a, b) => a.localeCompare(b))).toEqual(sortedScopes(EVERYTHING));
      expect(await getMcpGrant(setup.userId, setup.clientId)).toMatchObject({
        permissions: READ_ALL,
        workspaceIds: sorted(setup.inside.workspaceId, setup.outside.workspaceId),
      });
      // The wide tokens keep working: nothing narrowed the consent they were issued under.
      expect((await refresh(setup.clientId, wide.refresh_token)).status).toBe(200);
    });
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

  // A plan refusal comes after authorization, so it reveals nothing outside the grant: it stays the 403
  // it is rather than turning into not found, which would tell the agent the resource is gone.
  test.each([
    {
      feature: "Workflows",
      unentitle: () => vi.mocked(getIsWorkflowsEnabled).mockResolvedValue(false),
      tool: "list_workflows",
      detail: "Workflows are not enabled for this organization",
      permissions: READ_ALL,
    },
    {
      feature: "Contacts",
      unentitle: () => vi.mocked(getIsContactsEnabled).mockResolvedValue(false),
      tool: "list_contact_attribute_keys",
      detail: "The contacts feature is not enabled for this organization.",
      permissions: { contactAttributes: "read" },
    },
    {
      feature: "Unify Feedback",
      unentitle: () => vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(false),
      tool: "list_feedback_datasets",
      detail:
        "Unify Feedback is not enabled for this organization. It requires an Enterprise plan or license — an organization owner can enable it from the organization's billing or license settings.",
      permissions: READ_ALL,
    },
  ] satisfies {
    feature: string;
    unentitle: () => unknown;
    tool: string;
    detail: string;
    permissions: TMcpGrantPermissions;
  }[])(
    "without $feature, the plan refusal passes through a narrowed grant",
    async ({ unentitle, tool, detail, permissions }) => {
      await setAccess(setup, { access: "workspaces", workspaceIds: [setup.inside.workspaceId] }, permissions);
      unentitle();
      try {
        const outcome = await callMcpTool({ accessToken: setup.accessToken }, tool, {
          workspaceId: setup.inside.workspaceId,
        });
        expect(outcome.result?.isError, toolText(outcome)).toBe(true);
        // The same 403 the REST API answers, not the not found an id outside the grant gets.
        expect(problemOf(outcome)).toMatchObject({ status: 403, code: "forbidden" });
        expect(JSON.parse(toolText(outcome)).error.detail).toBe(detail);
      } finally {
        vi.mocked(getIsWorkflowsEnabled).mockResolvedValue(true);
        vi.mocked(getIsContactsEnabled).mockResolvedValue(true);
        vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(true);
      }
    }
  );

  // Only what `can()` or a list lookup denied because of the grant's reach becomes not found. Every other
  // answer of an in-grant call reaches the agent exactly as the operation gave it.
  describe("answers of an in-grant call pass through unchanged", () => {
    const WRITE_SURVEYS: TMcpGrantPermissions = { ...READ_ALL, surveys: "write" };

    const answered = (outcome: TMcpToolCallOutcome) =>
      (JSON.parse(toolText(outcome)) as { error: { status: number; code?: string; detail: string } }).error;

    test("the 428 asking to confirm a change to a survey with responses", async () => {
      await setAccess(
        setup,
        { access: "workspaces", workspaceIds: [setup.inside.workspaceId] },
        WRITE_SURVEYS
      );
      await prisma.survey.update({ where: { id: setup.inside.surveyId }, data: { status: "inProgress" } });

      const outcome = await callMcpTool({ accessToken: setup.accessToken }, "patch_survey", {
        surveyId: setup.inside.surveyId,
        data: { name: "Renamed" },
      });

      expect(outcome.result?.isError, toolText(outcome)).toBe(true);
      expect(answered(outcome)).toMatchObject({ status: 428 });
      expect(answered(outcome).detail).toContain("Pass confirm: true after the user agrees.");
    });

    test("the plan refusal of contact targeting", async () => {
      await setAccess(
        setup,
        { access: "workspaces", workspaceIds: [setup.inside.workspaceId] },
        WRITE_SURVEYS
      );
      const appSurvey = await prisma.survey.create({
        data: {
          name: "App survey",
          type: "app",
          workspaceId: setup.inside.workspaceId,
          blocks: BLOCKS as never,
        },
      });
      await synchronizeAuthzedIntegrationFixture();
      vi.mocked(getIsContactsEnabled).mockResolvedValue(false);
      try {
        const outcome = await callMcpTool({ accessToken: setup.accessToken }, "patch_survey", {
          surveyId: appSurvey.id,
          data: {
            targeting: {
              filters: [
                {
                  id: "f1",
                  connector: null,
                  resource: {
                    id: "r1",
                    root: { type: "attribute", contactAttributeKey: "plan" },
                    qualifier: { operator: "equals" },
                    value: "pro",
                  },
                },
              ],
            },
          },
        });

        expect(outcome.result?.isError, toolText(outcome)).toBe(true);
        expect(answered(outcome)).toMatchObject({ status: 403, code: "forbidden" });
        expect(answered(outcome).detail).toContain("Contact targeting (segments) is not enabled");
      } finally {
        vi.mocked(getIsContactsEnabled).mockResolvedValue(true);
      }
    });

    test("a refusal by the user's own role in a workspace the grant reaches", async () => {
      await setAccess(setup, { access: "organizations", organizationIds: [setup.acmeId] }, WRITE_SURVEYS);
      // Down to a member who only reads "In", through a team.
      await prisma.membership.update({
        where: { userId_organizationId: { userId: setup.userId, organizationId: setup.acmeId } },
        data: { role: "member" },
      });
      const team = await prisma.team.create({ data: { name: "Readers", organizationId: setup.acmeId } });
      await prisma.teamUser.create({ data: { role: "contributor", teamId: team.id, userId: setup.userId } });
      await prisma.workspaceTeam.create({
        data: { permission: "read", teamId: team.id, workspaceId: setup.inside.workspaceId },
      });
      await synchronizeAuthzedIntegrationFixture();

      const outcome = await callMcpTool({ accessToken: setup.accessToken }, "patch_survey", {
        surveyId: setup.inside.surveyId,
        data: { name: "Renamed" },
      });

      expect(outcome.result?.isError, toolText(outcome)).toBe(true);
      expect(answered(outcome)).toMatchObject({ status: 403, code: "forbidden" });
      // Still not found outside the grant, whatever the role there.
      expectNotFound(
        await callMcpTool({ accessToken: setup.accessToken }, "patch_survey", {
          surveyId: setup.elsewhere.surveyId,
          data: { name: "Renamed" },
        })
      );
    });
  });

  // A dashboard-bound read decision is kept 30 seconds per user. The user's own REST read, or a client
  // with All access, must not hand a narrowed client the allow it doesn't have.
  test("a dashboard read the user made over REST doesn't reach a client the grant keeps out", async () => {
    await setAccess(setup, { access: "workspaces", workspaceIds: [setup.inside.workspaceId] });
    const readFilterFields = () =>
      callMcpTool({ accessToken: setup.accessToken }, "list_dashboard_filter_fields", {
        dashboardId: setup.outside.dashboardId,
      });

    expectNotFound(await readFilterFields());

    const rest = await listV3DashboardFilterFields({
      dashboardId: setup.outside.dashboardId,
      authentication: sessionOf(setup.userId),
      requestId: "req_rest",
      instance: "/api/v3",
    });
    expect(rest.status).toBe(200);

    expectNotFound(await readFilterFields());
  });

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

  test("Edit refuses an organization or workspace the user can't pick, and keeps the grant as it was", async () => {
    await setAccess(setup, { access: "workspaces", workspaceIds: [setup.inside.workspaceId] });
    const stranger = await prisma.organization.create({ data: { name: "Stranger" } });
    const strangerWorkspace = await prisma.workspace.create({
      data: { name: "Not mine", organizationId: stranger.id },
    });

    for (const access of [
      { access: "organizations", organizationIds: [setup.acmeId, stranger.id] },
      { access: "workspaces", workspaceIds: [setup.inside.workspaceId, strangerWorkspace.id] },
    ] satisfies TMcpGrantAccessSelection[]) {
      const edited = await editMcpGrant({
        userId: setup.userId,
        clientId: setup.clientId,
        permissions: READ_ALL,
        access,
        isDashboardViewer: false,
      });
      expect(edited).toEqual({
        status: "selection_unavailable",
        field: access.access === "organizations" ? "organizationIds" : "workspaceIds",
      });
    }
    expect(await getMcpGrant(setup.userId, setup.clientId)).toMatchObject({
      access: "workspaces",
      workspaceIds: [setup.inside.workspaceId],
    });
  });

  // Spec story 36: the grant's rows stay when the user loses access, but nothing shows or keeps them.
  describe("after the user loses access to what the grant selects", () => {
    const listed = async () => {
      session.userId = setup.userId;
      const response = await listGrants(new NextRequest("http://localhost:3000/api/internal/mcp-grants"), {
        params: Promise.resolve({}),
      } as never);
      const { data } = (await response.json()) as {
        data: { clients: { clientId: string; access: TMcpGrantAccessSelection }[] };
      };
      return data.clients.find(({ clientId }) => clientId === setup.clientId)?.access;
    };

    /** Acme membership becomes a member's whose team reads only "In": "Out" is lost. */
    const loseOutside = async () => {
      await prisma.membership.update({
        where: { userId_organizationId: { userId: setup.userId, organizationId: setup.acmeId } },
        data: { role: "member" },
      });
      const team = await prisma.team.create({ data: { name: "In only", organizationId: setup.acmeId } });
      await prisma.teamUser.create({ data: { role: "contributor", teamId: team.id, userId: setup.userId } });
      await prisma.workspaceTeam.create({
        data: { permission: "read", teamId: team.id, workspaceId: setup.inside.workspaceId },
      });
      await synchronizeAuthzedIntegrationFixture();
    };

    test("a lost workspace isn't counted, Edit opens without it, and a save drops it without refusing", async () => {
      await setAccess(setup, {
        access: "workspaces",
        workspaceIds: [setup.inside.workspaceId, setup.outside.workspaceId],
      });
      await loseOutside();

      expect(await listed()).toEqual({ access: "workspaces", workspaceIds: [setup.inside.workspaceId] });

      // A permissions-only save, sending the selection Edit opened with.
      const opened = await editMcpGrant({
        userId: setup.userId,
        clientId: setup.clientId,
        permissions: { surveys: "read" },
        access: { access: "workspaces", workspaceIds: [setup.inside.workspaceId] },
        isDashboardViewer: false,
      });
      expect(opened.status).toBe("saved");

      // Resending the stored selection, lost id included, is no refusal either: the lost id is dropped.
      await setAccess(setup, {
        access: "workspaces",
        workspaceIds: [setup.inside.workspaceId],
      });
      await prisma.mcpGrantWorkspace.create({
        data: {
          grantId: (await getMcpGrant(setup.userId, setup.clientId))!.id,
          workspaceId: setup.outside.workspaceId,
        },
      });
      const resent = await editMcpGrant({
        userId: setup.userId,
        clientId: setup.clientId,
        permissions: READ_ALL,
        access: { access: "workspaces", workspaceIds: [setup.inside.workspaceId, setup.outside.workspaceId] },
        isDashboardViewer: false,
      });
      expect(resent.status).toBe("saved");
      expect(await getMcpGrant(setup.userId, setup.clientId)).toMatchObject({
        workspaceIds: [setup.inside.workspaceId],
      });
    });

    test("adding a workspace the user can no longer select is still refused", async () => {
      await setAccess(setup, { access: "workspaces", workspaceIds: [setup.inside.workspaceId] });
      await loseOutside();

      const edited = await editMcpGrant({
        userId: setup.userId,
        clientId: setup.clientId,
        permissions: READ_ALL,
        access: { access: "workspaces", workspaceIds: [setup.inside.workspaceId, setup.outside.workspaceId] },
        isDashboardViewer: false,
      });

      expect(edited).toEqual({ status: "selection_unavailable", field: "workspaceIds" });
    });

    test("an organization now held only as a billing member isn't counted, and a save drops it", async () => {
      await setAccess(setup, { access: "organizations", organizationIds: [setup.acmeId, setup.globexId] });
      await prisma.membership.update({
        where: { userId_organizationId: { userId: setup.userId, organizationId: setup.globexId } },
        data: { role: "billing" },
      });
      await synchronizeAuthzedIntegrationFixture();

      expect(await listed()).toEqual({ access: "organizations", organizationIds: [setup.acmeId] });
      const saved = await editMcpGrant({
        userId: setup.userId,
        clientId: setup.clientId,
        permissions: READ_ALL,
        access: { access: "organizations", organizationIds: [setup.acmeId, setup.globexId] },
        isDashboardViewer: false,
      });
      expect(saved.status).toBe("saved");
      expect(await getMcpGrant(setup.userId, setup.clientId)).toMatchObject({
        organizationIds: [setup.acmeId],
      });
    });
  });

  // A narrowing holds its grant's row `FOR UPDATE` from its SpiceDB delete to its commit, and the
  // reconciling projection reads grants `FOR SHARE`: a reconcile can't write the old access back.
  test("a reconcile racing a narrowing waits for it, and leaves the narrowed access", async () => {
    await setAccess(setup, {
      access: "workspaces",
      workspaceIds: [setup.inside.workspaceId, setup.outside.workspaceId],
    });
    let reconcileSettled = false;
    let reconcile: Promise<unknown> = Promise.resolve();
    const access: TMcpGrantAccessSelection = {
      access: "workspaces",
      workspaceIds: [setup.inside.workspaceId],
    };
    const readableWorkspaceIds = await readMcpGrantReadableWorkspaceIds(setup.userId, access);

    await prisma.$transaction(
      async (tx) => {
        const ids = { userId: setup.userId, clientId: setup.clientId };
        const before = await lockMcpGrant(tx, ids);
        const narrowed = await narrowMcpGrantAccess(tx, {
          userId: setup.userId,
          before,
          access,
          readableWorkspaceIds,
        });
        if (narrowed.status !== "ok") throw new Error("expected the narrowing to resolve");
        // The old access is gone from SpiceDB; a reconcile now starts while the rows still say the old one.
        reconcile = reconcileMcpGrantRelationships({ grantIds: [before!.id] }).then((result) => {
          reconcileSettled = true;
          return result;
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        expect(reconcileSettled).toBe(false);
        await writeMcpGrant(tx, { ...ids, before, permissions: READ_ALL, access: narrowed.access });
      },
      { timeout: 15_000 }
    );

    await expect(reconcile).resolves.toMatchObject({ status: "projected" });
    expectNotFound(
      await callMcpTool({ accessToken: setup.accessToken }, "get_survey", {
        surveyId: setup.outside.surveyId,
      })
    );
  });
});
