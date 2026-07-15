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
  getSemanticDimensionColor,
  getSentimentMeasureColor,
  preparePieData,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
import {
  FEEDBACK_MEASURE_IDS,
  formatCubeColumnHeader,
  getTranslatedDimensionValueLabel,
  sortRowsByEnumDimension,
} from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import type { ChartConfig } from "@/modules/ui/components/chart";
import { ChartContainer, ChartTooltip } from "@/modules/ui/components/chart";

interface PieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
  value?: number;
}

// Tiny slices hide both label and leader line so adjacent labels don't overlap
// and `minAngle`-stretched slices don't end up with lines pointing at nothing.
const PIE_LABEL_MIN_PERCENT = 0.02;

const renderPieLabel = ({ cx, cy, midAngle, outerRadius, percent, value }: PieLabelProps) => {
  if (cx == null || cy == null || midAngle == null || outerRadius == null || percent == null) return null;
  if (percent < PIE_LABEL_MIN_PERCENT) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 22;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const textAnchor = x > cx ? "start" : "end";
  return (
    <text
      x={x}
      y={y}
      className="fill-muted-foreground"
      fontSize={11}
      textAnchor={textAnchor}
      dominantBaseline="central">
      {formatCellValue(value)} ({(percent * 100).toFixed(1)}%)
    </text>
  );
};

interface PieLabelLineProps {
  percent?: number;
  points?: Array<{ x: number; y: number }>;
}

