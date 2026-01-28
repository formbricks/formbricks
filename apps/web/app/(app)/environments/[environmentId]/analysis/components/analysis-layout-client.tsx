"use client";

import { usePathname } from "next/navigation";
import { use } from "react";
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
  if (pathname?.includes("/charts") || pathname?.includes("/chart-builder")) {
    activeId = "charts";
  } else if (pathname?.includes("/dashboards") || pathname?.includes("/dashboard/")) {
    activeId = "dashboards";
  }

  return (
    <AnalysisPageLayout pageTitle="Analysis" activeId={activeId} environmentId={environmentId}>
      {children}
    </AnalysisPageLayout>
  );
}
