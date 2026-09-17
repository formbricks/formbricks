import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import type { WorkflowAnalyticsDetail } from "@formbricks/workflows/server";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { capturePostHogEvent } from "@/lib/posthog";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";
import {
  buildRecordAnalytics,
  resolveWorkflowAnalyticsVia,
  toWorkflowLifecycleEventProperties,
} from "./analytics";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: vi.fn() }));

const userId = "cm9zr52kh000508l8e3q7bw9j";
const sessionAuth = { user: { id: userId }, expires: "2026-12-01" } as unknown as TV3Authentication;
const apiKeyAuth = {
  type: "apiKey",
  apiKeyId: "key_1",
  organizationId: "org_from_key",
  organizationAccess: { accessControl: { read: true, write: true } },
  workspacePermissions: [],
} as unknown as TAuthenticationApiKey;

const detail: WorkflowAnalyticsDetail = {
  operation: "enabled",
  workflowId: "wf_1",
  workspaceId: "ws_1",
  status: "enabled",
  previousStatus: "draft",
  createdAt: new Date("2026-09-01T10:00:00.000Z"),
  definition: {
    triggerType: "response.completed",
    actionTypes: ["if_else", "send_email"],
    actionCount: 3,
    nodeCount: 4,
  },
  options: {
    endingScope: "specific",
    emailRecipientKind: "element",
    attachResponseData: true,
    includeVariables: false,
    includeHiddenFields: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue("org_from_workspace");
});

describe("resolveWorkflowAnalyticsVia", () => {
  test("a session is the UI, an API key is the API, and the MCP route wins over both", () => {
    expect(resolveWorkflowAnalyticsVia(sessionAuth, "https://app.formbricks.com/api/v3/workflows")).toBe(
      "ui"
    );
    expect(resolveWorkflowAnalyticsVia(apiKeyAuth, "https://app.formbricks.com/api/v3/workflows")).toBe(
      "api"
    );
    expect(resolveWorkflowAnalyticsVia(apiKeyAuth, MCP_API_ROUTE)).toBe("mcp");
    expect(resolveWorkflowAnalyticsVia(sessionAuth, MCP_API_ROUTE)).toBe("mcp");
    expect(resolveWorkflowAnalyticsVia(null, "inst")).toBe("ui");
  });
});

describe("toWorkflowLifecycleEventProperties", () => {
  test("flattens the detail into snake_case properties with a stable joined type key", () => {
    const properties = toWorkflowLifecycleEventProperties(detail, {
      organizationId: "org_1",
      via: "ui",
      now: new Date("2026-09-03T13:30:00.000Z"),
    });

    expect(properties).toEqual({
      workflow_id: "wf_1",
      workspace_id: "ws_1",
      organization_id: "org_1",
      via: "ui",
      status: "enabled",
      previous_status: "draft",
      hours_since_created: 51.5,
      trigger_type: "response.completed",
      action_types: ["if_else", "send_email"],
      action_types_joined: "if_else,send_email",
      action_count: 3,
      node_count: 4,
      ending_scope: "specific",
      email_recipient_kind: "element",
      attach_response_data: true,
      include_variables: false,
      include_hidden_fields: null,
      source_workflow_id: undefined,
      test_ok: undefined,
    });
  });
});

describe("buildRecordAnalytics", () => {
  test("a signed-in user is the distinct id and the organization is resolved from the workspace", async () => {
    await buildRecordAnalytics(sessionAuth, "https://app.formbricks.com/api/v3/workflows/wf_1")(detail);

    expect(getOrganizationIdFromWorkspaceId).toHaveBeenCalledWith("ws_1");
    expect(capturePostHogEvent).toHaveBeenCalledTimes(1);
    const [distinctId, event, properties, groups] = vi.mocked(capturePostHogEvent).mock.calls[0];
    expect(distinctId).toBe(userId);
    expect(event).toBe("workflow_enabled");
    expect(properties).toEqual(
      expect.objectContaining({
        via: "ui",
        organization_id: "org_from_workspace",
        trigger_type: "response.completed",
      })
    );
    expect(groups).toEqual({ organizationId: "org_from_workspace", workspaceId: "ws_1" });
  });

  test("an API key uses its own organization as the distinct id without a workspace lookup", async () => {
    await buildRecordAnalytics(
      apiKeyAuth,
      "https://app.formbricks.com/api/v3/workflows/wf_1"
    )({
      ...detail,
      operation: "created",
    });

    expect(getOrganizationIdFromWorkspaceId).not.toHaveBeenCalled();
    const [distinctId, event, properties] = vi.mocked(capturePostHogEvent).mock.calls[0];
    expect(distinctId).toBe("org_from_key");
    expect(event).toBe("workflow_created");
    expect(properties).toEqual(expect.objectContaining({ via: "api", organization_id: "org_from_key" }));
  });

  test("the MCP route is reported as via mcp", async () => {
    await buildRecordAnalytics(apiKeyAuth, MCP_API_ROUTE)({ ...detail, operation: "tested", testOk: true });

    const [, event, properties] = vi.mocked(capturePostHogEvent).mock.calls[0];
    expect(event).toBe("workflow_tested");
    expect(properties).toEqual(expect.objectContaining({ via: "mcp", test_ok: true }));
  });
});
