import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { capturePostHogEvent, groupIdentifyPostHog } from "@/lib/posthog";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import { getIsWorkflowsEnabled } from "@/modules/ee/license-check/lib/utils";
import { collectOrganizationWorkflowUsage, emitWorkflowUsageSnapshots } from "./usage-snapshot";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/constants", () => ({ IS_FORMBRICKS_CLOUD: true }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn(), groupIdentifyPostHog: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/license", () => ({ getEnterpriseLicense: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsWorkflowsEnabled: vi.fn() }));

const now = new Date("2026-09-03T02:45:00.000Z");

const trigger = {
  id: "trigger",
  type: "trigger",
  triggerType: "response.completed",
  config: { surveyId: "cm9zr4mps000008l8btfy1vtz", endingCardIds: [] },
};
const sendEmail = (id: string) => ({ id, type: "action", actionType: "send_email", config: { to: "x" } });
const ifElse = { id: "branch", type: "if_else", config: { condition: {} } };

const stripe = {
  plan: "scale",
  interval: "monthly",
  subscriptionStatus: "active",
  subscriptionId: "sub_1",
  hasPaymentMethod: true,
  features: ["workflows"],
  lastStripeEventCreatedAt: null,
  lastSyncedAt: null,
  lastSyncedEventId: null,
  trialEnd: null,
  pendingChange: null,
  paymentAttemptError: null,
};
const billing = { limits: { workspaces: null, monthly: { responses: null, workflowRuns: 1000 } }, stripe };
const organizationA = { createdAt: new Date("2026-01-15T00:00:00.000Z"), billing };

const count = (workspaceId: string, status: string, n: number) => ({
  workspaceId,
  status,
  _count: { _all: n },
});

beforeEach(() => {
  vi.clearAllMocks();
  // Organization A: ws1 has two enabled, one draft and one archived; ws2 has one disabled.
  // Organization B: ws3 has only archived workflows and must not be reported.
  vi.mocked(prisma.workflow.groupBy).mockResolvedValue([
    count("ws1", "enabled", 2),
    count("ws1", "draft", 1),
    count("ws1", "archived", 1),
    count("ws2", "disabled", 1),
    count("ws3", "archived", 2),
  ] as never);
  vi.mocked(prisma.workspace.findMany).mockResolvedValue([
    { id: "ws1", organizationId: "orgA", organization: organizationA },
    { id: "ws2", organizationId: "orgA", organization: organizationA },
    { id: "ws3", organizationId: "orgB", organization: { createdAt: new Date("2026-02-01"), billing: null } },
  ] as never);
  vi.mocked(prisma.workflowRun.groupBy).mockResolvedValue([
    count("ws1", "completed", 3),
    count("ws1", "failed", 1),
    count("ws3", "completed", 9),
  ] as never);
  vi.mocked(prisma.workflow.findMany).mockResolvedValue([
    { id: "wfA", workspaceId: "ws1", status: "enabled", definition: { trigger, nodes: [sendEmail("e1")] } },
    {
      id: "wfB",
      workspaceId: "ws1",
      status: "enabled",
      definition: { trigger, nodes: [ifElse, sendEmail("e2")] },
    },
    { id: "wfC", workspaceId: "ws1", status: "draft", definition: { trigger, nodes: [] } },
    { id: "wfD", workspaceId: "ws2", status: "disabled", definition: { trigger: null, nodes: [] } },
  ] as never);
  vi.mocked(getIsWorkflowsEnabled).mockResolvedValue(true);
  vi.mocked(getEnterpriseLicense).mockResolvedValue({ active: false, status: "no-license" } as never);
});

