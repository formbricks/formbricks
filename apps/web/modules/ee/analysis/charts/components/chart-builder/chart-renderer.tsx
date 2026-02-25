"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/modules/ui/components/chart";

const BRAND_DARK = "#00C4B8";
const BRAND_LIGHT = "#00E6CA";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T|\s)/;

function formatTickValue(value: unknown): string {
  if (typeof value !== "string") return String(value);
  if (!ISO_DATE_RE.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface ChartRendererProps {
  chartType: string;
  data: Record<string, unknown>[];
}

function detectAxisKeys(firstRow: Record<string, unknown>): { xAxisKey: string; dataKey: string } {
  const keys = Object.keys(firstRow);

  let xAxisKey = keys[0];
  let dataKey = keys.length > 1 ? keys[1] : keys[0];

  for (const key of keys) {
    const val = firstRow[key];
    if (typeof val === "string" && Number.isNaN(Number(val))) {
      xAxisKey = key;
      break;
    }
  }

  for (const key of keys) {
    if (key === xAxisKey) continue;
    const val = firstRow[key];
    if (typeof val === "number" || (typeof val === "string" && !Number.isNaN(Number(val)))) {
      dataKey = key;
      break;
    }
  }

  return { xAxisKey, dataKey };
}

export function ChartRenderer({ chartType, data }: Readonly<ChartRendererProps>) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center text-gray-500">
        No data available
      </div>
    );
  }

  const { xAxisKey, dataKey } = detectAxisKeys(data[0]);

  switch (chartType) {
    case "bar":
      return (
        <div className="h-full w-full">
          <ChartContainer
            config={{ [dataKey]: { label: dataKey, color: BRAND_DARK } }}
            className="h-full w-full">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey={xAxisKey}
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={formatTickValue}
              />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey={dataKey} fill={BRAND_DARK} radius={4} />
            </BarChart>
          </ChartContainer>
        </div>
      );
    case "line":
      return (
        <div className="h-full w-full">
          <ChartContainer
            config={{ [dataKey]: { label: dataKey, color: BRAND_DARK } }}
            className="h-full w-full">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey={xAxisKey}
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={formatTickValue}
              />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={BRAND_DARK}
                strokeWidth={2}
                dot={{ r: 3, fill: BRAND_DARK }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartContainer>
        </div>
      );
    case "area":
      return (
        <div className="h-full w-full">
          <ChartContainer
            config={{ [dataKey]: { label: dataKey, color: BRAND_DARK } }}
            className="h-full w-full">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey={xAxisKey}
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={formatTickValue}
              />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={BRAND_DARK}
                fill={BRAND_DARK}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      );
    case "pie":
    case "donut": {
      if (!dataKey || !xAxisKey) {
        return (
          <div className="flex h-full min-h-[200px] items-center justify-center text-gray-500">
            Unable to determine chart data structure
          </div>
        );
      }

      const processedData = data
        .map((row) => ({
          ...row,
          [dataKey]: Number(row[dataKey]) || 0,
        }))
        .filter((row) => Number(row[dataKey]) > 0);

      if (processedData.length === 0) {
        return (
          <div className="flex h-full min-h-[200px] items-center justify-center text-gray-500">
            No valid data to display
          </div>
        );
      }

      const CHART_COLORS = [
        BRAND_DARK,
        BRAND_LIGHT,
        "#6366f1",
        "#f59e0b",
        "#ef4444",
        "#8b5cf6",
        "#ec4899",
        "#14b8a6",
      ];
      const colors = processedData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
      if (colors.length > 1) colors[1] = BRAND_LIGHT;

      return (
        <div className="h-full w-full min-w-0">
          <ChartContainer
            config={{ [dataKey]: { label: dataKey, color: BRAND_DARK } }}
            className="h-full w-full min-w-0">
            <PieChart>
              <Pie
                data={processedData}
                dataKey={dataKey}
                nameKey={xAxisKey}
                cx="50%"
                cy="50%"
                outerRadius="70%"
                label={({ name, percent }) => {
                  if (!percent) return "";
                  return `${name}: ${(percent * 100).toFixed(0)}%`;
                }}>
                {processedData.map((entry, index) => (
                  <Cell key={String(entry[xAxisKey])} fill={colors[index]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </div>
      );
    }
    case "big_number": {
      const total = data.reduce((sum, row) => sum + (Number(row[dataKey]) || 0), 0);
      return (
        <div className="flex h-full min-h-[100px] items-center justify-center">
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900">{total.toLocaleString()}</div>
            <div className="mt-2 text-sm text-gray-500">{dataKey}</div>
          </div>
        </div>
      );
    }
    default:
      return (
        <div className="flex h-full min-h-[200px] items-center justify-center text-gray-500">
          Chart type &quot;{chartType}&quot; not yet supported
        </div>
      );
  }
}
