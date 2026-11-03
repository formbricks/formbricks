import "server-only";
import { can } from "@/lib/authorization";
import { getFeedbackDirectoryAssignmentAuthorizationAction } from "@/lib/authorization/permission-action";
import {
  canDashboardViewerReadFeedbackDataset,
  canDashboardViewerReadWorkspace,
} from "@/modules/ee/analysis/lib/dashboard-viewer-access";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { getV3AuthorizationActor, getV3SessionUserId, requireV3WorkspaceAccess } from "./auth";
import { problemDashboardsPlanRequired, problemForbidden, problemUnauthorized } from "./response";
import type { TV3Authentication } from "./types";
import { type V3WorkspaceContext, resolveV3WorkspaceContext } from "./workspace-context";

/**
 * Opt-in for the dashboard-bound reads a Dashboard viewer may make (ADR-0018): the dashboard list and
 * read, a saved chart's data through its dashboard, and a dashboard filter's value list. Without it a
 * viewer is refused like anyone SpiceDB denies. It only ever widens a `read`: a write never admits a
 * viewer, whatever the caller passes.
 */
export type TDashboardViewerAccessOptions = Readonly<{ allowDashboardViewer?: boolean }>;

/**
 * The SpiceDB denial a viewer may get past: a signed-in user (session or OAuth token, never an API key)
 * refused a `read` with 403. Anything else (401, a missing workspace answered as 403 for an API key, a
 * write) stands.
 */
const getViewerCandidate = (
  authentication: TV3Authentication,
  minPermission: TTeamPermission,
  options: TDashboardViewerAccessOptions | undefined,
  refusal: Response
): string | null => {
  if (!options?.allowDashboardViewer || minPermission !== "read" || refusal.status !== 403) return null;
  return getV3SessionUserId(authentication);
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
): Promise<Response | V3WorkspaceContext> {
  let context = await requireV3WorkspaceAccess(
    authentication,
    workspaceId,
    minPermission,
    requestId,
    instance
  );
  if (context instanceof Response) {
    // SpiceDB is asked first, so everyone but a Dashboard viewer costs exactly the one check it always
    // did; the viewer grant is consulted only after a denial, and answers the same 403 when it too says no.
    const viewerId = getViewerCandidate(authentication, minPermission, options, context);
    if (!viewerId || !(await canDashboardViewerReadWorkspace(viewerId, workspaceId))) {
      return context;
    }
    context = await resolveV3WorkspaceContext(workspaceId);
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

  const allowed = await can(actor, getFeedbackDirectoryAssignmentAuthorizationAction(minPermission), {
    type: "feedbackDirectoryAssignment",
    feedbackDirectoryId: datasetId,
    workspaceId: context.workspaceId,
  });
  if (allowed) return null;

  const refusal = problemForbidden(
    requestId,
    "You are not authorized to use this Feedback Dataset",
    instance
  );
  // Only the dashboard-bound reads pass `allowDashboardViewer` (ADR-0018). The free-form chart query and
  // the field-value lookup never do, so a viewer can only read a dataset through a saved chart.
  const viewerId = getViewerCandidate(authentication, minPermission, options, refusal);
  if (viewerId && (await canDashboardViewerReadFeedbackDataset(viewerId, context.workspaceId, datasetId))) {
    return null;
  }
  return refusal;
}
