"use client";

import { usePathname } from "next/navigation";
import { use } from "react";
import { CreateChartButton } from "../charts/components/CreateChartButton";
import { CreateDashboardButton } from "../dashboards/components/CreateDashboardButton";
import { AnalysisPageLayout } from "./analysis-page-layout";

interface AnalysisLayoutClientProps {
  children: React.ReactNode;
  params: Promise<{ environmentId: string }>;
}

export function AnalysisLayoutClient({ children, params }: AnalysisLayoutClientProps) {
  const pathname = usePathname();
  const { environmentId } = use(params);

  // Determine active tab based on pathname
  let activeId = "dashboards"; // default
  if (pathname?.includes("/charts")) {
    activeId = "charts";
  } else if (pathname?.includes("/dashboards") || pathname?.includes("/dashboard/")) {
    activeId = "dashboards";
  }

  // Show CTA button based on current page
  const isDashboardsPage = pathname?.includes("/dashboards") && !pathname?.includes("/dashboard/");
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
