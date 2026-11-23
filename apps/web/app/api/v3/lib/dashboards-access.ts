import "server-only";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { type TAuthorizationActor, can } from "@/lib/authorization";
import {
  getFeedbackDirectoryAssignmentAuthorizationAction,
  getWorkspaceAuthorizationAction,
} from "@/lib/authorization/permission-action";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import type { TViewerAccessReader } from "@/modules/ee/dashboard-access/lib/viewer-data-access";
import { getAccessControlPermission, getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { getV3AuthorizationActor, getV3SessionUserId, requireV3WorkspaceAccess } from "./auth";
import { problemDashboardsPlanRequired, problemForbidden, problemUnauthorized } from "./response";
import type { TV3Authentication } from "./types";
import { type V3WorkspaceContext, resolveV3WorkspaceContext } from "./workspace-context";

/**
 * Opt-in for the dashboard-bound reads a Dashboard viewer may make (ADR-0025): the dashboard list and
 * read, a saved chart's data through its dashboard, and a dashboard filter's value list. They are decided
 * by `workspace.dashboard_read` and `feedbackDirectoryAssignment.dashboard_read` in SpiceDB, which admit
 * the workspace's viewers; without the option the caller is asked for `read`, which viewers never hold.
 * It only ever changes a `read`: a write is never asked as a dashboard read, whatever the caller passes.
 */
export type TDashboardViewerAccessOptions = Readonly<{
  allowDashboardViewer?: boolean;
  /**
   * View as (ENG-7484): the member whose reads these are. Only a dashboard-bound read takes it, only an
   * Owner or Manager session may ask, and the read is then decided for that member — their SpiceDB
   * subject, their Dashboard Viewer access — while the caller stays the actor of record.
   */
  viewAs?: string;
}>;

/**
 * The workspace a dashboards operation runs in. `asDashboardViewer` marks a caller admitted as the
 * workspace's Dashboard viewer, so the dataset check that follows asks `dashboard_read` of it, and only
 * of it (S2).
 */
export type TDashboardsAccessContext = V3WorkspaceContext & {
  asDashboardViewer?: true;
  /** The signed-in user the read was decided for: the caller, or the member chosen in View as. */
  readerUserId?: string;
  /** Set when the read runs as another member (View as): read-only, audited. */
  viewAs?: { userId: string; actorUserId: string };
};

/**
 * The subject dashboard and page decisions are asked for: the member a View as read runs as, else the
 * caller (a user, or an API key).
 */
export const getDashboardReadSubject = (
  authentication: TV3Authentication,
  access: TDashboardsAccessContext
): TAuthorizationActor | null => {
  if (access.viewAs) return { type: "user", id: access.viewAs.userId };
  if (access.readerUserId) return { type: "user", id: access.readerUserId };
  return getV3AuthorizationActor(authentication);
};

/**
 * Whose Dashboard Viewer access (ADR-0060) a read is under: the user admitted as a Dashboard Viewer, or
 * `null` for everyone else, who reads every record.
 */
export const getViewerAccessReader = (access: TDashboardsAccessContext): TViewerAccessReader =>
  access.asDashboardViewer && access.readerUserId
    ? { userId: access.readerUserId, organizationId: access.organizationId }
    : null;

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
      ? { ...context, readerUserId: userId }
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
  return { ...context, asDashboardViewer: true, readerUserId: userId };
};

/**
 * View as (ENG-7484): the caller must be an Owner or Manager (`organization.manage`) of the workspace's
 * organization with Access Control and Dashboards, and the chosen user a member of it. The read is then
 * decided as that member's own, and audited as `viewedAs`. Any refusal is the same 403, so member ids of
 * other organizations cannot be probed.
 */
const requireViewAsDashboardRead = async (
  actorUserId: string,
  targetUserId: string,
  workspaceId: string,
  requestId: string,
  instance: string | undefined
): Promise<Response | TDashboardsAccessContext> => {
  const forbidden = () =>
    problemForbidden(requestId, "You are not authorized to view this dashboard as this member", instance);
  let context: V3WorkspaceContext;
  try {
    context = await resolveV3WorkspaceContext(workspaceId);
  } catch (error) {
    if (!(error instanceof ResourceNotFoundError)) throw error;
    return forbidden();
  }
  const [mayManage, isAccessControlAllowed, isDashboardsEnabled, target] = await Promise.all([
    can({ type: "user", id: actorUserId }, "organization.manage", {
      type: "organization",
      id: context.organizationId,
    }),
    getAccessControlPermission(context.organizationId),
    getIsDashboardsEnabled(context.organizationId),
    getMembershipByUserIdOrganizationId(targetUserId, context.organizationId),
  ]);
  if (!mayManage || !isAccessControlAllowed || !isDashboardsEnabled || !target) return forbidden();

  const read = await requireSessionDashboardRead(targetUserId, workspaceId, requestId, instance);
  if (read instanceof Response) return read;

  await queueAuditEventBackground({
    action: "viewedAs",
    targetType: "membership",
    userId: actorUserId,
    userType: "user",
    targetId: targetUserId,
    organizationId: context.organizationId,
    status: "success",
    newObject: { workspaceId, viewedAsUserId: targetUserId },
  });
  return { ...read, viewAs: { userId: targetUserId, actorUserId } };
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
  if (options?.viewAs !== undefined) {
    // View as is read-only and a person's choice: a write, or an API key, never runs as someone else.
    if (!sessionUserId || !isDashboardRead(minPermission, options)) {
      return problemForbidden(requestId, "View as is only for reading dashboards in the app", instance);
    }
    return requireViewAsDashboardRead(sessionUserId, options.viewAs, workspaceId, requestId, instance);
  }
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
  // Under View as, the dataset is decided for the member being viewed as, never for the caller.
  const actor = context.viewAs
    ? ({ type: "user", id: context.viewAs.userId } as const)
    : getV3AuthorizationActor(authentication);
  if (!actor) {
    return problemUnauthorized(requestId, "Not authenticated", instance);
  }

  // Only a dashboard-bound read (`allowDashboardViewer`, ADR-0025) by a caller admitted as a Dashboard
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
