import { ActivityIcon, AreaChartIcon, BarChart3Icon, LineChartIcon, PieChartIcon } from "lucide-react";
import type React from "react";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";

export const CHART_TYPES: readonly {
  id: TChartType;
  name: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}[] = [
  { id: "area", name: "Area Chart", icon: AreaChartIcon },
  { id: "bar", name: "Bar Chart", icon: BarChart3Icon },
  { id: "line", name: "Line Chart", icon: LineChartIcon },
  { id: "pie", name: "Pie Chart", icon: PieChartIcon },
  { id: "big_number", name: "Big Number", icon: ActivityIcon },
];
