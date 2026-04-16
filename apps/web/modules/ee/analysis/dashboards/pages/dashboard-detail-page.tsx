import { notFound } from "next/navigation";
import type { TChartQuery } from "@formbricks/types/analysis";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { executeQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { DashboardDetailClient } from "../components/dashboard-detail-client";
import { getDashboard } from "../lib/dashboards";

interface WidgetQueryResult {
  data: TChartDataRow[];
  query: TChartQuery;
}

async function executeWidgetQuery(query: TChartQuery): Promise<WidgetQueryResult | null> {
  try {
    const data = await executeQuery(query);
    return { data: Array.isArray(data) ? data : [], query };
  } catch {
    return null;
  }
}

export async function DashboardDetailPage({
  params,
}: Readonly<{
  params: Promise<{ environmentId: string; dashboardId: string }>;
}>) {
  const { environmentId, dashboardId } = await params;
  const { project, isReadOnly } = await getEnvironmentAuth(environmentId);

  let dashboard;
  try {
    dashboard = await getDashboard(dashboardId, project.id);
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
    promise: executeWidgetQuery(widget.chart.query),
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
      environmentId={environmentId}
      dashboard={dashboard}
      widgetDataPromises={widgetDataPromises}
      isReadOnly={isReadOnly}
    />
  );
}