describe("collectOrganizationWorkflowUsage", () => {
  test("aggregates status, node-type and run counts per organization and drops all-archived ones", async () => {
    const [usage, ...rest] = await collectOrganizationWorkflowUsage(now);

    expect(rest).toEqual([]);
    expect(usage.organizationId).toBe("orgA");
    expect(usage.statusCounts).toEqual({ draft: 1, enabled: 2, disabled: 1, archived: 1 });
    expect([...usage.workspaces.keys()].sort()).toEqual(["ws1", "ws2"]);
    expect(usage.workspaces.get("ws2")).toEqual({ draft: 0, enabled: 0, disabled: 1, archived: 0 });
    expect(usage.runs24h).toEqual({ total: 4, completed: 3, failed: 1 });
    // Workflows, not nodes: wfB's two steps count once each, and if_else reports under its own name.
    expect(Object.fromEntries(usage.nodeTypes)).toEqual({
      "response.completed": { kind: "trigger", workflowsTotal: 3, workflowsEnabled: 2 },
      send_email: { kind: "action", workflowsTotal: 2, workflowsEnabled: 2 },
      if_else: { kind: "action", workflowsTotal: 1, workflowsEnabled: 1 },
    });
    expect(usage.context).toEqual({
      createdAt: organizationA.createdAt,
      plan: "scale",
      billingInterval: "monthly",
      subscriptionStatus: "active",
      monthlyWorkflowRunsLimit: 1000,
    });
  });

  test("scopes the run window to the last 24 hours and to real runs", async () => {
    await collectOrganizationWorkflowUsage(now);

    expect(prisma.workflowRun.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isDryRun: false,
          createdAt: { gte: new Date("2026-09-02T02:45:00.000Z") },
        }),
      })
    );
  });

  test("pages through definitions instead of loading them all at once", async () => {
    const page = Array.from({ length: 500 }, (_, index) => ({
      id: `wf${String(index).padStart(4, "0")}`,
      workspaceId: "ws1",
      status: "draft",
      definition: { trigger, nodes: [] },
    }));
    vi.mocked(prisma.workflow.findMany)
      .mockResolvedValueOnce(page as never)
      .mockResolvedValueOnce([] as never);

    const [usage] = await collectOrganizationWorkflowUsage(now);

    expect(prisma.workflow.findMany).toHaveBeenCalledTimes(2);
    expect(vi.mocked(prisma.workflow.findMany).mock.calls[1][0]).toEqual(
      expect.objectContaining({ cursor: { id: "wf0499" }, skip: 1 })
    );
    expect(usage.nodeTypes.get("response.completed")?.workflowsTotal).toBe(500);
  });

  test("returns nothing when no workflow exists", async () => {
    vi.mocked(prisma.workflow.groupBy).mockResolvedValue([] as never);

    await expect(collectOrganizationWorkflowUsage(now)).resolves.toEqual([]);
    expect(prisma.workspace.findMany).not.toHaveBeenCalled();
  });
});

describe("emitWorkflowUsageSnapshots", () => {
  test("emits one usage snapshot, one row per node type, and refreshes both group types", async () => {
    const summary = await emitWorkflowUsageSnapshots(now);

    expect(summary).toEqual({ organizations: 1, workspaces: 2, events: 4 });
    expect(getIsWorkflowsEnabled).toHaveBeenCalledWith("orgA");

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "orgA",
      "workflow_usage_snapshot",
      {
        organization_id: "orgA",
        plan: "scale",
        has_workflows_entitlement: true,
        workflows_total: 5,
        workflows_draft: 1,
        workflows_enabled: 2,
        workflows_disabled: 1,
        workflows_archived: 1,
        workspaces_with_workflows: 2,
        runs_24h_total: 4,
        runs_24h_completed: 3,
        runs_24h_failed: 1,
      },
      { organizationId: "orgA" }
    );
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "orgA",
      "workflow_node_type_snapshot",
      expect.objectContaining({
        node_kind: "action",
        node_type: "if_else",
        workflows_total: 1,
        workflows_enabled: 1,
      }),
      { organizationId: "orgA" }
    );
    const nodeTypeRows = vi
      .mocked(capturePostHogEvent)
      .mock.calls.filter(([, event]) => event === "workflow_node_type_snapshot")
      .map(([, , properties]) => properties?.node_type)
      .sort();
    expect(nodeTypeRows).toEqual(["if_else", "response.completed", "send_email"]);

    expect(groupIdentifyPostHog).toHaveBeenCalledWith("organization", "orgA", {
      plan: "scale",
      billing_interval: "monthly",
      subscription_status: "active",
      deployment: "cloud",
      license_status: null,
      has_workflows_entitlement: true,
      monthly_workflow_runs_limit: 1000,
      workflows_total: 5,
      workflows_enabled: 2,
      organization_created_at: "2026-01-15T00:00:00.000Z",
    });
    expect(groupIdentifyPostHog).toHaveBeenCalledWith("workspace", "ws1", {
      workflows_total: 4,
      workflows_enabled: 2,
    });
    expect(groupIdentifyPostHog).toHaveBeenCalledWith("workspace", "ws2", {
      workflows_total: 1,
      workflows_enabled: 0,
    });
    // The additive merge relies on never sending `name`/`email_domain` from here.
    for (const [, , properties] of vi.mocked(groupIdentifyPostHog).mock.calls) {
      expect(properties).not.toHaveProperty("name");
      expect(properties).not.toHaveProperty("email_domain");
    }
  });

  test("an organization that only archived its workflows is not reported at all", async () => {
    await emitWorkflowUsageSnapshots(now);

    const distinctIds = vi.mocked(capturePostHogEvent).mock.calls.map(([distinctId]) => distinctId);
    expect(distinctIds).not.toContain("orgB");
    expect(groupIdentifyPostHog).not.toHaveBeenCalledWith("organization", "orgB", expect.anything());
  });
});
