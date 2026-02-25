import type { TFunction } from "i18next";
import { ActivityIcon, AreaChartIcon, BarChart3Icon, LineChartIcon, PieChartIcon } from "lucide-react";
import type React from "react";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";

export const CHART_TYPE_ICONS: Record<
  TChartType,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  area: AreaChartIcon,
  bar: BarChart3Icon,
  line: LineChartIcon,
  pie: PieChartIcon,
  big_number: ActivityIcon,
};

export function getChartTypes(t: TFunction): readonly {
  id: TChartType;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}[] {
  return [
    { id: "area", icon: CHART_TYPE_ICONS.area, label: t("environments.analysis.charts.chart_type_area") },
    { id: "bar", icon: CHART_TYPE_ICONS.bar, label: t("environments.analysis.charts.chart_type_bar") },
    { id: "line", icon: CHART_TYPE_ICONS.line, label: t("environments.analysis.charts.chart_type_line") },
    { id: "pie", icon: CHART_TYPE_ICONS.pie, label: t("environments.analysis.charts.chart_type_pie") },
    {
      id: "big_number",
      icon: CHART_TYPE_ICONS.big_number,
      label: t("environments.analysis.charts.chart_type_big_number"),
    },
  ];
}
