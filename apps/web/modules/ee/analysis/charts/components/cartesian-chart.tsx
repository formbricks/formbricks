"use client";

import { type ElementType, type ReactNode, useMemo } from "react";
import { CartesianGrid, Label, XAxis, YAxis } from "recharts";
import type { TChartConfig } from "@formbricks/types/analysis";
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
  const indicatorColor = color ?? CHART_BRAND_DARK;
  return (
    <>
      <div
        className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-current"
        style={{
          backgroundColor: indicatorColor,
          borderColor: indicatorColor,
        }}
      />
      <div className="flex flex-1 items-center justify-between leading-none">
        <span className="text-muted-foreground">{formatCubeColumnHeader(dataKey)}</span>
        <span className="text-foreground font-mono font-medium tabular-nums">{formatCellValue(value)}</span>
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
const multiMeasureTooltipFormatter = (
  value: unknown,
  name: string,
  item: { dataKey?: string; color?: string; payload?: { fill?: string } }
) => {
  const key = item?.dataKey ?? name;
  const color = item?.color ?? item?.payload?.fill;
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
  visualConfig?: TChartConfig;
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
  visualConfig,
}: Readonly<CartesianChartProps>) {
  const isMultiMeasure = dataKeys.length > 1;
  const legendVisible = visualConfig?.showLegend ?? showLegend;
  const gridVisible = visualConfig?.showGrid ?? true;
  const tooltipContent = isMultiMeasure ? (
    <ChartTooltipContent labelFormatter={formatXAxisTick} formatter={multiMeasureTooltipFormatter} />
  ) : (
    <SingleMeasureTooltip dataKey={dataKeys[0]} />
  );

  return (
    <div className="h-64 w-full">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <Chart data={data} {...chartProps}>
          {gridVisible && <CartesianGrid strokeDasharray="3 3" vertical={false} />}
          <XAxis
            dataKey={xAxisKey}
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={formatXAxisTick}>
            {visualConfig?.xAxisLabel && (
              <Label value={visualConfig.xAxisLabel} offset={-5} position="insideBottom" />
            )}
          </XAxis>
          <YAxis tickLine={false} axisLine={false}>
            {visualConfig?.yAxisLabel && (
              <Label value={visualConfig.yAxisLabel} angle={-90} position="insideLeft" />
            )}
          </YAxis>
          <ChartTooltip content={tooltipContent} />
          {legendVisible && <ChartLegend content={<ChartLegendContent />} verticalAlign="top" height={36} />}
          {children}
        </Chart>
      </ChartContainer>
    </div>
  );
}
