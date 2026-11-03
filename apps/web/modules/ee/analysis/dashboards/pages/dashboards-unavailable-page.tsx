import { notFound, redirect } from "next/navigation";
import { LandingSidebar } from "@/app/(app)/(onboarding)/organizations/[organizationId]/landing/components/landing-sidebar";
import { IS_FORMBRICKS_SURVEYS_CONFIGURED } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getSession } from "@/modules/auth/lib/session";
import { listDashboardViewerWorkspaces } from "@/modules/ee/analysis/lib/dashboard-viewer-access";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";
import { Header } from "@/modules/ui/components/header";

/**
 * Where a Dashboard viewer lands when it can't see any dashboard in an organization (ADR-0018): the
 * organization lost Access Control or Dashboards (the viewer keeps the role and is never made a Member),
 * or none of its teams is granted a workspace yet. Anyone else is answered 404, and a viewer who can see
 * dashboards again is sent to them.
 */
export const DashboardsUnavailablePage = async ({
  params,
}: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const { organizationId } = await params;
  const t = await getTranslate();

  const session = await getSession();
  if (!session?.user) return redirect("/auth/login");

  const [membership, organization, user] = await Promise.all([
    getMembershipByUserIdOrganizationId(session.user.id, organizationId),
    getOrganization(organizationId),
    getUser(session.user.id),
  ]);
  if (membership?.role !== "dashboard_viewer" || !organization || !user) return notFound();

  const isRoleEnabled = await getIsDashboardViewerRoleEnabled(organizationId);
  if (isRoleEnabled) {
    const [firstWorkspace] = await listDashboardViewerWorkspaces(session.user.id, organizationId);
    if (firstWorkspace) return redirect(`/workspaces/${firstWorkspace.id}/dashboards`);
  }

  return (
    <div className="flex min-h-full min-w-full flex-row">
      <LandingSidebar
        user={user}
        organization={organization}
        isFormbricksSurveysConfigured={IS_FORMBRICKS_SURVEYS_CONFIGURED}
      />
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        {isRoleEnabled ? (
          <Header
            title={t("workspace.analysis.dashboards.viewer_no_access_title")}
            subtitle={t("workspace.analysis.dashboards.viewer_no_access_subtitle")}
          />
        ) : (
          <Header
            title={t("workspace.analysis.dashboards.viewer_plan_unavailable_title")}
            subtitle={t("workspace.analysis.dashboards.viewer_plan_unavailable_subtitle")}
          />
        )}
      </div>
    </div>
  );
};
