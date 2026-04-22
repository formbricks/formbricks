"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface AnalysisSecondaryNavigationProps {
  workspaceId: string;
}

export function AnalysisSecondaryNavigation({ workspaceId }: Readonly<AnalysisSecondaryNavigationProps>) {
  const { t } = useTranslation();
  const pathname = usePathname();

  const activeId = pathname?.includes("/charts") ? "charts" : "dashboards";

  const navigation = [
    {
      id: "dashboards",
      label: t("common.dashboards"),
      href: `/workspaces/${workspaceId}/dashboards`,
    },
    {
      id: "charts",
      label: t("common.charts"),
      href: `/workspaces/${workspaceId}/charts`,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} />;
}
