import type { AuthInfo } from "@modelcontextprotocol/server";
import { describe, expect, test, vi } from "vitest";
import { type TMcpPermissionRequirement, getMcpPermissionScope } from "../permissions";

/**
 * Every MCP tool's declared permissions, checked against the scopes each tool was gated on before tools
 * declared permissions (ENG-7148). The table below was captured from the scope-based registrations, so
 * this proves the switch kept every tool allowed and refused for exactly the same scopes, and it pins
 * the roster: a tool added or removed without updating it fails here.
 *
 * It walks every registration across the tool modules, as `tool-annotations.test.ts` does.
 */

type TDeclared =
  | readonly TMcpPermissionRequirement[]
  | { anyOf: readonly TMcpPermissionRequirement[] }
  | { byInput: (input: unknown, authInfo: AuthInfo | undefined) => readonly TMcpPermissionRequirement[] };

const registrations = vi.hoisted((): { name: string; permissions: TDeclared }[] => []);

vi.mock("./guard-permissions", () => ({
  registerMcpTool: (_server: unknown, name: string, _config: unknown, permissions: TDeclared) => {
    registrations.push({ name, permissions });
  },
}));
// Importing the real response operations pulls in modules that do not load under the unit setup; the
// declarations under test do not depend on them.
vi.mock("@/app/api/v3/responses/lib/operations", () => ({}));
vi.mock("@/app/api/v3/responses/lib/validate-operations", () => ({}));
vi.mock("@/app/api/v3/tags/lib/operations", () => ({}));

type TScopeGate =
  | string[]
  | { anyOf: string[] }
  | {
      byInput: {
        viewerWithDashboard: string[];
        viewerNoDashboard: string[];
        otherWithDashboard: string[];
        otherNoDashboard: string[];
      };
    };

/** The scope gate of every tool before ENG-7148, in registration order. */
const SCOPES_BEFORE_PERMISSIONS: Record<string, TScopeGate> = {
  list_surveys: ["surveys:read"],
  get_survey: ["surveys:read"],
  create_survey: ["surveys:write"],
  generate_survey: ["surveys:write"],
  validate_survey: ["surveys:read"],
  patch_survey: ["surveys:write"],
  edit_survey_blocks: ["surveys:write"],
  set_survey_block_order: ["surveys:write"],
  delete_survey: ["surveys:write"],
  list_workflows: ["workflows:read"],
  get_workflow: ["workflows:read"],
  list_workflow_runs: ["workflows:read"],
  get_workflow_run: ["workflows:read"],
  test_workflow: ["workflows:read"],
  create_workflow: ["workflows:write"],
  patch_workflow: ["workflows:write"],
  duplicate_workflow: ["workflows:write"],
  delete_workflow: ["workflows:write"],
  enable_workflow: ["workflows:write"],
  disable_workflow: ["workflows:write"],
  archive_workflow: ["workflows:write"],
  unarchive_workflow: ["workflows:write"],
  // ENG-7153: any permission at Read, in registry order; the same six scopes as before.
  list_workspaces: {
    anyOf: [
      "surveys:read",
      "responses:read",
      "workflows:read",
      "dashboards:read",
      "feedbackRecords:read",
      "audience:read",
    ],
  },
  get_workspace_custom_css: ["surveys:read"],
  patch_workspace_custom_css: ["surveys:write"],
  list_feedback_datasets: ["feedbackRecords:read"],
  list_feedback_records: ["feedbackRecords:read"],
  count_feedback_records: ["feedbackRecords:read"],
  get_feedback_record: ["feedbackRecords:read"],
  create_feedback_record: ["feedbackRecords:write"],
  create_feedback_records: ["feedbackRecords:write"],
  update_feedback_record: ["feedbackRecords:write"],
  delete_feedback_record: ["feedbackRecords:write"],
  search_feedback_records: ["feedbackRecords:read"],
  find_similar_feedback_records: ["feedbackRecords:read"],
  list_responses: ["responses:read"],
  count_responses: ["responses:read"],
  get_response: ["responses:read"],
  validate_response: ["responses:write"],
  create_response: ["responses:write"],
  update_response: ["responses:write"],
  delete_response: ["responses:write"],
  batch_delete_responses: ["responses:write"],
  set_responses_outcome: ["responses:write"],
  list_creatives: ["surveys:read"],
  get_creative: ["surveys:read"],
  get_creative_stats: ["surveys:read"],
  create_creative: ["surveys:write"],
  patch_creative: ["surveys:write"],
  delete_creative: ["surveys:write"],
  duplicate_creative: ["surveys:write"],
  archive_creative: ["surveys:write"],
  restore_creative: ["surveys:write"],
  list_chart_fields: ["dashboards:read", "feedbackRecords:read"],
  list_charts: ["dashboards:read", "feedbackRecords:read"],
  get_chart: ["dashboards:read", "feedbackRecords:read"],
  preview_chart: ["dashboards:read", "feedbackRecords:read"],
  create_chart: ["dashboards:write"],
  update_chart: ["dashboards:write"],
  get_chart_data: {
    byInput: {
      viewerWithDashboard: ["dashboards:read"],
      viewerNoDashboard: ["dashboards:read", "feedbackRecords:read"],
      otherWithDashboard: ["dashboards:read", "feedbackRecords:read"],
      otherNoDashboard: ["dashboards:read", "feedbackRecords:read"],
    },
  },
  list_dashboard_filter_fields: {
    byInput: {
      viewerWithDashboard: ["dashboards:read"],
      viewerNoDashboard: ["dashboards:read"],
      otherWithDashboard: ["dashboards:read", "feedbackRecords:read"],
      otherNoDashboard: ["dashboards:read", "feedbackRecords:read"],
    },
  },
  list_dashboard_filter_values: {
    byInput: {
      viewerWithDashboard: ["dashboards:read"],
      viewerNoDashboard: ["dashboards:read"],
      otherWithDashboard: ["dashboards:read", "feedbackRecords:read"],
      otherNoDashboard: ["dashboards:read", "feedbackRecords:read"],
    },
  },
  list_chart_field_values: ["dashboards:read", "feedbackRecords:read"],
  list_dashboards: ["dashboards:read"],
  get_dashboard: ["dashboards:read"],
  create_dashboard: ["dashboards:write"],
  update_dashboard: ["dashboards:write"],
  duplicate_dashboard: ["dashboards:write"],
  add_chart_to_dashboard: ["dashboards:write"],
  update_widget: ["dashboards:write"],
  remove_chart_from_dashboard: ["dashboards:write"],
  update_dashboard_layout: ["dashboards:write"],
  set_dashboard_filters: ["dashboards:write"],
  duplicate_chart: ["dashboards:write"],
  list_tags: ["responses:read"],
  update_tag: ["responses:write"],
  merge_tags: ["responses:write"],
  // ENG-7151: new tools, on the new read-only family.
  list_contacts: ["audience:read"],
  list_contact_attribute_keys: ["audience:read"],
  list_contact_attribute_values: ["audience:read"],
  list_segments: ["audience:read"],
  list_action_classes: ["audience:read"],
};

