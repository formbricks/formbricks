import "server-only";
import { can } from "@/lib/authorization";
import { getFeedbackDirectoryAssignmentAuthorizationAction } from "@/lib/authorization/permission-action";
import {
  getIsDashboardViewerRoleEnabled,
  getIsDashboardsEnabled,
} from "@/modules/ee/license-check/lib/utils";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { getV3AuthorizationActor, getV3SessionUserId, requireV3WorkspaceAccess } from "./auth";
import { problemDashboardsPlanRequired, problemForbidden, problemUnauthorized } from "./response";
import type { TV3Authentication } from "./types";
import type { V3WorkspaceContext } from "./workspace-context";

/**
 * Opt-in for the dashboard-bound reads a Dashboard viewer may make (ADR-0023): the dashboard list and
 * read, a saved chart's data through its dashboard, and a dashboard filter's value list. They are decided
 * by `workspace.dashboard_read` and `feedbackDirectoryAssignment.dashboard_read` in SpiceDB, which admit
 * the workspace's viewers; without the option the caller is asked for `read`, which viewers never hold.
 * It only ever changes a `read`: a write is never asked as a dashboard read, whatever the caller passes.
 */
export type TDashboardViewerAccessOptions = Readonly<{ allowDashboardViewer?: boolean }>;

const isDashboardRead = (
  minPermission: TTeamPermission,
  options: TDashboardViewerAccessOptions | undefined
): boolean => options?.allowDashboardViewer === true && minPermission === "read";

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
  instance?: string,
  options?: TDashboardViewerAccessOptions
): Promise<Response | V3WorkspaceContext> {
  let context = await requireV3WorkspaceAccess(
    authentication,
    workspaceId,
    minPermission,
    requestId,
    instance
  );
  if (context instanceof Response) {
    // `read` is asked first, so everyone but a Dashboard viewer costs exactly the one check it always
    // did. Only a signed-in user refused with 403 on a dashboard-bound read is asked `dashboard_read`;
    // SpiceDB grants that without `read` to a Dashboard viewer alone, so the viewer's own entitlement
    // (Access Control) is checked here, and a lapsed plan answers the same 403.
    if (
      !isDashboardRead(minPermission, options) ||
      context.status !== 403 ||
      !getV3SessionUserId(authentication)
    ) {
      return context;
    }
    const refusal = context;
    const viewerContext = await requireV3WorkspaceAccess(
      authentication,
      workspaceId,
      "dashboardRead",
      requestId,
      instance
    );
    if (
      viewerContext instanceof Response ||
      !(await getIsDashboardViewerRoleEnabled(viewerContext.organizationId))
    ) {
      return refusal;
    }
    context = viewerContext;
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
  instance?: string,
  options?: TDashboardViewerAccessOptions
): Promise<Response | null> {
  const actor = getV3AuthorizationActor(authentication);
  if (!actor) {
    return problemUnauthorized(requestId, "Not authenticated", instance);
  }

  // Only the dashboard-bound reads pass `allowDashboardViewer` (ADR-0023), and ask `dashboard_read`: `read`
  // plus the workspace's Dashboard viewers. The free-form chart query and the field-value lookup never
  // do, so a viewer can only read a dataset through a saved chart on a dashboard.
  const level = isDashboardRead(minPermission, options) ? "dashboardRead" : minPermission;
  const allowed = await can(actor, getFeedbackDirectoryAssignmentAuthorizationAction(level), {
    type: "feedbackDirectoryAssignment",
    feedbackDirectoryId: datasetId,
    workspaceId: context.workspaceId,
  });
  if (allowed) return null;

  return problemForbidden(requestId, "You are not authorized to use this Feedback Dataset", instance);
}
