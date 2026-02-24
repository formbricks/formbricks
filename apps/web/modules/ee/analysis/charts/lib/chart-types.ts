import {
  ActivityIcon,
  AreaChartIcon,
  BarChart3Icon,
  LineChartIcon,
  MapIcon,
  PieChartIcon,
  ScatterChart,
  TableIcon,
} from "lucide-react";
import type React from "react";
import type { TApiChartType } from "@/modules/ee/analysis/types/analysis";

export const CHART_TYPES: readonly {
  readonly id: TApiChartType;
  readonly name: string;
  readonly icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}[] = [
  { id: "area", name: "Area Chart", icon: AreaChartIcon },
  { id: "bar", name: "Bar Chart", icon: BarChart3Icon },
  { id: "line", name: "Line Chart", icon: LineChartIcon },
  { id: "pie", name: "Pie Chart", icon: PieChartIcon },
  { id: "table", name: "Table", icon: TableIcon },
  { id: "big_number", name: "Big Number", icon: ActivityIcon },
  { id: "scatter", name: "Scatter Plot", icon: ScatterChart },
  { id: "map", name: "World Map", icon: MapIcon },
];

export const CHART_TYPE_ICONS = Object.fromEntries(CHART_TYPES.map(({ id, icon }) => [id, icon])) as Record<
  string,
  React.ComponentType<{ className?: string }>
>;
