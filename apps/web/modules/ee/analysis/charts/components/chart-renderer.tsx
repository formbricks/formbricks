"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, Bar, BarChart, Cell, Label, LabelList, Legend, Pie, PieChart } from "recharts";
import type { TChartQuery } from "@formbricks/types/analysis";
import { CartesianChart } from "@/modules/ee/analysis/charts/components/cartesian-chart";
import { PolishedChartTooltip } from "@/modules/ee/analysis/charts/components/polished-tooltip";
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
import { ChartContainer, ChartTooltip } from "@/modules/ui/components/chart";

type PieLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
  value?: number;
};

/**
 * External pie label: leader line + "value (percent%)" anchored outside the
 * arc, mirroring the Twenty-style target. Tiny slices (<2%) skip the label
 * to avoid overlapping with neighbours.
 */
const renderPieLabel = ({ cx, cy, midAngle, outerRadius, percent, value }: PieLabelProps) => {
  if (cx == null || cy == null || midAngle == null || outerRadius == null || percent == null) return null;
  if (percent < 0.02) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 22;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const textAnchor = x > cx ? "start" : "end";
  return (
    <text x={x} y={y} fill="#64748b" fontSize={11} textAnchor={textAnchor} dominantBaseline="central">
      {formatCellValue(value)} ({(percent * 100).toFixed(1)}%)
    </text>
  );
};

/** Center total + label inside the donut hole. */
const PieCenterLabel = ({
  viewBox,
  total,
  label,
}: {
  viewBox?: { cx?: number; cy?: number };
  total: number;
  label: string;
}) => {
  const cx = viewBox?.cx;
  const cy = viewBox?.cy;
  if (cx == null || cy == null) return null;
  return (
    <g>
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground"
        fontSize={26}
        fontWeight={600}
        style={{ fontVariantNumeric: "tabular-nums" }}>
        {formatCellValue(total)}
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" dominantBaseline="central" fill="#64748b" fontSize={11}>
        {label}
      </text>
    </g>
  );
};

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
      // Both single- and multi-measure bars now draw from the mixed
      // measure palette (teal + indigo + amber + red + violet) for visual
      // consistency with the pie charts — categorical / per-bar colouring
      // uses real palette variety rather than monochromatic brand shades.
      // `tooltipCursor={false}` removes the column highlight so the
      // tooltip reads as per-bar.
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
                    return (
                      <Cell key={cellKey} fill={CHART_MEASURE_COLORS[index % CHART_MEASURE_COLORS.length]} />
                    );
                  })}
                {/* Value labels above each bar — only on single-measure where
                    there's clear vertical space above the bar. */}
                {!isMultiMeasure && (
                  <LabelList
                    dataKey={key}
                    position="top"
                    className="fill-foreground"
                    fontSize={11}
                    formatter={(value: unknown) => formatCellValue(value)}
                  />
                )}
              </Bar>
            );
          })}
        </CartesianChart>
      );
    case "line":
      // Render as an AreaChart with a thin stroke and a soft gradient fade so
      // the chart reads as a line with a subtle area tint underneath. Dot
      // markers are hidden by default and only appear on hover. Legend stays
      // on even for single-measure lines so the colour swatch + measure name
      // identify what the line represents without requiring a hover.
      return (
        <CartesianChart
          chart={AreaChart}
          data={data}
          xAxisKey={xAxisKey}
          dataKeys={dataKeys}
          chartConfig={chartConfig}
          showLegend>
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
          showLegend>
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
      const total = processedData.reduce((sum, row) => sum + (Number(row[dataKey]) || 0), 0);
      const centerLabel = formatCubeColumnHeader(dataKey, t);

      return (
        <div className="h-full min-h-[16rem] w-full min-w-0">
          <ChartContainer config={chartConfig} className="h-full w-full min-w-0">
            <PieChart margin={{ top: 16, right: 32, bottom: 8, left: 32 }}>
              <Pie
                data={processedData}
                dataKey={dataKey}
                nameKey={xAxisKey}
                cx="50%"
                cy="45%"
                innerRadius="55%"
                outerRadius="75%"
                paddingAngle={2}
                minAngle={2}
                labelLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                label={renderPieLabel}>
                {processedData.map((row, index) => {
                  const rowKey = row[xAxisKey] ?? `row-${index}`;
                  const uniqueKey = `${xAxisKey}-${String(rowKey)}-${index}`;
                  return <Cell key={uniqueKey} fill={colors[index] || CHART_BRAND_DARK} />;
                })}
                <Label
                  position="center"
                  content={(props) => (
                    <PieCenterLabel
                      viewBox={props.viewBox as { cx?: number; cy?: number } | undefined}
                      total={total}
                      label={centerLabel}
                    />
                  )}
                />
              </Pie>
              <ChartTooltip content={<PolishedChartTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                formatter={(value: string) => formatXAxisTick(value)}
                wrapperStyle={{ fontSize: 12 }}
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
