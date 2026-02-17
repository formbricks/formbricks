"use client";

import { usePathname } from "next/navigation";
import { use } from "react";
import { AnalysisPageLayout } from "./analysis-page-layout";
import { CreateChartButton } from "./create-chart-button";
import { CreateDashboardButton } from "./create-dashboard-button";

interface AnalysisLayoutClientProps {
  children: React.ReactNode;
  params: Promise<{ environmentId: string }>;
}

export function AnalysisLayoutClient({ children, params }: AnalysisLayoutClientProps) {
  const pathname = usePathname();
  const { environmentId } = use(params);

  let activeId = "dashboards";
  if (pathname?.includes("/charts")) {
    activeId = "charts";
  } else if (pathname?.includes("/dashboards")) {
    activeId = "dashboards";
  }

  const isDashboardsPage = pathname?.endsWith("/dashboards");
  const isChartsPage = pathname?.includes("/charts");

  let cta;
  if (isDashboardsPage) {
    cta = <CreateDashboardButton environmentId={environmentId} />;
  } else if (isChartsPage) {
    cta = <CreateChartButton environmentId={environmentId} />;
  }

  return (
    <AnalysisPageLayout pageTitle="Analysis" activeId={activeId} environmentId={environmentId} cta={cta}>
      {children}
    </AnalysisPageLayout>
  );
}
