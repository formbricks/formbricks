"use client";

import { type ElementType, type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CartesianGrid, XAxis, YAxis } from "recharts";
import {
  CHART_BRAND_DARK,
  formatCellValue,
  formatXAxisTick,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
import { formatCubeColumnHeader } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";
import type { ChartConfig } from "@/modules/ui/components/chart";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/modules/ui/components/chart";

const ChartTooltipRow = ({
  value,
  dataKey,
  color,
}: Readonly<{ value: unknown; dataKey: string; color?: string }>) => {
  const { t } = useTranslation();
  const indicatorColor = color ?? CHART_BRAND_DARK;
  return (
    <>
      <div className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: indicatorColor }} />
      <div className="flex flex-1 items-baseline justify-between gap-3 leading-none">
        <span className="text-muted-foreground">{formatCubeColumnHeader(dataKey, t)}</span>
        <span className="text-foreground font-medium tabular-nums">{formatCellValue(value)}</span>
      </div>
    </>
  );
};

/** Creates a tooltip formatter bound to dataKey for Cartesian charts. Defined at module level to avoid Sonar "component in parent" warnings. */
const createTooltipFormatter = (dataKey: string) => {
  const Formatter = (value: unknown) => <ChartTooltipRow value={value} dataKey={dataKey} />;
  Formatter.displayName = "ChartTooltipFormatter";
  return Formatter;
};

/** Tooltip content for single-measure Cartesian charts. */
const SingleMeasureTooltip = ({ dataKey }: Readonly<{ dataKey: string }>) => {
  const formatter = useMemo(() => createTooltipFormatter(dataKey), [dataKey]);
  return <ChartTooltipContent labelFormatter={formatXAxisTick} formatter={formatter} />;
};

/** Tooltip formatter for multi-measure charts; uses each payload item's dataKey and color. */
const multiMeasureTooltipFormatter = (value: unknown, name: string | number, item: unknown) => {
  const itemObj = item as { dataKey?: string; color?: string; payload?: { fill?: string } } | undefined;
  const key = itemObj?.dataKey ?? String(name);
  const color = itemObj?.color ?? itemObj?.payload?.fill;
  return <ChartTooltipRow value={value} dataKey={key} color={color} />;
};

export interface CartesianChartProps {
  data: TChartDataRow[];
  xAxisKey: string;
  dataKeys: string[];
  chartConfig: ChartConfig;
  chart: ElementType;
  children: ReactNode;
  showLegend?: boolean;
  chartProps?: Record<string, unknown>;
  /**
   * Cursor prop forwarded to Recharts Tooltip. Set to `false` to suppress
   * the column highlight so bar-chart tooltips read as per-bar instead of
   * per-x. Defaults to Recharts' built-in cursor.
   */
  tooltipCursor?: boolean | Record<string, unknown>;
}

/** Shared layout for bar, line, and area charts. Supports single or multiple measures. */
export function CartesianChart({
  data,
  xAxisKey,
  dataKeys,
  chartConfig,
  chart: Chart,
  children,
  showLegend = false,
  chartProps = {},
  tooltipCursor,
}: Readonly<CartesianChartProps>) {
  const isMultiMeasure = dataKeys.length > 1;
  const tooltipContent = isMultiMeasure ? (
    <ChartTooltipContent labelFormatter={formatXAxisTick} formatter={multiMeasureTooltipFormatter} />
  ) : (
    <SingleMeasureTooltip dataKey={dataKeys[0]} />
  );

  return (
    <div className="h-full min-h-[16rem] w-full">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <Chart data={data} {...chartProps}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey={xAxisKey}
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={formatXAxisTick}
          />
          {/* Derive the y-axis bounds from the actual data min/max with ~10%
              headroom on each side so monotone interpolation peaks (which
              bulge slightly above the data max between points) and troughs
              (which dip below the data min) are never clipped by the chart
              container. Round outward to the next integer so tick labels
              stay clean. */}
          <YAxis
            tickLine={false}
            axisLine={false}
            padding={{ top: 16, bottom: 4 }}
            domain={[
              ((dataMin: number) => Math.floor(dataMin - Math.abs(dataMin) * 0.1 - 1)) as never,
              ((dataMax: number) => Math.ceil(dataMax + Math.abs(dataMax) * 0.1 + 1)) as never,
            ]}
          />
          <ChartTooltip content={tooltipContent} cursor={tooltipCursor} />
          {showLegend && <ChartLegend content={<ChartLegendContent />} verticalAlign="top" height={36} />}
          {children}
        </Chart>
      </ChartContainer>
    </div>
  );
}
