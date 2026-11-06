import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getDashboardWorkspaceRow } from "@/app/api/v3/dashboards/lib/service";
import { getAISmartToolsUnavailableReason, getOrganizationAIConfig } from "@/lib/ai/service";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";
import { getDashboardsPageAuth } from "@/modules/ee/analysis/lib/dashboards-page-auth";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getAuthorizedWorkspaceFeedbackDirectories } from "@/modules/ee/unify-feedback/lib/access";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { DashboardDetailClient } from "../components/dashboard-detail-client";
import { getDateFilterCookieName, readStoredDateFilterFromCookie } from "../lib/dashboard-date-filter";
import { deserializeFilters, getFiltersCookieName } from "../lib/dashboard-filter-state";

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
  // The filters are remembered the same way, so a revisit's first fetch is already narrowed by them.
  const storedFilters = deserializeFilters(cookieStore.get(getFiltersCookieName(dashboardId))?.value);

  const { isReadOnly, organizationId, userId, isDashboardViewer } = await getDashboardsPageAuth(workspaceId);

  const [isDashboardsAllowed, dashboardRow] = await Promise.all([
    getIsDashboardsEnabled(organizationId),
    getDashboardWorkspaceRow(dashboardId),
  ]);
  // The page belongs to the workspace in its URL: its role, chart list and "create chart" all come from
  // there, so a dashboard of another workspace is not found here, as one that does not exist.
  if (dashboardRow?.workspaceId !== workspaceId) notFound();
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
                  ? `/organizations/${organizationId}/settings/billing`
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

  // A Dashboard viewer only views (ADR-0025): the datasets and AI feed chart creation and editing, which
  // the page never offers them, and SpiceDB would refuse them the datasets anyway.
  if (isDashboardViewer) {
    return (
      <DashboardDetailClient
        workspaceId={workspaceId}
        dashboardId={dashboardId}
        storedDateFilter={storedDateFilter}
        storedFilters={storedFilters}
        directories={[]}
        isReadOnly
        isAIAvailable={false}
      />
    );
  }

  const [directories, aiConfig] = await Promise.all([
    getAuthorizedWorkspaceFeedbackDirectories(userId, workspaceId),
    getOrganizationAIConfig(organizationId),
  ]);
  const aiUnavailableReason = getAISmartToolsUnavailableReason(aiConfig);
  const isAIAvailable = !aiUnavailableReason;

  return (
    <DashboardDetailClient
      workspaceId={workspaceId}
      dashboardId={dashboardId}
      storedDateFilter={storedDateFilter}
      storedFilters={storedFilters}
      directories={directories}
      isReadOnly={isReadOnly}
      isAIAvailable={isAIAvailable}
      aiUnavailableReason={aiUnavailableReason}
    />
  );
}
