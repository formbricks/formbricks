"use client";

import { useTranslation } from "react-i18next";
import {
  CHART_BRAND_DARK,
  formatCellValue,
  formatXAxisTick,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
import { formatCubeColumnHeader } from "@/modules/ee/analysis/lib/schema-definition";

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
 * Polished hover tooltip card matching the Twenty-style target:
 * prominent header (x-axis label for cartesian charts, slice name for
 * pie), one row per series with a filled brand-coloured circle + measure
 * name on the left and the value (tabular-nums) on the right. Reused
 * across line, area, bar and pie charts so all hover surfaces match.
 */
export const PolishedChartTooltip = ({ active, payload, label }: Readonly<RechartsTooltipProps>) => {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;

  // For pies Recharts passes the slice name via payload[0].name and leaves
  // `label` empty; for cartesian charts `label` is the x-axis value.
  const headerSource = label != null && String(label).length > 0 ? label : (payload[0]?.name ?? "");
  const headerText = formatXAxisTick(headerSource);

  return (
    <div className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
      {headerText && <div className="mb-2 text-sm font-medium text-slate-800">{headerText}</div>}
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
