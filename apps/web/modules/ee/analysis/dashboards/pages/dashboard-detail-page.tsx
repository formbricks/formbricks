import { notFound } from "next/navigation";
import type { TChartQuery } from "@formbricks/types/analysis";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { executeQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { injectTenantFilter } from "@/modules/ee/analysis/charts/lib/chart-utils";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";
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
): Promise<WidgetQueryResult | null> {
  try {
    const scopedQuery = injectTenantFilter(query, feedbackRecordDirectoryId);
    const data = await executeQuery(scopedQuery as Record<string, unknown>);
    return { data: Array.isArray(data) ? data : [], query };
  } catch {
    return null;
  }
}

export async function DashboardDetailPage({
  params,
}: Readonly<{
  params: Promise<{ workspaceId: string; dashboardId: string }>;
}>) {
  const { workspaceId, dashboardId } = await params;
  const { isReadOnly } = await getWorkspaceAuth(workspaceId);

  let dashboard;
  try {
    dashboard = await getDashboard(dashboardId, workspaceId);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return notFound();
    }
    throw error;
  }

  const widgetDataPromises = new Map<string, Promise<WidgetQueryResult>>();
  const widgetsWithCharts = dashboard.widgets.filter(
    (w): w is typeof w & { chart: NonNullable<typeof w.chart> } => !!w.chart
  );
  const queryPromises = widgetsWithCharts.map((widget) => ({
    widgetId: widget.id,
    promise: executeWidgetQuery(widget.chart.query, widget.chart.feedbackRecordDirectoryId),
  }));
  const results = await Promise.all(queryPromises.map((q) => q.promise));
  queryPromises.forEach(({ widgetId }, i: number) => {
    const result = results[i];
    if (result) {
      widgetDataPromises.set(widgetId, Promise.resolve(result));
    }
  });

  return (
    <DashboardDetailClient
      workspaceId={workspaceId}
      dashboard={dashboard}
      widgetDataPromises={widgetDataPromises}
      isReadOnly={isReadOnly}
    />
  );
}
