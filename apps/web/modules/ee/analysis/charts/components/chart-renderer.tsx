"use client";

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
import {
  CHART_BRAND_DARK,
  CHART_BRAND_LIGHT,
  preparePieData,
  resolveChartKeys,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/modules/ui/components/chart";

interface ChartRendererProps {
  chartType: string;
  data: TChartDataRow[];
}

export const ChartRenderer = ({ chartType, data }: Readonly<ChartRendererProps>) => {
  const { t } = useTranslation();
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        {t("environments.analysis.charts.no_data_available")}
      </div>
    );
  }

  const { xAxisKey, dataKey } = resolveChartKeys(data, chartType);

  switch (chartType) {
    case "bar":
      return (
        <div className="h-64 min-h-[256px] w-full">
          <ChartContainer
            config={{ [dataKey]: { label: dataKey, color: CHART_BRAND_DARK } }}
            className="h-full w-full">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xAxisKey} tickLine={false} tickMargin={10} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey={dataKey} fill={CHART_BRAND_DARK} radius={4} />
            </BarChart>
          </ChartContainer>
        </div>
      );
    case "line":
      return (
        <div className="h-64 min-h-[256px] w-full">
          <ChartContainer
            config={{ [dataKey]: { label: dataKey, color: CHART_BRAND_DARK } }}
            className="h-full w-full">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xAxisKey} tickLine={false} tickMargin={10} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={CHART_BRAND_DARK}
                strokeWidth={3}
                dot={{ fill: CHART_BRAND_DARK, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        </div>
      );
    case "area":
      return (
        <div className="h-64 min-h-[256px] w-full">
          <ChartContainer
            config={{ [dataKey]: { label: dataKey, color: CHART_BRAND_DARK } }}
            className="h-full w-full">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xAxisKey} tickLine={false} tickMargin={10} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={CHART_BRAND_DARK}
                fill={CHART_BRAND_LIGHT}
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
          <div className="flex h-64 items-center justify-center text-gray-500">
            {t("environments.analysis.charts.unable_to_determine_chart_data_structure")}
          </div>
        );
      }
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
        <div className="h-64 min-h-[256px] w-full min-w-0">
          <ChartContainer
            config={{ [dataKey]: { label: dataKey, color: CHART_BRAND_DARK } }}
            className="h-full w-full min-w-0">
            <PieChart width={400} height={256}>
              <Pie
                data={processedData}
                dataKey={dataKey}
                nameKey={xAxisKey}
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => {
                  if (!percent) return "";
                  return `${name}: ${(percent * 100).toFixed(0)}%`;
                }}>
                {processedData.map((row, index) => {
                  const rowKey = row[xAxisKey] ?? `row-${index}`;
                  const uniqueKey = `${xAxisKey}-${String(rowKey)}-${index}`;
                  return <Cell key={uniqueKey} fill={colors[index] || CHART_BRAND_DARK} />;
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
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900">{total.toLocaleString()}</div>
            <div className="mt-2 text-sm text-gray-500">{dataKey}</div>
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
};
