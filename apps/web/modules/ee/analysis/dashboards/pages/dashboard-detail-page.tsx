import { notFound } from "next/navigation";
import { logger } from "@formbricks/logger";
import type { TChartQuery } from "@formbricks/types/analysis";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { checkFeedbackRecordDirectoryAccess } from "@/modules/ee/analysis/lib/access";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";
import { getFeedbackRecordDirectoriesByWorkspaceId } from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { DashboardDetailClient } from "../components/dashboard-detail-client";
import { getDashboard } from "../lib/dashboards";
import { DASHBOARD_WIDGET_LOAD_ERROR, type TDashboardWidgetError } from "../lib/widget-errors";

type TDashboardDetail = Awaited<ReturnType<typeof getDashboard>>;
type TDashboardWidget = TDashboardDetail["widgets"][number];
type TDashboardWidgetWithChart = TDashboardWidget & { chart: NonNullable<TDashboardWidget["chart"]> };

interface WidgetQueryResult {
  data: TChartDataRow[];
  query: TChartQuery;
}

async function executeWidgetQuery(
  query: TChartQuery,
  feedbackRecordDirectoryId: string,
  workspaceId: string,
  organizationId: string,
  userId: string
): Promise<WidgetQueryResult | { error: TDashboardWidgetError }> {
  try {
    const tenant = await checkFeedbackRecordDirectoryAccess({
      feedbackRecordDirectoryId,
      organizationId,
      workspaceId,
      userId,
      source: "dashboards.widget",
    });
    const data = await executeTenantScopedQuery({
      query,
      feedbackRecordDirectoryId: tenant.feedbackRecordDirectoryId,
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
  const { workspaceId, dashboardId } = await params;
  const { isReadOnly, organization, session } = await getWorkspaceAuth(workspaceId);
  const directories = await getFeedbackRecordDirectoriesByWorkspaceId(workspaceId);

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
        widget.chart.feedbackRecordDirectoryId,
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
    />
  );
}
