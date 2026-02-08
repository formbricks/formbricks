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

export const CHART_TYPES = [
  { id: "area", name: "Area Chart", icon: AreaChartIcon },
  { id: "bar", name: "Bar Chart", icon: BarChart3Icon },
  { id: "line", name: "Line Chart", icon: LineChartIcon },
  { id: "pie", name: "Pie Chart", icon: PieChartIcon },
  { id: "table", name: "Table", icon: TableIcon },
  { id: "big_number", name: "Big Number", icon: ActivityIcon },
  { id: "scatter", name: "Scatter Plot", icon: ScatterChart },
  { id: "map", name: "World Map", icon: MapIcon },
] as const;
