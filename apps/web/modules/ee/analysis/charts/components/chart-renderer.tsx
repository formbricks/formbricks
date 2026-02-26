"use client";

import { useTranslation } from "react-i18next";
import { Area, AreaChart, Bar, BarChart, Cell, Line, LineChart, Pie, PieChart } from "recharts";
import type { TChartQuery } from "@formbricks/types/analysis";
import { CartesianChart } from "@/modules/ee/analysis/charts/components/cartesian-chart";
import {
  CHART_BRAND_DARK,
  CHART_MEASURE_COLORS,
  formatCellValue,
  formatXAxisTick,
  preparePieData,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
import { formatCubeColumnHeader } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import type { ChartConfig } from "@/modules/ui/components/chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/modules/ui/components/chart";

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

  const rowKeys = Object.keys(data[0] ?? {});
  const measureIds = query.measures?.filter((m) => rowKeys.includes(m)) ?? [];
  const dataKeys =
    measureIds.length > 0
      ? measureIds
      : [rowKeys.find((k) => k !== query.dimensions?.[0]) ?? rowKeys[0]].filter(Boolean);
  const timeDim = query.timeDimensions?.[0];
  const timeDimKey = timeDim?.granularity
    ? `${timeDim.dimension}.${timeDim.granularity}`
    : timeDim?.dimension;

  const xAxisKey =
    query.dimensions?.[0] ?? timeDimKey ?? rowKeys.find((k) => !dataKeys.includes(k)) ?? rowKeys[0] ?? "key";
  const chartConfig: ChartConfig = Object.fromEntries(
    dataKeys.map((key, i) => [
      key,
      {
        label: formatCubeColumnHeader(key),
        color: CHART_MEASURE_COLORS[i % CHART_MEASURE_COLORS.length],
      },
    ])
  );
  const dataKey = dataKeys[0] ?? "value";
  const isMultiMeasure = dataKeys.length > 1;

  switch (chartType) {
    case "bar":
      return (
        <CartesianChart
          chart={BarChart}
          data={data}
          xAxisKey={xAxisKey}
          dataKeys={dataKeys}
          chartConfig={chartConfig}
          showLegend={isMultiMeasure}
          chartProps={isMultiMeasure ? { barCategoryGap: "20%" } : {}}>
          {dataKeys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              fill={chartConfig[key]?.color ?? CHART_MEASURE_COLORS[i % CHART_MEASURE_COLORS.length]}
              radius={4}
            />
          ))}
        </CartesianChart>
      );
    case "line":
      return (
        <CartesianChart
          chart={LineChart}
          data={data}
          xAxisKey={xAxisKey}
          dataKeys={dataKeys}
          chartConfig={chartConfig}
          showLegend={isMultiMeasure}>
          {dataKeys.map((key, i) => {
            const color = chartConfig[key]?.color ?? CHART_MEASURE_COLORS[i % CHART_MEASURE_COLORS.length];
            return (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={3}
                dot={{ fill: color, r: 4 }}
                activeDot={{ r: 6 }}
              />
            );
          })}
        </CartesianChart>
      );
    case "area":
      return (
        <CartesianChart
          chart={AreaChart}
          data={data}
          xAxisKey={xAxisKey}
          dataKeys={dataKeys}
          chartConfig={chartConfig}
          showLegend={isMultiMeasure}>
          {dataKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={chartConfig[key]?.color ?? CHART_MEASURE_COLORS[i % CHART_MEASURE_COLORS.length]}
              fill={chartConfig[key]?.color ?? CHART_MEASURE_COLORS[i % CHART_MEASURE_COLORS.length]}
              fillOpacity={0.4}
              strokeWidth={2}
            />
          ))}
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
      const total =
        data.length === 1
          ? Number(data[0]?.[dataKey]) || 0
          : data.reduce((sum, row) => sum + (Number(row[dataKey]) || 0), 0);
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
