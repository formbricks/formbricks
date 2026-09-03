import "server-only";
import { prisma } from "@formbricks/database";
import { ZOrganizationBillingPlanLimits, ZOrganizationStripeBilling } from "@formbricks/types/organizations";
import { type TWorkflowStatus, ZWorkflowStatus, summarizeWorkflowDefinition } from "@formbricks/workflows";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { capturePostHogEvent, groupIdentifyPostHog } from "@/lib/posthog";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import { getIsWorkflowsEnabled } from "@/modules/ee/license-check/lib/utils";
import { WORKFLOW_NODE_TYPE_SNAPSHOT_EVENT, WORKFLOW_USAGE_SNAPSHOT_EVENT } from "../analytics-events";

const RUN_WINDOW_MS = 24 * 60 * 60 * 1000;
// Definitions are walked in pages so a self-hosted instance with thousands of workflows never loads
// them all at once; the shape summary only needs the `definition` column.
const DEFINITION_PAGE_SIZE = 500;

type StatusCounts = Record<TWorkflowStatus, number>;
type NodeKind = "trigger" | "action";

interface NodeTypeUsage {
  kind: NodeKind;
  workflowsTotal: number;
  workflowsEnabled: number;
}

interface OrganizationContext {
  createdAt: Date;
  plan: string | null;
  billingInterval: string | null;
  subscriptionStatus: string | null;
  monthlyWorkflowRunsLimit: number | null;
}

export interface OrganizationWorkflowUsage {
  organizationId: string;
  context: OrganizationContext;
  statusCounts: StatusCounts;
  /** Per workspace in this organization that has at least one workflow, archived included. */
  workspaces: Map<string, StatusCounts>;
  /** Keyed by concrete node type (`response.completed`, `send_email`, `if_else`). */
  nodeTypes: Map<string, NodeTypeUsage>;
  runs24h: { total: number; completed: number; failed: number };
}

const emptyStatusCounts = (): StatusCounts => ({ draft: 0, enabled: 0, disabled: 0, archived: 0 });

const liveWorkflowCount = (counts: StatusCounts): number => counts.draft + counts.enabled + counts.disabled;

/**
 * Plan facts for the organization group. Cloud reads the Stripe snapshot; self-hosted has no plan,
 * so the license tier stands in and the `plan` breakdown still separates both worlds in one tile.
 */
const toOrganizationContext = (
  organization: { createdAt: Date; billing: { limits: unknown; stripe: unknown } | null },
  licenseActive: boolean
): OrganizationContext => {
  const stripe = ZOrganizationStripeBilling.safeParse(organization.billing?.stripe);
  const limits = ZOrganizationBillingPlanLimits.safeParse(organization.billing?.limits);
  const cloudPlan = stripe.success ? (stripe.data.plan ?? null) : null;
  let plan: string | null = cloudPlan;
  if (!IS_FORMBRICKS_CLOUD) plan = licenseActive ? "self_hosted_enterprise" : "self_hosted_community";

  return {
    createdAt: organization.createdAt,
    plan,
    billingInterval: stripe.success ? (stripe.data.interval ?? null) : null,
    subscriptionStatus: stripe.success ? (stripe.data.subscriptionStatus ?? null) : null,
    monthlyWorkflowRunsLimit: limits.success ? (limits.data.monthly.workflowRuns ?? null) : null,
  };
};

/**
 * One read pass over the workflow tables, aggregated per organization. Status counts come from an
 * index-backed `groupBy`; the node-type mix needs the definitions, which are paged through so the
 * pass never holds more than a page of JSON. Only organizations with at least one live (non-archived)
 * workflow come back: an organization that merely archived everything is no longer a Workflows user.
 */
