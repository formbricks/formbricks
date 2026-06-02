"use client";

import { type ElementType, type ReactNode } from "react";
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
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from "@/modules/ui/components/chart";

type TooltipPayloadItem = {
  dataKey?: string;
  name?: string | number;
  value?: unknown;
  color?: string;
  payload?: { fill?: string };
};

type RechartsTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
};

/**
 * Polished hover tooltip card matching the Twenty-style target: prominent
 * date header, indicator + measure + value per series, comfortable padding
 * so values are easy to read without scanning a tiny black box.
 */
const PolishedChartTooltip = ({ active, payload, label }: Readonly<RechartsTooltipProps>) => {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
      <div className="mb-2 text-sm font-medium text-slate-800">{formatXAxisTick(label)}</div>
      <div className="flex flex-col gap-1.5">
        {payload.map((item) => {
          const key = item.dataKey ?? String(item.name ?? "");
          const indicatorColor = item.color ?? item.payload?.fill ?? CHART_BRAND_DARK;
          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: indicatorColor }} />
                <span className="text-sm text-slate-500">{formatCubeColumnHeader(key, t)}</span>
              </div>
              <span className="text-foreground text-sm font-medium tabular-nums">
                {formatCellValue(item.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  chartConfig,
  chart: Chart,
  children,
  showLegend = false,
  chartProps = {},
  tooltipCursor,
}: Readonly<CartesianChartProps>) {
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
          <ChartTooltip content={<PolishedChartTooltip />} cursor={tooltipCursor} />
          {showLegend && <ChartLegend content={<ChartLegendContent />} verticalAlign="top" height={36} />}
          {children}
        </Chart>
      </ChartContainer>
    </div>
  );
}
