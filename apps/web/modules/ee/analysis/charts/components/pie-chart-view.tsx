"use client";

import { useTranslation } from "react-i18next";
import { Cell, Label, Legend, Pie, PieChart } from "recharts";
import type { TChartQuery } from "@formbricks/types/analysis";
import { ChartEmptyState } from "@/modules/ee/analysis/charts/components/chart-empty-state";
import { PolishedChartTooltip } from "@/modules/ee/analysis/charts/components/polished-tooltip";
import { canStackSeries } from "@/modules/ee/analysis/charts/lib/chart-series";
import {
  CHART_BRAND_DARK,
  PIE_MEASURE_ID_KEY,
  PIE_MEASURE_NAME_KEY,
  PIE_MEASURE_VALUE_KEY,
  formatPercentShare,
  prepareMeasureSliceData,
  preparePieData,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
import { getSharedMeasureFormatId } from "@/modules/ee/analysis/charts/lib/measure-format";
import type { TValueFormatter } from "@/modules/ee/analysis/charts/lib/measure-pivot";
import { formatCubeColumnHeader } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";
import type { ChartConfig } from "@/modules/ui/components/chart";
import { ChartContainer, ChartTooltip } from "@/modules/ui/components/chart";

interface PieLabelProps {
  readonly cx?: number;
  readonly cy?: number;
  readonly midAngle?: number;
  readonly outerRadius?: number;
  readonly percent?: number;
  readonly value?: number;
  /** The slice's data row; a measure slice carries its measure id, so it is formatted by that measure. */
  readonly payload?: TChartDataRow;
}

// Tiny slices hide both label and leader line so adjacent labels don't overlap
// and `minAngle`-stretched slices don't end up with lines pointing at nothing.
const PIE_LABEL_MIN_PERCENT = 0.02;

// Curried with the active language: recharts calls the renderer outside React, so the locale has
// to be closed over rather than read from a hook inside it.
const createPieLabelRenderer = (
  locale: string,
  formatValue: (value: unknown, row: TChartDataRow | undefined) => string
) =>
  function PieSliceLabel({ cx, cy, midAngle, outerRadius, percent, value, payload }: PieLabelProps) {
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
        {formatValue(value, payload)} ({formatPercentShare(percent, locale)})
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
  readonly viewBox?: { cx?: number; cy?: number };
  /** Already formatted for the measure; empty when the slices do not add up to a total. */
  readonly total: string;
  readonly label: string;
}) => {
  const cx = viewBox?.cx;
  const cy = viewBox?.cy;
  if (cx == null || cy == null || !total) return null;
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
        {total}
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

interface PieChartViewProps {
  sortedData: TChartDataRow[];
  dataKeys: string[];
  dataKey: string;
  isMultiMeasure: boolean;
  query: TChartQuery;
  timeDimKey: string | undefined;
  xAxisKey: string;
  chartConfig: ChartConfig;
  formatDimensionValue: (value: unknown) => string;
  responseBaseKey?: string;
  formatValue: TValueFormatter;
  measureLabels: Record<string, string>;
}

export const PieChartView = ({
  sortedData,
  dataKeys,
  dataKey,
  isMultiMeasure,
  query,
  timeDimKey,
  xAxisKey,
  chartConfig,
  formatDimensionValue,
  responseBaseKey,
  formatValue,
  measureLabels,
}: Readonly<PieChartViewProps>) => {
  const { t, i18n } = useTranslation();

  // With several measures and no dimension (e.g. the six Emotion counts), each row column is a
  // measure, not a slice — pivot the measures into one slice per measure so the pie shows them
  // all instead of only the first. A dimension-based pie keeps its existing (rows = slices) shape.
  const useMeasureSlices = isMultiMeasure && (query.dimensions?.length ?? 0) === 0 && !timeDimKey;
  const pieDataKey = useMeasureSlices ? PIE_MEASURE_VALUE_KEY : dataKey;
  const pieNameKey = useMeasureSlices ? PIE_MEASURE_NAME_KEY : xAxisKey;
  const pieSource = useMeasureSlices
    ? prepareMeasureSliceData(
        sortedData,
        dataKeys,
        (key) => measureLabels[key] ?? formatCubeColumnHeader(key, t),
        responseBaseKey
      )
    : sortedData;
  // Slices of several measures are summed counts; a dimension pie shows its one measure.
  // The centre total uses the slices' common format (only counts get one, see below); each slice and its
  // tooltip are formatted by their own measure.
  const sliceMeasures = useMeasureSlices ? dataKeys : [dataKey];
  const sliceFormatMeasure = getSharedMeasureFormatId(sliceMeasures) ?? "";
  const formatSliceValue = (value: unknown) => formatValue(sliceFormatMeasure, value);
  // A measure slice is formatted by its own measure (a CSAT score as a percent beside a count).
  const formatSlice = (value: unknown, row: Record<string, unknown> | undefined) => {
    const measureId = row?.[PIE_MEASURE_ID_KEY];
    return typeof measureId === "string" ? formatValue(measureId, value) : formatSliceValue(value);
  };
  // A total only means something for counts; adding up scores or averages does not.
  const showsTotal = canStackSeries(sliceMeasures);
  const renderPieLabel = createPieLabelRenderer(i18n.language, formatSlice);
  const pieResult = preparePieData(pieSource, pieDataKey, pieNameKey);
  // Every slice is zero: there is no whole to take a share of.
  if (!pieResult) {
    return <ChartEmptyState message={t("workspace.analysis.charts.no_data_available")} />;
  }
  const { processedData, colors } = pieResult;
  const total = processedData.reduce((sum, row) => sum + (Number(row[pieDataKey]) || 0), 0);
  // Multi-measure pies have no single measure to name the center; show just the total.
  const centerLabel = useMeasureSlices ? "" : (measureLabels[dataKey] ?? formatCubeColumnHeader(dataKey, t));

  return (
    <div className="h-full min-h-64 w-full min-w-0">
      <ChartContainer config={chartConfig} className="h-full w-full min-w-0">
        <PieChart margin={{ top: 16, right: 32, bottom: 8, left: 32 }}>
          <Pie
            data={processedData}
            dataKey={pieDataKey}
            nameKey={pieNameKey}
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
              const rowKey = row[pieNameKey] ?? `row-${index}`;
              const uniqueKey = `${pieNameKey}-${String(rowKey)}-${index}`;
              return <Cell key={uniqueKey} fill={colors[index] || CHART_BRAND_DARK} />;
            })}
            <Label
              position="center"
              content={
                <PieCenterLabel total={showsTotal ? formatSliceValue(total) : ""} label={centerLabel} />
              }
            />
          </Pie>
          {/* Measure slices carry the measure label on the row itself, so the header (the same
              slice name) would only repeat it — suppress it like the pivoted bar chart does. */}
          <ChartTooltip
            content={
              <PolishedChartTooltip
                labelFormatter={formatDimensionValue}
                hideLabel={useMeasureSlices}
                responseBaseKey={responseBaseKey}
                valueFormatter={(_key, value, row) => formatSlice(value, row)}
              />
            }
          />
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
};