const renderPieLabelLine = ({ percent, points }: PieLabelLineProps) => {
  if (percent == null || percent < PIE_LABEL_MIN_PERCENT) return null;
  if (!points || points.length < 2) return null;
  return (
    <polyline
      points={points.map((p) => `${p.x},${p.y}`).join(" ")}
      fill="none"
      className="stroke-border"
      strokeWidth={1}
    />
  );
};

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
      <text
        x={cx}
        y={cy + 18}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-muted-foreground"
        fontSize={11}>
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
  // Unique across charts on the same page so SVG <defs> ids don't collide.
  const gradientIdPrefix = useId();

  if (!data || data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full min-h-64 items-center justify-center">
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
  // Measure-only charts (e.g. the emotion counts) have no real category: xAxisKey falls back to a
  // measure column, so the single group would otherwise be labelled with that measure's value (a
  // stray "1"). Track that so the x-axis tick and tooltip header are suppressed instead.
  const hasCategoryAxis = Boolean(query.dimensions?.[0] ?? timeDimKey);

  // Enum dimensions (e.g. sentiment) sort ordinally instead of alphabetically and
  // render translated labels instead of their raw machine tokens.
  const sortedData = sortRowsByEnumDimension(data, xAxisKey);
  const formatDimensionValue = (value: unknown): string =>
    getTranslatedDimensionValueLabel(xAxisKey, value, t) ?? formatXAxisTick(value);

  const measureIds = query.measures?.filter((m) => rowKeys.includes(m)) ?? [];
  const rawDataKeys = measureIds.length > 0 ? measureIds : rowKeys.filter((k) => k !== xAxisKey);
  // Render series (bars/lines/legend) in the schema's canonical measure order — e.g. sentiment from
  // very positive → mixed — instead of the order the user happened to pick them. Unknown keys keep
  // their relative order at the end.
  const measureRank = (id: string): number => {
    const index = FEEDBACK_MEASURE_IDS.indexOf(id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const dataKeys = [...rawDataKeys].sort((a, b) => measureRank(a) - measureRank(b));

  if (dataKeys.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full min-h-64 items-center justify-center">
        {t("workspace.analysis.charts.no_data_available")}
      </div>
    );
  }

  // Sentiment count measures carry semantic colors keyed by enum value (red-ish for very negative →
  // teal for very positive); every other series takes the generic palette by index.
  const chartConfig: ChartConfig = Object.fromEntries(
    dataKeys.map((key, i) => [
      key,
      {
        label: formatCubeColumnHeader(key, t),
        color: getSentimentMeasureColor(key) ?? CHART_MEASURE_COLORS[i % CHART_MEASURE_COLORS.length],
      },
    ])
  );
  const dataKey = dataKeys[0];
  const isMultiMeasure = dataKeys.length > 1;

  switch (chartType) {
    case "bar": {
      // Setting `fill` on the data row (not via <Cell>) is what propagates
      // the per-bar colour into the tooltip payload as well as the SVG.
      const barData = isMultiMeasure
        ? sortedData
        : sortedData.map((row, index) => ({
            ...row,
            fill:
              getSemanticDimensionColor(xAxisKey, row[xAxisKey]) ??
              CHART_MEASURE_COLORS[index % CHART_MEASURE_COLORS.length],
          }));

      return (
        <CartesianChart
          chart={BarChart}
          data={barData}
          xAxisKey={xAxisKey}
          dataKeys={dataKeys}
          chartConfig={chartConfig}
          showLegend={isMultiMeasure}
          tooltipCursor={false}
          zeroBaseline
          hasCategoryAxis={hasCategoryAxis}
          xAxisTickFormatter={formatDimensionValue}
          chartProps={isMultiMeasure ? { barCategoryGap: "20%" } : {}}>
          {dataKeys.map((key, i) => {
            const fallbackColor =
              chartConfig[key]?.color ?? CHART_MEASURE_COLORS[i % CHART_MEASURE_COLORS.length];
            return (
              <Bar key={key} dataKey={key} fill={fallbackColor} radius={4}>
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
    }
    case "line":
      // AreaChart with a thin stroke + gradient fade reads as a line with a soft tint.
      return (
        <CartesianChart
          chart={AreaChart}
          data={sortedData}
          xAxisKey={xAxisKey}
          dataKeys={dataKeys}
          chartConfig={chartConfig}
          showLegend
          hasCategoryAxis={hasCategoryAxis}
          xAxisTickFormatter={formatDimensionValue}>
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
                // Cube returns null for empty buckets; render them as gaps, not a dip to zero.
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
          data={sortedData}
          xAxisKey={xAxisKey}
          dataKeys={dataKeys}
          chartConfig={chartConfig}
          showLegend
          hasCategoryAxis={hasCategoryAxis}
          xAxisTickFormatter={formatDimensionValue}>
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
      const pieResult = preparePieData(sortedData, dataKey, xAxisKey);
      if (!pieResult) {
        return (
          <div className="text-muted-foreground flex h-full min-h-64 items-center justify-center">
            {t("workspace.analysis.charts.no_valid_data_to_display")}
          </div>
        );
      }
      const { processedData, colors } = pieResult;
      const total = processedData.reduce((sum, row) => sum + (Number(row[dataKey]) || 0), 0);
      const centerLabel = formatCubeColumnHeader(dataKey, t);

      return (
        <div className="h-full min-h-64 w-full min-w-0">
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
                // Recharts types `labelLine` as `ReactElement | function -> ReactElement`,
                // but returning `null` from the function is supported at runtime and is
                // how we hide the leader line for sub-2% slices.
                labelLine={renderPieLabelLine as never}
                label={renderPieLabel}>
                {processedData.map((row, index) => {
                  const rowKey = row[xAxisKey] ?? `row-${index}`;
                  const uniqueKey = `${xAxisKey}-${String(rowKey)}-${index}`;
                  return <Cell key={uniqueKey} fill={colors[index] || CHART_BRAND_DARK} />;
                })}
                <Label position="center" content={<PieCenterLabel total={total} label={centerLabel} />} />
              </Pie>
              <ChartTooltip content={<PolishedChartTooltip labelFormatter={formatDimensionValue} />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                formatter={(value: string) => formatDimensionValue(value)}
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
        <div className="flex h-full items-center justify-center p-4">
          <div className="text-center">
            <div className="text-foreground text-5xl font-semibold tracking-tight tabular-nums">
              {formatted}
            </div>
            <div className="text-muted-foreground mt-2 text-sm">{formatCubeColumnHeader(dataKey, t)}</div>
          </div>
        </div>
      );
    }
    default:
      return (
        <div className="text-muted-foreground flex h-full min-h-64 items-center justify-center">
          {t("workspace.analysis.charts.chart_type_not_supported", { chartType })}
        </div>
      );
  }
}
