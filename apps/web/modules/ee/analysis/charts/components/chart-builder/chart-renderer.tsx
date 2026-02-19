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

// Formbricks brand colors
const BRAND_DARK = "#00C4B8";
const BRAND_LIGHT = "#00E6CA";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T|\s)/;

function formatTickValue(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "");
  if (!ISO_DATE_RE.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface ChartRendererProps {
  chartType: string;
  data: Record<string, unknown>[];
}

export function ChartRenderer({ chartType, data }: ChartRendererProps) {
  if (!data || data.length === 0) {
    return <div className="flex h-full min-h-[200px] items-center justify-center text-gray-500">No data available</div>;
  }

  // Get the first data point to determine keys
  const firstRow = data[0];
  const allKeys = Object.keys(firstRow);
  const keys = allKeys.filter((key) => key !== "date" && key !== "time");

  // For pie charts, we need to identify dimension (nameKey) and measure (dataKey)
  let xAxisKey = "key";
  let dataKey = "value";

  if (chartType === "pie" || chartType === "donut") {
    // Find first numeric key (measure)
    const numericKey = keys.find((key) => {
      const firstValue = firstRow[key];
      if (firstValue === null || firstValue === undefined || firstValue === "") return false;
      const numValue = Number(firstValue);
      return !Number.isNaN(numValue) && Number.isFinite(numValue);
    });
    // Find first non-numeric key (dimension)
    const nonNumericKey = keys.find((key) => {
      if (key === numericKey) return false;
      const firstValue = firstRow[key];
      return firstValue !== undefined;
    });

    xAxisKey = nonNumericKey || (numericKey ? keys.find((k) => k !== numericKey) : null) || keys[0] || "key";
    dataKey = numericKey || keys[1] || keys[0] || "value";
  } else {
    // For other chart types, use existing logic
    if (firstRow.date) {
      xAxisKey = "date";
    } else if (firstRow.time) {
      xAxisKey = "time";
    } else if (keys[0]) {
      xAxisKey = keys[0];
    }
    dataKey = keys.find((k) => k !== xAxisKey) || keys[0] || "value";
  }

  switch (chartType) {
    case "bar":
      return (
        <div className="h-full w-full">
          <ChartContainer
            config={{ [dataKey]: { label: dataKey, color: BRAND_DARK } }}
            className="h-full w-full">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xAxisKey} tickLine={false} tickMargin={10} axisLine={false} tickFormatter={formatTickValue} />
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
              <XAxis dataKey={xAxisKey} tickLine={false} tickMargin={10} axisLine={false} tickFormatter={formatTickValue} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={BRAND_DARK}
                strokeWidth={3}
                dot={{ fill: BRAND_DARK, r: 4 }}
                activeDot={{ r: 6 }}
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
              <XAxis dataKey={xAxisKey} tickLine={false} tickMargin={10} axisLine={false} tickFormatter={formatTickValue} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={BRAND_DARK}
                fill={BRAND_LIGHT}
                fillOpacity={0.4}
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

      // Filter out rows where the dataKey value is null, undefined, or empty
      const validData = data.filter((row) => {
        const value = row[dataKey];
        if (value === null || value === undefined || value === "") return false;
        const numValue = Number(value);
        return !Number.isNaN(numValue) && Number.isFinite(numValue);
      });

      // Convert dataKey values to numbers for proper rendering
      const processedData = validData.map((row) => ({
        ...row,
        [dataKey]: Number(row[dataKey]),
      }));

      if (processedData.length === 0) {
        return (
          <div className="flex h-full min-h-[200px] items-center justify-center text-gray-500">No valid data to display</div>
        );
      }

      // Generate colors using Formbricks brand palette
      const colors = processedData.map((_, index) => {
        const hue = 180; // Teal base hue
        const saturation = 70 + (index % 3) * 10; // Vary saturation
        const lightness = 45 + (index % 2) * 15; // Vary lightness
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      });
      // Use brand colors for first two slices
      if (colors.length > 0) colors[0] = BRAND_DARK;
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
                {processedData.map((row, index) => {
                  const rowKey = row[xAxisKey] ?? `row-${index}`;
                  const uniqueKey = `${xAxisKey}-${String(rowKey)}-${index}`;
                  return <Cell key={uniqueKey} fill={colors[index] || BRAND_DARK} />;
                })}
              </Pie>
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value: number | string, name: string) => {
                  const numValue = Number(value);
                  return [numValue.toLocaleString(), name];
                }}
              />
            </PieChart>
          </ChartContainer>
        </div>
      );
    }
    case "kpi":
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
