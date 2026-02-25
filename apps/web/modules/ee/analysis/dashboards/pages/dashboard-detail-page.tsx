import { notFound } from "next/navigation";
import { executeQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { DashboardDetailClient } from "../components/dashboard-detail-client";
import { getDashboard } from "../lib/dashboards";

type WidgetQueryResult = { data: Record<string, unknown>[] } | { error: string };

async function executeWidgetQuery(query: unknown): Promise<WidgetQueryResult> {
  try {
    const data = await executeQuery(query as Record<string, unknown>);
    return { data: Array.isArray(data) ? data : [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to execute query";
    return { error: message };
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
      widgetDataPromises.set(widget.id, executeWidgetQuery(widget.chart.query));
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
