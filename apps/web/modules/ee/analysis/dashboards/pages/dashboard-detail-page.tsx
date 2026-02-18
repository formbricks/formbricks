import { Delay } from "@suspensive/react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageHeader } from "@/modules/ui/components/page-header";
import { CreateChartButton } from "@/modules/ee/analysis/charts/components/create-chart-button";
import { DashboardControlBar } from "../components/dashboard-control-bar";
import { DashboardWidget } from "../components/dashboard-widget";
import { DashboardWidgetData } from "../components/dashboard-widget-data";
import { DashboardWidgetSkeleton } from "../components/dashboard-widget-skeleton";
import { executeWidgetQuery, getDashboard } from "../lib/data";
import { TDashboardWidget } from "../../types/analysis";

function getColSpan(w: number) {
  if (w <= 2) return "col-span-12 md:col-span-2";
  if (w <= 3) return "col-span-12 md:col-span-3";
  if (w <= 4) return "col-span-12 md:col-span-4";
  if (w <= 6) return "col-span-12 md:col-span-6";
  if (w <= 8) return "col-span-12 md:col-span-8";
  if (w <= 9) return "col-span-12 md:col-span-9";
  return "col-span-12";
}

function StaticWidgetContent({ widget }: { widget: TDashboardWidget }) {
  if (widget.type === "markdown") {
    return (
      <div className="prose prose-sm max-w-none">
        <p className="text-gray-500">Markdown widget placeholder</p>
      </div>
    );
  }

  if (widget.type === "header") {
    return (
      <div className="flex h-full items-center">
        <h2 className="text-2xl font-semibold text-gray-900">{widget.title || "Header"}</h2>
      </div>
    );
  }

  if (widget.type === "divider") {
    return <div className="h-full w-full border-t border-gray-200" />;
  }

  return null;
}

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

  const isEmpty = dashboard.widgets.length === 0;

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
    <div>
      <GoBackButton url={`/environments/${environmentId}/analysis/dashboards`} />
      <PageHeader
        pageTitle={dashboard.name}
        cta={<DashboardControlBar environmentId={environmentId} dashboard={dashboard} />}>
        {dashboard.description && <p className="mt-2 text-sm text-gray-500">{dashboard.description}</p>}
      </PageHeader>
      <section className="pb-24 pt-6">
        {isEmpty ? (
          <div className="flex h-[400px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white/50">
            <div className="mb-4 rounded-full bg-gray-100 p-4">
              <div className="h-12 w-12 rounded-md bg-gray-300 opacity-20" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No Data</h3>
            <p className="mt-2 max-w-sm text-center text-gray-500">
              There is currently no information to display. Add charts to build your dashboard.
            </p>
            <CreateChartButton environmentId={environmentId} />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {dashboard.widgets.map((widget) => (
              <div key={widget.id} className={getColSpan(widget.layout.w)}>
                {widget.type === "chart" && widget.chart ? (
                  <DashboardWidget title={widget.title || widget.chart.name || "Widget"}>
                    <Suspense
                      fallback={
                        <Delay ms={200}>
                          <DashboardWidgetSkeleton />
                        </Delay>
                      }>
                      <DashboardWidgetData
                        dataPromise={widgetDataPromises.get(widget.id)!}
                        chartType={widget.chart.type}
                      />
                    </Suspense>
                  </DashboardWidget>
                ) : (
                  <DashboardWidget title={widget.title || "Widget"}>
                    <StaticWidgetContent widget={widget} />
                  </DashboardWidget>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
