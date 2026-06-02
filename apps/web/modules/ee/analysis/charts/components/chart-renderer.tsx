"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, Bar, BarChart, Cell, Legend, Pie, PieChart } from "recharts";
import type { TChartQuery } from "@formbricks/types/analysis";
import { CartesianChart } from "@/modules/ee/analysis/charts/components/cartesian-chart";
import {
  CHART_BRAND_DARK,
  CHART_BRAND_RAMP,
  CHART_MEASURE_COLORS,
  formatCellValue,
  preparePieData,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
import { formatCubeColumnHeader } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import type { ChartConfig } from "@/modules/ui/components/chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/modules/ui/components/chart";

const PieTooltipRow = ({ value, name }: Readonly<{ value: unknown; name: string }>) => {
  const { t } = useTranslation();
  return (
    <>
      {formatCellValue(value)} {formatCubeColumnHeader(name, t)}
    </>
  );
};

const pieTooltipFormatter = (value: unknown, name: string | number) => (
  <PieTooltipRow value={value} name={String(name)} />
);

interface ChartRendererProps {
  chartType: TChartType;
  data: TChartDataRow[];
  query: TChartQuery;
}

export function ChartRenderer({ chartType, data, query }: Readonly<ChartRendererProps>) {
  const { t } = useTranslation();
  // SVG <defs> ids must be unique across charts on the same page.
  const gradientIdPrefix = useId();

  if (!data || data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full min-h-[16rem] items-center justify-center">
        {t("workspace.analysis.charts.no_data_available")}
      </div>
    );
  }

  const rowKeys = Object.keys(data[0] ?? {});
  const timeDim = query.timeDimensions?.[0];
  const timeDimKey = timeDim?.granularity
    ? `${timeDim.dimension}.${timeDim.granularity}`
    : timeDim?.dimension;

  const xAxisKey = query.dimensions?.[0] ?? timeDimKey ?? rowKeys[0] ?? "key";

  const measureIds = query.measures?.filter((m) => rowKeys.includes(m)) ?? [];
  const dataKeys = measureIds.length > 0 ? measureIds : rowKeys.filter((k) => k !== xAxisKey);

  if (dataKeys.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full min-h-[16rem] items-center justify-center">
        {t("workspace.analysis.charts.no_data_available")}
      </div>
    );
  }

  const chartConfig: ChartConfig = Object.fromEntries(
    dataKeys.map((key, i) => [
      key,
      {
        label: formatCubeColumnHeader(key, t),
        color: CHART_MEASURE_COLORS[i % CHART_MEASURE_COLORS.length],
      },
    ])
  );
  const dataKey = dataKeys[0];
  const isMultiMeasure = dataKeys.length > 1;

  switch (chartType) {
    case "bar":
      // Single-measure: render one Bar with per-row Cells coloured from the
      // brand ramp so each x-category gets its own teal shade. Multi-measure:
      // keep grouped bars with the measure-colour palette for series
      // differentiation. `tooltipCursor={false}` removes the column highlight
      // so the tooltip reads as per-bar.
      return (
        <CartesianChart
          chart={BarChart}
          data={data}
          xAxisKey={xAxisKey}
          dataKeys={dataKeys}
          chartConfig={chartConfig}
          showLegend={isMultiMeasure}
          tooltipCursor={false}
          chartProps={isMultiMeasure ? { barCategoryGap: "20%" } : {}}>
          {dataKeys.map((key, i) => {
            const fallbackColor =
              chartConfig[key]?.color ?? CHART_MEASURE_COLORS[i % CHART_MEASURE_COLORS.length];
            return (
              <Bar key={key} dataKey={key} fill={fallbackColor} radius={4}>
                {!isMultiMeasure &&
                  data.map((row, index) => {
                    const rowKey = row[xAxisKey] ?? `row-${index}`;
                    const cellKey = `${xAxisKey}-${String(rowKey)}-${index}`;
                    return <Cell key={cellKey} fill={CHART_BRAND_RAMP[index % CHART_BRAND_RAMP.length]} />;
                  })}
              </Bar>
            );
          })}
        </CartesianChart>
      );
    case "line":
      // Render as an AreaChart with a thin stroke and a soft gradient fade so
      // the chart reads as a line with a subtle area tint underneath. Dot
      // markers are hidden by default and only appear on hover.
      return (
        <CartesianChart
          chart={AreaChart}
          data={data}
          xAxisKey={xAxisKey}
          dataKeys={dataKeys}
          chartConfig={chartConfig}
          showLegend={isMultiMeasure}>
          <defs>
            {dataKeys.map((key, i) => {
              const color = chartConfig[key]?.color ?? CHART_MEASURE_COLORS[i % CHART_MEASURE_COLORS.length];
              return (
                <linearGradient key={key} id={`${gradientIdPrefix}-line-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          {dataKeys.map((key, i) => {
            const color = chartConfig[key]?.color ?? CHART_MEASURE_COLORS[i % CHART_MEASURE_COLORS.length];
            return (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientIdPrefix}-line-${key})`}
                dot={false}
                activeDot={{ r: 5, stroke: color, strokeWidth: 2, fill: "#fff" }}
                // Days with no data come back as null from Cube — render them
                // as gaps in the line rather than connecting through, so the
                // chart honestly reflects "no data for this day" instead of
                // implying the value dropped to 0.
                connectNulls={false}
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
              connectNulls={false}
            />
          ))}
        </CartesianChart>
      );
    case "pie": {
      const pieResult = preparePieData(data, dataKey);
      if (!pieResult) {
        return (
          <div className="text-muted-foreground flex h-full min-h-[16rem] items-center justify-center">
            {t("workspace.analysis.charts.no_valid_data_to_display")}
          </div>
        );
      }
      const { processedData, colors } = pieResult;

      return (
        <div className="h-full min-h-[16rem] w-full min-w-0">
          <ChartContainer config={chartConfig} className="h-full w-full min-w-0">
            <PieChart>
              <Pie
                data={processedData}
                dataKey={dataKey}
                nameKey={xAxisKey}
                cx="50%"
                cy="45%"
                // Percentage radius scales with the container so the chart
                // doesn't disappear when the card height is constrained.
                // Previously this was a fixed 80px which could render to a
                // sliver in small cards or, combined with leader-line labels,
                // collide with the chart frame and disappear.
                outerRadius="70%"
                paddingAngle={1}
                minAngle={2}>
                {processedData.map((row, index) => {
                  const rowKey = row[xAxisKey] ?? `row-${index}`;
                  const uniqueKey = `${xAxisKey}-${String(rowKey)}-${index}`;
                  return <Cell key={uniqueKey} fill={colors[index] || CHART_BRAND_DARK} />;
                })}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent formatter={pieTooltipFormatter} />} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
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
      const formatted = total.toLocaleString();
      return (
        <div className="flex h-full min-h-[16rem] items-center justify-center">
          <div className="text-center">
            <div className="text-foreground text-6xl font-semibold tabular-nums tracking-tight">
              {formatted}
            </div>
            <div className="text-muted-foreground mt-4 text-sm">{formatCubeColumnHeader(dataKey, t)}</div>
          </div>
        </div>
      );
    }
    default:
      return (
        <div className="text-muted-foreground flex h-full min-h-[16rem] items-center justify-center">
          {t("workspace.analysis.charts.chart_type_not_supported", { chartType })}
        </div>
      );
  }
}
