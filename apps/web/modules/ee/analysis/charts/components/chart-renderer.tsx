"use client";

import { format, isValid, parseISO } from "date-fns";
import type { ElementType, ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
import { TChartQuery } from "@formbricks/types/analysis";
import {
  CHART_BRAND_DARK,
  CHART_BRAND_LIGHT,
  formatCellValue,
  preparePieData,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
import { formatCubeColumnHeader } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import type { ChartConfig } from "@/modules/ui/components/chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/modules/ui/components/chart";

function formatXAxisTick(value: unknown): string {
  if (value == null) return "";
  let str: string;
  if (typeof value === "string") str = value;
  else if (typeof value === "number") str = String(value);
  else return "";
  const date = parseISO(str);
  if (isValid(date)) return format(date, "MMM d, yyyy");
  return str;
}

function ChartTooltipRow({ value, dataKey }: Readonly<{ value: unknown; dataKey: string }>) {
  return (
    <>
      <div
        className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-current"
        style={{
          backgroundColor: CHART_BRAND_DARK,
          borderColor: CHART_BRAND_DARK,
        }}
      />
      <div className="flex flex-1 items-center justify-between leading-none">
        <span className="text-muted-foreground">{formatCubeColumnHeader(dataKey)}</span>
        <span className="text-foreground font-mono font-medium tabular-nums">{formatCellValue(value)}</span>
      </div>
    </>
  );
}

/** Creates a tooltip formatter bound to dataKey for Cartesian charts. Defined at module level to avoid Sonar "component in parent" warnings. */
function createTooltipFormatter(dataKey: string) {
  const Formatter = (value: unknown) => <ChartTooltipRow value={value} dataKey={dataKey} />;
  Formatter.displayName = "ChartTooltipFormatter";
  return Formatter;
}

/** Tooltip content for bar/line/area charts with formatted label and value. Extracted to avoid inline component definitions. */
function CartesianChartTooltip({ dataKey }: Readonly<{ dataKey: string }>) {
  return <ChartTooltipContent labelFormatter={formatXAxisTick} formatter={createTooltipFormatter(dataKey)} />;
}

/** Shared layout for bar, line, and area charts to avoid duplicating grid/axis/tooltip boilerplate. */
function CartesianChart({
  data,
  xAxisKey,
  dataKey,
  chartConfig,
  chart: Chart,
  children,
}: Readonly<{
  data: TChartDataRow[];
  xAxisKey: string;
  dataKey: string;
  chartConfig: ChartConfig;
  chart: ElementType;
  children: ReactNode;
}>) {
  return (
    <div className="h-64 w-full">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <Chart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={xAxisKey}
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={formatXAxisTick}
          />
          <YAxis tickLine={false} axisLine={false} />
          <ChartTooltip content={<CartesianChartTooltip dataKey={dataKey} />} />
          {children}
        </Chart>
      </ChartContainer>
    </div>
  );
}

interface ChartRendererProps {
  chartType: TChartType;
  data: TChartDataRow[];
  query: TChartQuery;
}

export function ChartRenderer({ chartType, data, query }: Readonly<ChartRendererProps>) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        {t("environments.analysis.charts.no_data_available")}
      </div>
    );
  }

  const dataKey = query.measures?.[0] ?? Object.keys(data[0])[0] ?? "value";
  const xAxisKey =
    query.dimensions?.[0] ??
    query.timeDimensions?.[0]?.dimension ??
    Object.keys(data[0]).find((k) => k !== dataKey) ??
    "key";
  const chartConfig: ChartConfig = {
    [dataKey]: {
      label: formatCubeColumnHeader(dataKey),
      color: CHART_BRAND_DARK,
    },
  };

  switch (chartType) {
    case "bar":
      return (
        <CartesianChart
          chart={BarChart}
          data={data}
          xAxisKey={xAxisKey}
          dataKey={dataKey}
          chartConfig={chartConfig}>
          <Bar dataKey={dataKey} fill={CHART_BRAND_DARK} radius={4} />
        </CartesianChart>
      );
    case "line":
      return (
        <CartesianChart
          chart={LineChart}
          data={data}
          xAxisKey={xAxisKey}
          dataKey={dataKey}
          chartConfig={chartConfig}>
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={CHART_BRAND_DARK}
            strokeWidth={3}
            dot={{ fill: CHART_BRAND_DARK, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </CartesianChart>
      );
    case "area":
      return (
        <CartesianChart
          chart={AreaChart}
          data={data}
          xAxisKey={xAxisKey}
          dataKey={dataKey}
          chartConfig={chartConfig}>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={CHART_BRAND_DARK}
            fill={CHART_BRAND_LIGHT}
            fillOpacity={0.4}
            strokeWidth={2}
          />
        </CartesianChart>
      );
    case "pie": {
      const pieResult = preparePieData(data, dataKey);
      if (!pieResult) {
        return (
          <div className="flex h-64 items-center justify-center text-gray-500">
            {t("environments.analysis.charts.no_valid_data_to_display")}
          </div>
        );
      }
      const { processedData, colors } = pieResult;

      return (
        <div className="h-64 w-full min-w-0">
          <ChartContainer config={chartConfig} className="h-full w-full min-w-0">
            <PieChart>
              <Pie
                data={processedData}
                dataKey={dataKey}
                nameKey={xAxisKey}
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => {
                  if (!percent) return "";
                  return `${formatXAxisTick(name)}: ${(percent * 100).toFixed(0)}%`;
                }}>
                {processedData.map((row, index) => {
                  const rowKey = row[xAxisKey] ?? `row-${index}`;
                  const uniqueKey = `${xAxisKey}-${String(rowKey)}-${index}`;
                  return <Cell key={uniqueKey} fill={colors[index] || CHART_BRAND_DARK} />;
                })}
              </Pie>
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value: number | string, name: string) => [
                  formatCellValue(value),
                  formatCubeColumnHeader(name),
                ]}
              />
            </PieChart>
          </ChartContainer>
        </div>
      );
    }
    case "big_number": {
      const total = data.reduce((sum, row) => sum + (Number(row[dataKey]) || 0), 0);
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900">{total.toLocaleString()}</div>
            <div className="mt-2 text-sm text-gray-500">{formatCubeColumnHeader(dataKey)}</div>
          </div>
        </div>
      );
    }
    default:
      return (
        <div className="flex h-64 items-center justify-center text-gray-500">
          {t("environments.analysis.charts.chart_type_not_supported", { chartType })}
        </div>
      );
  }
}
