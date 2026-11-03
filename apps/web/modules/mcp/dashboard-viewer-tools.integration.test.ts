import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { type TDashboardsFixture, seedDashboardsFixture, sessionOf } from "@/integration/dashboards-fixture";
import { trimScopesForDashboardViewer } from "@/modules/auth/lib/dashboard-viewer-oauth-scopes";
import { MCP_OAUTH_SCOPES } from "@/modules/auth/lib/oauth-urls";
import { registerCreativeTools } from "./tools/creatives";
import { registerDashboardTools } from "./tools/dashboards";
import { registerFeedbackRecordTools } from "./tools/feedback-records";
import { registerResponseTools } from "./tools/responses";
import { registerSurveyTools } from "./tools/surveys";
import { registerWorkflowTools } from "./tools/workflows";
import { registerWorkspaceTools } from "./tools/workspaces";

/**
 * ENG-6903 against real PostgreSQL and SpiceDB: a Dashboard viewer's MCP token (consent narrowed it to
 * dashboards:read) reaches its workspaces' dashboards and nothing else. Every registered tool is called
 * through its scope guard; the ones the scope admits are refused by the operation behind them.
 */

vi.mock("@cubejs-client/core", async (importOriginal) =>
  (await import("@/integration/cube-fake")).fakeCubeModule(await importOriginal())
);
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsDashboardsEnabled: vi.fn(async () => true),
  getIsDashboardViewerRoleEnabled: vi.fn(async () => true),
}));

type TToolHandler = (input: unknown, ctx: unknown) => Promise<CallToolResult>;

const tools = new Map<string, TToolHandler>();
const fakeServer = {
  registerTool: (name: string, _config: unknown, handler: TToolHandler) => tools.set(name, handler),
} as unknown as McpServer;
for (const register of [
  registerSurveyTools,
  registerWorkflowTools,
  registerWorkspaceTools,
  registerFeedbackRecordTools,
  registerResponseTools,
  registerCreativeTools,
  registerDashboardTools,
]) {
  register(fakeServer);
}

/** The dashboard reads a viewer's token may use; every other tool must refuse it. */
const VIEWER_TOOLS = new Set(["list_workspaces", "list_dashboards", "get_dashboard"]);

let fixture: TDashboardsFixture;
const ids = { viewer: "", dashboard: "", chart: "", survey: "" };

const call = (name: string, input: Record<string, unknown>) => {
  const handler = tools.get(name);
  if (!handler) throw new Error(`no tool ${name}`);
  return handler(input, {
    http: {
      authInfo: {
        token: "oauth:viewer",
        clientId: "client",
        scopes: trimScopesForDashboardViewer([...MCP_OAUTH_SCOPES]),
        extra: { formbricksAuthentication: sessionOf(ids.viewer), requestId: "req", authMethod: "oauth" },
      },
    },
  });
};

beforeAll(async () => {
  fixture = await seedDashboardsFixture();
  const user = await prisma.user.create({ data: { email: "mcp-viewer@viewer.test", name: "Viewer" } });
  ids.viewer = user.id;
  await prisma.membership.create({
    data: {
      accepted: true,
      organizationId: fixture.organizationId,
      role: "dashboard_viewer",
      userId: user.id,
    },
  });
  const team = await prisma.team.create({
    data: { name: "MCP viewers", organizationId: fixture.organizationId },
  });
  await prisma.teamUser.create({ data: { role: "contributor", teamId: team.id, userId: user.id } });
  await prisma.workspaceTeam.create({
    data: { permission: "read", teamId: team.id, workspaceId: fixture.workspaceId },
  });

  ids.chart = (
    await prisma.chart.create({
      data: {
        name: "C",
        type: "bar",
        workspaceId: fixture.workspaceId,
        feedbackDirectoryId: fixture.datasetId,
        query: { measures: ["FeedbackRecords.count"] },
        config: {},
      },
    })
  ).id;
  ids.dashboard = (
    await prisma.dashboard.create({
      data: { name: "D", workspaceId: fixture.workspaceId, createdBy: fixture.users.owner },
    })
  ).id;
  ids.survey = (await prisma.survey.create({ data: { name: "S", workspaceId: fixture.workspaceId } })).id;

  await synchronizeAuthzedIntegrationFixture();
}, 120_000);

describe("a Dashboard viewer's MCP token", () => {
  test("lists only the workspaces its team is granted", async () => {
    const result = await call("list_workspaces", {});

    expect(result.isError).toBeFalsy();
    const ids_ = ((result.structuredContent as { data: { id: string }[] }).data ?? []).map(({ id }) => id);
    expect(ids_).toEqual([fixture.workspaceId]);
  });

  test("lists and reads the granted workspace's dashboards", async () => {
    const listed = await call("list_dashboards", { workspaceId: fixture.workspaceId, limit: 20 });
    expect(listed.isError).toBeFalsy();

    const read = await call("get_dashboard", { dashboardId: ids.dashboard });
    expect(read.isError).toBeFalsy();
  });

  test("is refused the dashboards of a workspace its team is not granted", async () => {
    const listed = await call("list_dashboards", { workspaceId: fixture.otherWorkspaceId, limit: 20 });
    expect(listed.isError).toBe(true);
  });

  test("every other tool refuses it", async () => {
    const input = {
      workspaceId: fixture.workspaceId,
      datasetId: fixture.datasetId,
      dashboardId: ids.dashboard,
      chartId: ids.chart,
      surveyId: ids.survey,
      field: "sourceName",
      name: "X",
      type: "bar",
      query: { measures: ["FeedbackRecords.count"] },
    };

    const others = [...tools.keys()].filter((name) => !VIEWER_TOOLS.has(name));
    expect(others.length).toBeGreaterThan(40);
    for (const name of others) {
      const result = await call(name, input);
      expect(result.isError, `${name} answered ${JSON.stringify(result).slice(0, 300)}`).toBe(true);
      // The refusal is the scope guard's or the operation's 403, never a successful payload.
      expect(JSON.stringify(result), name).toMatch(/insufficient_scope|forbidden|not authorized|403/i);
    }
  }, 120_000);
});
