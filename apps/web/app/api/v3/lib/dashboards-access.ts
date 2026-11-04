import "server-only";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import {
  getFeedbackDirectoryAssignmentAuthorizationAction,
  getWorkspaceAuthorizationAction,
} from "@/lib/authorization/permission-action";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessControlPermission, getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { getV3AuthorizationActor, getV3SessionUserId, requireV3WorkspaceAccess } from "./auth";
import { problemDashboardsPlanRequired, problemForbidden, problemUnauthorized } from "./response";
import type { TV3Authentication } from "./types";
import { type V3WorkspaceContext, resolveV3WorkspaceContext } from "./workspace-context";

/**
 * Opt-in for the dashboard-bound reads a Dashboard viewer may make (ADR-0023): the dashboard list and
 * read, a saved chart's data through its dashboard, and a dashboard filter's value list. They are decided
 * by `workspace.dashboard_read` and `feedbackDirectoryAssignment.dashboard_read` in SpiceDB, which admit
 * the workspace's viewers; without the option the caller is asked for `read`, which viewers never hold.
 * It only ever changes a `read`: a write is never asked as a dashboard read, whatever the caller passes.
 */
export type TDashboardViewerAccessOptions = Readonly<{ allowDashboardViewer?: boolean }>;

/**
 * The workspace a dashboards operation runs in. `asDashboardViewer` marks a caller admitted as the
 * workspace's Dashboard viewer, so the dataset check that follows asks `dashboard_read` of it, and only
 * of it (S2).
 */
export type TDashboardsAccessContext = V3WorkspaceContext & { asDashboardViewer?: true };

const isDashboardRead = (
  minPermission: TTeamPermission,
  options: TDashboardViewerAccessOptions | undefined
): boolean => options?.allowDashboardViewer === true && minPermission === "read";

/**
 * A signed-in user's dashboard-bound read: one SpiceDB check either way (C11). The organization role in
 * PostgreSQL only picks which permission to ask — a Dashboard viewer `dashboard_read`, everyone else the
 * `read` they were always asked — and SpiceDB decides it. So nobody but a viewer depends on the
 * `dashboard_read` permission this release adds: before the AuthZed schema is applied, owners and members
 * read dashboards as before and only viewers are refused (S2).
 */
const requireSessionDashboardRead = async (
  userId: string,
  workspaceId: string,
  requestId: string,
  instance: string | undefined
): Promise<Response | TDashboardsAccessContext> => {
  let context: V3WorkspaceContext;
  try {
    context = await resolveV3WorkspaceContext(workspaceId);
  } catch (error) {
    if (!(error instanceof ResourceNotFoundError)) throw error;
    logger.withContext({ requestId, workspaceId }).warn({ statusCode: 403 }, "Workspace not found");
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }

  const membership = await getMembershipByUserIdOrganizationId(userId, context.organizationId);
  const asDashboardViewer = membership?.role === "dashboard_viewer";
  const allowed = await can(
    { type: "user", id: userId },
    getWorkspaceAuthorizationAction(asDashboardViewer ? "dashboardRead" : "read"),
    { type: "workspace", id: context.workspaceId }
  );
  if (!allowed) {
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }

  if (!asDashboardViewer) {
    return (await getIsDashboardsEnabled(context.organizationId))
      ? context
      : problemDashboardsPlanRequired(requestId, instance);
  }

  // The role needs Access Control and Dashboards; a lapsed plan answers a viewer the same 403 as no grant.
  const [isAccessControlAllowed, isDashboardsEnabled] = await Promise.all([
    getAccessControlPermission(context.organizationId),
    getIsDashboardsEnabled(context.organizationId),
  ]);
  if (!isAccessControlAllowed || !isDashboardsEnabled) {
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }
  return { ...context, asDashboardViewer: true };
};

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
): Promise<Response | TDashboardsAccessContext> {
  const sessionUserId = getV3SessionUserId(authentication);
  if (sessionUserId && isDashboardRead(minPermission, options)) {
    return requireSessionDashboardRead(sessionUserId, workspaceId, requestId, instance);
  }

  const context = await requireV3WorkspaceAccess(
    authentication,
    workspaceId,
    minPermission,
    requestId,
    instance
  );
  if (context instanceof Response) return context;

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
  context: TDashboardsAccessContext,
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

  // Only a dashboard-bound read (`allowDashboardViewer`, ADR-0023) by a caller admitted as a Dashboard
  // viewer asks `dashboard_read`; everyone else is asked the `read` they always were, so they never
  // depend on the permission this release adds (S2). The free-form chart query and the field-value lookup
  // never opt in, so a viewer can only read a dataset through a saved chart on a dashboard.
  const level =
    isDashboardRead(minPermission, options) && context.asDashboardViewer ? "dashboardRead" : minPermission;
  const allowed = await can(actor, getFeedbackDirectoryAssignmentAuthorizationAction(level), {
    type: "feedbackDirectoryAssignment",
    feedbackDirectoryId: datasetId,
    workspaceId: context.workspaceId,
  });
  if (allowed) return null;

  return problemForbidden(requestId, "You are not authorized to use this Feedback Dataset", instance);
}
