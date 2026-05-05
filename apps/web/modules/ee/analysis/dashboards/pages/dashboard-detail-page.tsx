import { notFound } from "next/navigation";
import { logger } from "@formbricks/logger";
import type { TChartQuery } from "@formbricks/types/analysis";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { type TOrganizationAIConfig, getOrganizationAIConfig } from "@/lib/ai/service";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { AnalysisPageLayout } from "@/modules/ee/analysis/components/analysis-page-layout";
import { checkFeedbackDirectoryAccess } from "@/modules/ee/analysis/lib/access";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsDashboardsEnabled } from "@/modules/ee/license-check/lib/utils";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { DashboardDetailClient } from "../components/dashboard-detail-client";
import { getDashboard } from "../lib/dashboards";
import { DASHBOARD_WIDGET_LOAD_ERROR, type TDashboardWidgetError } from "../lib/widget-errors";

const getAIUnavailableReason = (
  aiConfig: TOrganizationAIConfig
): "not_in_plan" | "not_enabled" | "instance_not_configured" | undefined => {
  if (!aiConfig.isAIDataAnalysisEntitled) return "not_in_plan";
  if (!aiConfig.isAIDataAnalysisEnabled) return "not_enabled";
  if (!aiConfig.isInstanceConfigured) return "instance_not_configured";
  return undefined;
};

type TDashboardDetail = Awaited<ReturnType<typeof getDashboard>>;
type TDashboardWidget = TDashboardDetail["widgets"][number];
type TDashboardWidgetWithChart = TDashboardWidget & { chart: NonNullable<TDashboardWidget["chart"]> };

interface WidgetQueryResult {
  data: TChartDataRow[];
  query: TChartQuery;
}

async function executeWidgetQuery(
  query: TChartQuery,
  feedbackDirectoryId: string,
  workspaceId: string,
  organizationId: string,
  userId: string
): Promise<WidgetQueryResult | { error: TDashboardWidgetError }> {
  try {
    const tenant = await checkFeedbackDirectoryAccess({
      feedbackDirectoryId,
      organizationId,
      workspaceId,
      userId,
      source: "dashboards.widget",
    });
    const data = await executeTenantScopedQuery({
      query,
      feedbackDirectoryId: tenant.feedbackDirectoryId,
      workspaceId,
      organizationId,
      userId,
      source: "dashboards.widget",
    });
    return { data: Array.isArray(data) ? data : [], query };
  } catch (error) {
    logger.error(error, "Failed to load dashboard widget data");
    return { error: DASHBOARD_WIDGET_LOAD_ERROR };
  }
}

type WidgetQueryPromiseResult = Promise<WidgetQueryResult | { error: TDashboardWidgetError }>;

export async function DashboardDetailPage({
  params,
}: Readonly<{
  params: Promise<{ workspaceId: string; dashboardId: string }>;
}>) {
  const t = await getTranslate();
  const { workspaceId, dashboardId } = await params;

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
                  ? `/workspaces/${workspaceId}/settings/organization/billing`
                  : "https://formbricks.com/upgrade-self-hosting-license",
              },
              {
                text: t("common.learn_more"),
                href: IS_FORMBRICKS_CLOUD
                  ? `/workspaces/${workspaceId}/settings/organization/billing`
                  : "https://formbricks.com/learn-more-self-hosting-license",
              },
            ]}
          />
        </div>
      </AnalysisPageLayout>
    );
  }

  const [directories, aiConfig] = await Promise.all([
    getFeedbackDirectoriesByWorkspaceId(workspaceId),
    getOrganizationAIConfig(organization.id),
  ]);
  const aiUnavailableReason = getAIUnavailableReason(aiConfig);
  const isAIAvailable = !aiUnavailableReason;

  let dashboard;
  try {
    dashboard = await getDashboard(dashboardId, workspaceId);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return notFound();
    }
    throw error;
  }

  const widgetDataPromises = new Map<string, WidgetQueryPromiseResult>();
  const widgetsWithCharts = dashboard.widgets.filter(
    (widget: TDashboardWidget): widget is TDashboardWidgetWithChart => !!widget.chart
  );
  for (const widget of widgetsWithCharts) {
    widgetDataPromises.set(
      widget.id,
      executeWidgetQuery(
        widget.chart.query,
        widget.chart.feedbackDirectoryId,
        workspaceId,
        organization.id,
        session.user.id
      )
    );
  }

  return (
    <DashboardDetailClient
      workspaceId={workspaceId}
      dashboard={dashboard}
      widgetDataPromises={widgetDataPromises}
      directories={directories}
      isReadOnly={isReadOnly}
      isAIAvailable={isAIAvailable}
      aiUnavailableReason={aiUnavailableReason}
    />
  );
}
