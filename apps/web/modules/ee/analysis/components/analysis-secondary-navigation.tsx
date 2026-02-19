"use client";

import { useTranslation } from "react-i18next";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface AnalysisSecondaryNavigationProps {
  activeId: string;
  environmentId: string;
}

export function AnalysisSecondaryNavigation({ activeId, environmentId }: AnalysisSecondaryNavigationProps) {
  const { t } = useTranslation();

  const navigation = [
    {
      id: "dashboards",
      label: t("common.dashboards"),
      href: `/environments/${environmentId}/analysis/dashboards`,
    },
    {
      id: "charts",
      label: t("common.charts"),
      href: `/environments/${environmentId}/analysis/charts`,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} />;
}
