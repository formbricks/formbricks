import { cookies } from "next/headers";
import { getAISmartToolsUnavailableReason, getOrganizationAIConfig } from "@/lib/ai/service";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getAuthorizedWorkspaceFeedbackDirectories } from "@/modules/ee/unify-feedback/lib/access";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { DashboardDetailClient } from "../components/dashboard-detail-client";
import { getDateFilterCookieName, readStoredDateFilterFromCookie } from "../lib/dashboard-date-filter";

export async function DashboardDetailPage({
  params,
}: Readonly<{
  params: Promise<{ workspaceId: string; dashboardId: string }>;
}>) {
  const t = await getTranslate();
  const { workspaceId, dashboardId } = await params;
  // The per-dashboard filter persisted in a cookie seeds the first fetch, so a revisit renders its
  // widgets filtered on the first pass instead of unfiltered and then again. A date filter pinned in the
  // URL (a shared link) still wins; the client reads that one itself.
  const cookieStore = await cookies();
  const storedDateFilter = readStoredDateFilterFromCookie(
    cookieStore.get(getDateFilterCookieName(dashboardId))?.value
  );

  const { isReadOnly, organization, session } = await getWorkspaceAuth(workspaceId);

  const isDashboardsAllowed = await getIsDashboardsEnabled(organization.id);
  if (!isDashboardsAllowed) {
    return (
      <AnalysisPageLayout pageTitle={t("common.analysis")} workspaceId={workspaceId}>
        <div className="flex items-center justify-center">
          <UpgradePrompt
            title={t("workspace.analysis.dashboards.upgrade_prompt_title")}
            description={t("workspace.analysis.dashboards.upgrade_prompt_description")}
            feature="dashboards"
            buttons={[
              {
                text: IS_FORMBRICKS_CLOUD ? t("common.upgrade_plan") : t("common.request_trial_license"),
                href: IS_FORMBRICKS_CLOUD
                  ? `/organizations/${organization.id}/settings/billing`
                  : ENTERPRISE_LICENSE_REQUEST_FORM_URL,
              },
              {
                text: t("common.learn_more"),
                href: "https://formbricks.com/docs/unify-feedback/features/dashboards-and-charts",
              },
            ]}
          />
        </div>
      </AnalysisPageLayout>
    );
  }

  const [directories, aiConfig] = await Promise.all([
    getAuthorizedWorkspaceFeedbackDirectories(session.user.id, workspaceId),
    getOrganizationAIConfig(organization.id),
  ]);
  const aiUnavailableReason = getAISmartToolsUnavailableReason(aiConfig);
  const isAIAvailable = !aiUnavailableReason;

  return (
    <DashboardDetailClient
      workspaceId={workspaceId}
      dashboardId={dashboardId}
      storedDateFilter={storedDateFilter}
      directories={directories}
      isReadOnly={isReadOnly}
      isAIAvailable={isAIAvailable}
      aiUnavailableReason={aiUnavailableReason}
    />
  );
}
