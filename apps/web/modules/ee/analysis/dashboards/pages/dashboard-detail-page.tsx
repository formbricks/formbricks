import { notFound } from "next/navigation";
import type { TChartQuery } from "@formbricks/types/analysis";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { executeQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { injectTenantFilter } from "@/modules/ee/analysis/charts/lib/chart-utils";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";
import { getFeedbackRecordDirectoriesByWorkspaceId } from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { DashboardDetailClient } from "../components/dashboard-detail-client";
import { getDashboard } from "../lib/dashboards";

interface WidgetQueryResult {
  data: TChartDataRow[];
  query: TChartQuery;
}

async function executeWidgetQuery(
  query: TChartQuery,
  feedbackRecordDirectoryId: string
): Promise<WidgetQueryResult | { error: string }> {
  try {
    const scopedQuery = injectTenantFilter(query, feedbackRecordDirectoryId);
    const data = await executeQuery(scopedQuery as Record<string, unknown>);
    return { data: Array.isArray(data) ? data : [], query };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load chart data";
    return { error: message };
  }
}

export async function DashboardDetailPage({
  params,
}: Readonly<{
  params: Promise<{ workspaceId: string; dashboardId: string }>;
}>) {
  const { workspaceId, dashboardId } = await params;
  const { isReadOnly } = await getWorkspaceAuth(workspaceId);
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

  const widgetDataPromises = new Map<string, Promise<WidgetQueryResult | { error: string }>>();
  const widgetsWithCharts = dashboard.widgets.filter(
    (w): w is typeof w & { chart: NonNullable<typeof w.chart> } => !!w.chart
  );
  for (const widget of widgetsWithCharts) {
    widgetDataPromises.set(
      widget.id,
      executeWidgetQuery(widget.chart.query, widget.chart.feedbackRecordDirectoryId)
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
