import { notFound } from "next/navigation";
import type { TChartQuery } from "@formbricks/types/analysis";
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
  } catch {
    return notFound();
  }

  const widgetDataPromises = new Map<string, Promise<WidgetQueryResult>>();
  for (const widget of dashboard.widgets) {
    if (widget.chart) {
      const result = await executeWidgetQuery(widget.chart.query);
      if (result) {
        widgetDataPromises.set(widget.id, Promise.resolve(result));
      }
    }
  }

  return (
    <DashboardDetailClient
      environmentId={environmentId}
      dashboard={dashboard}
      widgetDataPromises={widgetDataPromises}
      isReadOnly={isReadOnly}
    />
  );
}
