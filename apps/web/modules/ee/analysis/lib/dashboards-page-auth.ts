import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache as reactCache } from "react";
import { AuthenticationError } from "@formbricks/types/errors";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getWorkspace } from "@/lib/workspace/service";
import { getSession } from "@/modules/auth/lib/session";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import {
  getDashboardViewerUnavailablePath,
  getDashboardViewerWorkspaceState,
} from "./dashboard-viewer-access";

export type TDashboardsPageAuth = Readonly<{
  organizationId: string;
  userId: string;
  isReadOnly: boolean;
  isOwnerOrManager: boolean;
  /** A Dashboard viewer (ADR-0018): dashboards only, read-only, no charts, no Feedback Datasets. */
  isDashboardViewer: boolean;
}>;

/**
 * The page-level gate for the dashboard list and a dashboard, the only product pages a Dashboard viewer
 * reaches. Everyone else goes through `getWorkspaceAuth` as before. A viewer is admitted, read-only, on
 * a workspace one of their teams is granted; sent to the "not available on this plan" page when the
 * organization lost Access Control or Dashboards; and answered 404 anywhere else, like any page they
 * may not read.
 */
export const getDashboardsPageAuth = reactCache(async (workspaceId: string): Promise<TDashboardsPageAuth> => {
  const [workspace, session] = await Promise.all([getWorkspace(workspaceId), getSession()]);
  if (!workspace) return notFound();
  if (!session) throw new AuthenticationError("Not authenticated");

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, workspace.organizationId);
  if (membership?.role === "dashboard_viewer") {
    const state = await getDashboardViewerWorkspaceState(session.user.id, workspace.id);
    if (state === "none") return notFound();
    if (state === "lapsed") redirect(getDashboardViewerUnavailablePath(workspace.organizationId));

    return {
      organizationId: workspace.organizationId,
      userId: session.user.id,
      isReadOnly: true,
      isOwnerOrManager: false,
      isDashboardViewer: true,
    };
  }

  const auth = await getWorkspaceAuth(workspaceId);
  return {
    organizationId: auth.organization.id,
    userId: auth.session.user.id,
    isReadOnly: auth.isReadOnly,
    isOwnerOrManager: auth.isOwner || auth.isManager,
    isDashboardViewer: false,
  };
});
