"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { TDashboard } from "../types/analysis";
import { CreateChartButton } from "./create-chart-button";
import { DashboardControlBar } from "./dashboard-control-bar";
import { DashboardWidget } from "./dashboard-widget";

interface DashboardDetailClientProps {
  dashboard: TDashboard;
  environmentId: string;
}

export function DashboardDetailClient({
  dashboard: initialDashboard,
  environmentId,
}: DashboardDetailClientProps) {
  const router = useRouter();
  const [dashboard] = useState(initialDashboard);
  const isEmpty = dashboard.widgets.length === 0;

  const handleDashboardUpdate = () => {
    router.refresh();
  };

  const getColSpan = (w: number) => {
    if (w <= 2) return "col-span-12 md:col-span-2";
    if (w <= 3) return "col-span-12 md:col-span-3";
    if (w <= 4) return "col-span-12 md:col-span-4";
    if (w <= 6) return "col-span-12 md:col-span-6";
    if (w <= 8) return "col-span-12 md:col-span-8";
    if (w <= 9) return "col-span-12 md:col-span-9";
    return "col-span-12";
  };

  return (
    <PageContentWrapper>
      <GoBackButton url={`/environments/${environmentId}/analysis/dashboards`} />
      <PageHeader
        pageTitle={dashboard.name}
        cta={
          <DashboardControlBar
            environmentId={environmentId}
            dashboard={dashboard}
            onDashboardUpdate={handleDashboardUpdate}
          />
        }>
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
                <DashboardWidget widget={widget} environmentId={environmentId} />
              </div>
            ))}
          </div>
        )}
      </section>
    </PageContentWrapper>
  );
}
