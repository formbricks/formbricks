import { notFound } from "next/navigation";
import { logger } from "@formbricks/logger";
import type { TChartQuery } from "@formbricks/types/analysis";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getAISmartToolsUnavailableReason, getOrganizationAIConfig } from "@/lib/ai/service";
import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
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
import {
  DASHBOARD_WIDGET_DATASET_UNAVAILABLE,
  DASHBOARD_WIDGET_LOAD_ERROR,
  type TDashboardWidgetError,
} from "../lib/widget-errors";

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
    // Dashboards are workspace-scoped for ACCESS only: this gate decides who may VIEW the
    // widget's chart. The bound dataset (feedbackDirectory) may aggregate feedback across
    // multiple workspaces, so passing the workspace does NOT filter or partition the
    // dataset's rows — the chart still reads every row of the dataset it points at. The
    // check throws AuthorizationError when the dataset is archived, deleted, or unassigned
    // from this workspace, which we surface below as a neutral "dataset unavailable" state.
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
    // A widget's chart can outlive the dataset it points at (archived/deleted/unassigned).
    // checkFeedbackDirectoryAccess throws AuthorizationError in that case; render it as a
    // neutral empty state rather than a generic load error.
    if (error instanceof AuthorizationError) {
      logger.warn(
        { feedbackDirectoryId, workspaceId, organizationId },
        "Dashboard widget dataset is no longer available"
      );
      return { error: DASHBOARD_WIDGET_DATASET_UNAVAILABLE };
    }
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
    getFeedbackDirectoriesByWorkspaceId(workspaceId),
    getOrganizationAIConfig(organization.id),
  ]);
  const aiUnavailableReason = getAISmartToolsUnavailableReason(aiConfig);
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
