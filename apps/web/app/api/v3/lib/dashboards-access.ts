import "server-only";
import { can } from "@/lib/authorization";
import { getFeedbackDirectoryAssignmentAuthorizationAction } from "@/lib/authorization/permission-action";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { getV3AuthorizationActor, requireV3WorkspaceAccess } from "./auth";
import { problemDashboardsPlanRequired, problemForbidden, problemUnauthorized } from "./response";
import type { TV3Authentication } from "./types";
import type { V3WorkspaceContext } from "./workspace-context";

/**
 * The gate every chart and dashboard operation runs first (ENG-6584): workspace access at
 * `minPermission`, then the Dashboards entitlement — in that order, as the app has always checked them,
 * so a caller without access learns nothing about the organization's plan.
 *
 * `read` covers every read; `readWrite` covers every write, deletes included — the API-key `write` and
 * `manage` permissions both satisfy it, and a session member needs read & write or manage on the
 * workspace, exactly as the app's server actions required.
 *
 * Returns a `Response` (401/403) to short-circuit on failure, or the resolved workspace context.
 */
export async function requireDashboardsAccess(
  authentication: TV3Authentication,
  workspaceId: string,
  minPermission: TTeamPermission,
  requestId: string,
  instance?: string
): Promise<Response | V3WorkspaceContext> {
  const context = await requireV3WorkspaceAccess(
    authentication,
    workspaceId,
    minPermission,
    requestId,
    instance
  );
  if (context instanceof Response) {
    return context;
  }

  if (!(await getIsDashboardsEnabled(context.organizationId))) {
    return problemDashboardsPlanRequired(requestId, instance);
  }

  return context;
}

/**
 * Whether the caller may use a Feedback Dataset from this workspace at `minPermission`: the dataset must
 * be assigned to the workspace, and the user or API key must hold the permission on that assignment.
 * Reading a chart's data, previewing one and looking up field values need `read`; creating or
 * duplicating a chart needs `readWrite`.
 *
 * A dataset that does not exist, belongs to another organization or is not assigned to the workspace
 * answers the same 403 as one the caller may not use, so dataset ids cannot be probed.
 *
 * Returns `null` when allowed, or the `Response` to send.
 */
export async function refuseUnlessFeedbackDatasetAccess(
  authentication: TV3Authentication,
  context: V3WorkspaceContext,
  datasetId: string,
  minPermission: TTeamPermission,
  requestId: string,
  instance?: string
): Promise<Response | null> {
  const actor = getV3AuthorizationActor(authentication);
  if (!actor) {
    return problemUnauthorized(requestId, "Not authenticated", instance);
  }

  const allowed = await can(actor, getFeedbackDirectoryAssignmentAuthorizationAction(minPermission), {
    type: "feedbackDirectoryAssignment",
    feedbackDirectoryId: datasetId,
    workspaceId: context.workspaceId,
  });

  return allowed
    ? null
    : problemForbidden(requestId, "You are not authorized to use this Feedback Dataset", instance);
}
