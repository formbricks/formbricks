import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface AnalysisSecondaryNavigationProps {
  activeId: string;
  environmentId: string;
}

export function AnalysisSecondaryNavigation({
  activeId,
  environmentId,
}: AnalysisSecondaryNavigationProps) {
  const navigation = [
    {
      id: "dashboards",
      label: "Dashboards",
      href: `/environments/${environmentId}/analysis/dashboards`,
    },
    {
      id: "charts",
      label: "Charts",
      href: `/environments/${environmentId}/analysis/charts`,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} />;
}
