import { notFound, redirect } from "next/navigation";
import { OrganizationLandingLayout } from "@/app/(app)/(onboarding)/organizations/[organizationId]/landing/components/organization-landing-layout";
import { getTranslate } from "@/lingodotdev/server";
import { getSession } from "@/modules/auth/lib/session";
import { getDashboardsUnavailable } from "@/modules/ee/analysis/dashboards/lib/dashboards-unavailable";
import { Header } from "@/modules/ui/components/header";

/**
 * Where a Dashboard viewer lands when it can't see any dashboard in an organization (ADR-0023): the
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

  const page = await getDashboardsUnavailable(session.user.id, organizationId);
  if (page.kind === "notFound") return notFound();
  if (page.kind === "redirect") return redirect(page.path);

  return (
    <OrganizationLandingLayout
      user={page.user}
      organization={page.organization}
      isMultiOrgEnabled={page.isMultiOrgEnabled}
      membershipRole="dashboard_viewer">
      <div className="flex h-full flex-col items-center justify-center p-6">
        {page.isRoleEnabled ? (
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
    </OrganizationLandingLayout>
  );
};
