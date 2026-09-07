import type { TFunction } from "i18next";
import { ActivityIcon, AreaChartIcon, BarChart3Icon, PieChartIcon } from "lucide-react";
import type React from "react";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";

export const DEFAULT_CHART_TYPE: TChartType = "area";

export const CHART_TYPE_ICONS: Record<
  TChartType,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  area: AreaChartIcon,
  bar: BarChart3Icon,
  pie: PieChartIcon,
  big_number: ActivityIcon,
};

export function getChartTypes(t: TFunction): readonly {
  id: TChartType;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}[] {
  return [
    // Line is not a type of its own: it is this type rendered with `config.areaDisplay: "line"`,
    // toggled in ChartDisplaySettings. Named for both so it is still findable by "line".
    { id: "area", icon: CHART_TYPE_ICONS.area, label: t("workspace.analysis.charts.chart_type_area") },
    { id: "bar", icon: CHART_TYPE_ICONS.bar, label: t("workspace.analysis.charts.chart_type_bar") },
    { id: "pie", icon: CHART_TYPE_ICONS.pie, label: t("workspace.analysis.charts.chart_type_pie") },
    {
      id: "big_number",
      icon: CHART_TYPE_ICONS.big_number,
      label: t("workspace.analysis.charts.chart_type_big_number"),
    },
  ];
}
