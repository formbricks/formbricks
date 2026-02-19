"use client";

import { usePathname } from "next/navigation";
import { use } from "react";
import { useTranslation } from "react-i18next";
import { AnalysisPageLayout } from "./analysis-page-layout";

interface AnalysisLayoutClientProps {
  children: React.ReactNode;
  params: Promise<{ environmentId: string }>;
}

export function AnalysisLayoutClient({ children, params }: AnalysisLayoutClientProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { environmentId } = use(params);

  let activeId = "dashboards";
  if (pathname?.includes("/charts")) {
    activeId = "charts";
  }

  return (
    <AnalysisPageLayout pageTitle={t("common.analysis")} activeId={activeId} environmentId={environmentId}>
      {children}
    </AnalysisPageLayout>
  );
}
