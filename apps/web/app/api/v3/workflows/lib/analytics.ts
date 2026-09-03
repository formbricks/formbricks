import "server-only";
import { joinWorkflowActionTypes } from "@formbricks/workflows";
import type { WorkflowAnalyticsDetail, WorkflowApiContext } from "@formbricks/workflows/server";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { capturePostHogEvent } from "@/lib/posthog";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import {
  type TWorkflowAnalyticsVia,
  WORKFLOW_LIFECYCLE_EVENTS,
} from "@/modules/ee/workflows/lib/analytics-events";
import { MCP_API_ROUTE } from "@/modules/mcp/constants";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Which surface issued the request. The MCP tools build their context with the MCP route as the
 * problem-document `instance`, which is the one thing that distinguishes them from a plain API call
 * made with the same key.
 */
export const resolveWorkflowAnalyticsVia = (
  authentication: TV3Authentication,
  instance: string
): TWorkflowAnalyticsVia => {
  if (instance === MCP_API_ROUTE) return "mcp";
  if (authentication && "apiKeyId" in authentication) return "api";
  return "ui";
};

/**
 * Flatten a package detail into the snake_case property set the dashboards break down on. Pure, so
 * the mapping is unit-tested without PostHog; `now` is injected for the `hours_since_created` math.
 * `deployment` is not set here: `capturePostHogEvent` stamps it on every server event.
 */
export const toWorkflowLifecycleEventProperties = (
  detail: WorkflowAnalyticsDetail,
  context: { organizationId: string; via: TWorkflowAnalyticsVia; now: Date }
) => ({
  workflow_id: detail.workflowId,
  workspace_id: detail.workspaceId,
  organization_id: context.organizationId,
  via: context.via,
  status: detail.status,
  previous_status: detail.previousStatus,
  hours_since_created: Math.round(((context.now.getTime() - detail.createdAt.getTime()) / HOUR_MS) * 10) / 10,
  trigger_type: detail.definition.triggerType,
  action_types: detail.definition.actionTypes,
  action_types_joined: joinWorkflowActionTypes(detail.definition.actionTypes),
  action_count: detail.definition.actionCount,
  node_count: detail.definition.nodeCount,
  ending_scope: detail.options.endingScope,
  email_recipient_kind: detail.options.emailRecipientKind,
  attach_response_data: detail.options.attachResponseData,
  include_variables: detail.options.includeVariables,
  include_hidden_fields: detail.options.includeHiddenFields,
  source_workflow_id: detail.sourceWorkflowId,
  test_ok: detail.testOk,
});

/**
 * Bind the package's analytics sink to PostHog for this request. Person attribution follows who
 * acted: a signed-in user is the distinct id; an API key has no user, so the organization stands in
 * (the precedent set by `survey_response_received`) rather than minting a PostHog person per key.
 * Organization resolution mirrors `buildRecordAudit`: the API-key path already carries its org, the
 * session path resolves it from the workspace.
 *
 * May reject (workspace lookup); the package awaits this sink inside its own catch and logs, so a
 * rejection can never fail the mutation that already succeeded.
 */
export const buildRecordAnalytics =
  (authentication: TV3Authentication, instance: string): NonNullable<WorkflowApiContext["recordAnalytics"]> =>
  async (detail) => {
    const via = resolveWorkflowAnalyticsVia(authentication, instance);
    const organizationId =
      authentication && "apiKeyId" in authentication
        ? authentication.organizationId
        : await getOrganizationIdFromWorkspaceId(detail.workspaceId);
    const userId = authentication && "user" in authentication ? authentication.user?.id : undefined;

    capturePostHogEvent(
      userId ?? organizationId,
      WORKFLOW_LIFECYCLE_EVENTS[detail.operation],
      toWorkflowLifecycleEventProperties(detail, { organizationId, via, now: new Date() }),
      { organizationId, workspaceId: detail.workspaceId }
    );
  };
