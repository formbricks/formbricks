import { notFound } from "next/navigation";
import { DashboardDetailClient } from "../components/dashboard-detail-client";
import { executeWidgetQuery, getDashboard } from "../lib/data";

export async function DashboardDetailPage({
  params,
}: {
  params: Promise<{ environmentId: string; dashboardId: string }>;
}) {
  const { environmentId, dashboardId } = await params;
  const dashboard = await getDashboard(environmentId, dashboardId);

  if (!dashboard) {
    return notFound();
  }

  // Kick off all chart data queries in parallel (don't await -- let Suspense stream them)
  const widgetDataPromises = new Map<
    string,
    Promise<{ data: Record<string, unknown>[] } | { error: string }>
  >();
  for (const widget of dashboard.widgets) {
    if (widget.type === "chart" && widget.chart) {
      widgetDataPromises.set(widget.id, executeWidgetQuery(widget.chart.query));
    }
  }

  return (
    <DashboardDetailClient
      environmentId={environmentId}
      dashboard={dashboard}
      widgetDataPromises={widgetDataPromises}
    />
  );
}