export const collectOrganizationWorkflowUsage = async (now: Date): Promise<OrganizationWorkflowUsage[]> => {
  const statusRows = await prisma.workflow.groupBy({
    by: ["workspaceId", "status"],
    _count: { _all: true },
  });
  if (statusRows.length === 0) return [];

  const workspaceIds = [...new Set(statusRows.map((row) => row.workspaceId))];
  const [workspaces, runRows, license] = await Promise.all([
    prisma.workspace.findMany({
      where: { id: { in: workspaceIds } },
      select: {
        id: true,
        organizationId: true,
        organization: { select: { createdAt: true, billing: { select: { limits: true, stripe: true } } } },
      },
    }),
    prisma.workflowRun.groupBy({
      by: ["workspaceId", "status"],
      where: {
        workspaceId: { in: workspaceIds },
        isDryRun: false,
        createdAt: { gte: new Date(now.getTime() - RUN_WINDOW_MS) },
      },
      _count: { _all: true },
    }),
    IS_FORMBRICKS_CLOUD ? Promise.resolve(null) : getEnterpriseLicense(),
  ]);

  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const usageByOrganization = new Map<string, OrganizationWorkflowUsage>();
  const usageForWorkspace = (workspaceId: string): OrganizationWorkflowUsage | null => {
    const workspace = workspaceById.get(workspaceId);
    if (!workspace) return null;
    let usage = usageByOrganization.get(workspace.organizationId);
    if (!usage) {
      usage = {
        organizationId: workspace.organizationId,
        context: toOrganizationContext(workspace.organization, license?.active ?? false),
        statusCounts: emptyStatusCounts(),
        workspaces: new Map(),
        nodeTypes: new Map(),
        runs24h: { total: 0, completed: 0, failed: 0 },
      };
      usageByOrganization.set(workspace.organizationId, usage);
    }
    return usage;
  };

  for (const row of statusRows) {
    const usage = usageForWorkspace(row.workspaceId);
    const status = ZWorkflowStatus.safeParse(row.status);
    if (!usage || !status.success) continue;
    const workspaceCounts = usage.workspaces.get(row.workspaceId) ?? emptyStatusCounts();
    workspaceCounts[status.data] += row._count._all;
    usage.workspaces.set(row.workspaceId, workspaceCounts);
    usage.statusCounts[status.data] += row._count._all;
  }

  for (const row of runRows) {
    const usage = usageForWorkspace(row.workspaceId);
    if (!usage) continue;
    usage.runs24h.total += row._count._all;
    if (row.status === "completed") usage.runs24h.completed += row._count._all;
    if (row.status === "failed") usage.runs24h.failed += row._count._all;
  }

  // Node-type mix, counting workflows (not nodes): a workflow with two emails is one send_email user.
  let cursor: string | undefined;
  for (;;) {
    const page = await prisma.workflow.findMany({
      where: { status: { not: "archived" } },
      select: { id: true, workspaceId: true, status: true, definition: true },
      orderBy: { id: "asc" },
      take: DEFINITION_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const workflow of page) {
      const usage = usageForWorkspace(workflow.workspaceId);
      if (!usage) continue;
      const summary = summarizeWorkflowDefinition(workflow.definition);
      const seen: Array<[string, NodeKind]> = [
        ...(summary.triggerType ? [[summary.triggerType, "trigger"] as [string, NodeKind]] : []),
        ...summary.actionTypes.map((type) => [type, "action"] as [string, NodeKind]),
      ];
      for (const [type, kind] of seen) {
        const entry = usage.nodeTypes.get(type) ?? { kind, workflowsTotal: 0, workflowsEnabled: 0 };
        entry.workflowsTotal += 1;
        if (workflow.status === "enabled") entry.workflowsEnabled += 1;
        usage.nodeTypes.set(type, entry);
      }
    }
    if (page.length < DEFINITION_PAGE_SIZE) break;
    cursor = page[page.length - 1].id;
  }

  return [...usageByOrganization.values()].filter((usage) => liveWorkflowCount(usage.statusCounts) > 0);
};

export interface WorkflowUsageSnapshotSummary {
  organizations: number;
  workspaces: number;
  events: number;
}

/**
 * Emit the daily PostHog snapshot (ENG-2851): per organization one `workflow_usage_snapshot`, one
 * `workflow_node_type_snapshot` per node type in use, and a refresh of the organization and
 * workspace group properties. Group identify merges the keys passed and leaves the existing `name`
 * and `email_domain` untouched. The organization id is the distinct id, following
 * `survey_response_received`: there is no acting user in a scheduled job.
 */
export const emitWorkflowUsageSnapshots = async (now: Date): Promise<WorkflowUsageSnapshotSummary> => {
  const usages = await collectOrganizationWorkflowUsage(now);
  const licenseStatus = IS_FORMBRICKS_CLOUD ? null : (await getEnterpriseLicense()).status;
  const deployment = IS_FORMBRICKS_CLOUD ? "cloud" : "self_hosted";
  let events = 0;
  let workspaces = 0;

  for (const usage of usages) {
    const { organizationId, context, statusCounts, runs24h } = usage;
    const hasWorkflowsEntitlement = await getIsWorkflowsEnabled(organizationId);
    const groups = { organizationId };
    const workflowsTotal =
      statusCounts.draft + statusCounts.enabled + statusCounts.disabled + statusCounts.archived;

    capturePostHogEvent(
      organizationId,
      WORKFLOW_USAGE_SNAPSHOT_EVENT,
      {
        organization_id: organizationId,
        plan: context.plan,
        has_workflows_entitlement: hasWorkflowsEntitlement,
        workflows_total: workflowsTotal,
        workflows_draft: statusCounts.draft,
        workflows_enabled: statusCounts.enabled,
        workflows_disabled: statusCounts.disabled,
        workflows_archived: statusCounts.archived,
        workspaces_with_workflows: usage.workspaces.size,
        runs_24h_total: runs24h.total,
        runs_24h_completed: runs24h.completed,
        runs_24h_failed: runs24h.failed,
      },
      groups
    );
    events += 1;

    for (const [nodeType, nodeUsage] of usage.nodeTypes) {
      capturePostHogEvent(
        organizationId,
        WORKFLOW_NODE_TYPE_SNAPSHOT_EVENT,
        {
          organization_id: organizationId,
          plan: context.plan,
          node_kind: nodeUsage.kind,
          node_type: nodeType,
          workflows_total: nodeUsage.workflowsTotal,
          workflows_enabled: nodeUsage.workflowsEnabled,
        },
        groups
      );
      events += 1;
    }

    groupIdentifyPostHog("organization", organizationId, {
      plan: context.plan,
      billing_interval: context.billingInterval,
      subscription_status: context.subscriptionStatus,
      deployment,
      license_status: licenseStatus,
      has_workflows_entitlement: hasWorkflowsEntitlement,
      monthly_workflow_runs_limit: context.monthlyWorkflowRunsLimit,
      workflows_total: workflowsTotal,
      workflows_enabled: statusCounts.enabled,
      organization_created_at: context.createdAt.toISOString(),
    });

    for (const [workspaceId, counts] of usage.workspaces) {
      groupIdentifyPostHog("workspace", workspaceId, {
        workflows_total: counts.draft + counts.enabled + counts.disabled + counts.archived,
        workflows_enabled: counts.enabled,
      });
      workspaces += 1;
    }
  }

  return { organizations: usages.length, workspaces, events };
};