const VIEWER = { extra: { dashboardViewerOnly: true } } as unknown as AuthInfo;
const NOT_VIEWER = { extra: {} } as unknown as AuthInfo;

const toScopes = (requirements: readonly TMcpPermissionRequirement[]): string[] => [
  ...new Set(requirements.map(getMcpPermissionScope)),
];

const toScopeGate = (permissions: TDeclared): TScopeGate => {
  if ("anyOf" in permissions) return { anyOf: toScopes(permissions.anyOf) };
  if ("byInput" in permissions) {
    return {
      byInput: {
        viewerWithDashboard: toScopes(permissions.byInput({ dashboardId: "d" }, VIEWER)),
        viewerNoDashboard: toScopes(permissions.byInput({}, VIEWER)),
        otherWithDashboard: toScopes(permissions.byInput({ dashboardId: "d" }, NOT_VIEWER)),
        otherNoDashboard: toScopes(permissions.byInput({}, NOT_VIEWER)),
      },
    };
  }
  return toScopes(permissions);
};

const loadRegistrations = async () => {
  const [surveys, workflows, workspaces, feedbackRecords, responses, creatives, dashboards, tags] =
    await Promise.all([
      import("./surveys"),
      import("./workflows"),
      import("./workspaces"),
      import("./feedback-records"),
      import("./responses"),
      import("./creatives"),
      import("./dashboards"),
      import("./tags"),
    ]);
  const server = { registerTool: vi.fn() } as unknown as Parameters<typeof surveys.registerSurveyTools>[0];
  surveys.registerSurveyTools(server);
  workflows.registerWorkflowTools(server);
  workspaces.registerWorkspaceTools(server);
  feedbackRecords.registerFeedbackRecordTools(server);
  responses.registerResponseTools(server);
  creatives.registerCreativeTools(server);
  dashboards.registerDashboardTools(server);
  tags.registerTagTools(server);
  (await import("./audience")).registerAudienceTools(server);
  return registrations;
};

describe("MCP tool permissions", () => {
  test("gate every tool on exactly the scopes it was gated on before", { timeout: 120_000 }, async () => {
    const tools = await loadRegistrations();

    expect(
      Object.fromEntries(tools.map(({ name, permissions }) => [name, toScopeGate(permissions)]))
    ).toEqual(SCOPES_BEFORE_PERMISSIONS);
  });

  test("chart reads declare both Charts and Feedback records", { timeout: 120_000 }, async () => {
    const tools = new Map((await loadRegistrations()).map(({ name, permissions }) => [name, permissions]));
    const chartAndRecords = [
      { permission: "charts", level: "read" },
      { permission: "feedbackRecords", level: "read" },
    ];

    for (const name of [
      "list_chart_fields",
      "list_charts",
      "get_chart",
      "preview_chart",
      "list_chart_field_values",
    ]) {
      expect(tools.get(name), name).toEqual(chartAndRecords);
    }
    // Outside a Dashboard viewer's read through a dashboard (ADR-0025), chart data needs both too.
    const getChartData = tools.get("get_chart_data") as Extract<TDeclared, { byInput: unknown }>;
    expect(getChartData.byInput({ chartId: "c" }, NOT_VIEWER)).toEqual(chartAndRecords);
    expect(getChartData.byInput({ chartId: "c", dashboardId: "d" }, VIEWER)).toEqual([
      { permission: "dashboards", level: "read" },
    ]);
  });
});
