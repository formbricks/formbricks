"use client";

import { useTranslation } from "react-i18next";
import {
  CHART_BRAND_DARK,
  formatCellValue,
  formatXAxisTick,
} from "@/modules/ee/analysis/charts/lib/chart-utils";
import { formatCubeColumnHeader } from "@/modules/ee/analysis/lib/schema-definition";

interface TooltipPayloadItem {
  dataKey?: string;
  name?: string | number;
  value?: unknown;
  color?: string;
  payload?: { fill?: string };
}

interface RechartsTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
}

export const PolishedChartTooltip = ({ active, payload, label }: Readonly<RechartsTooltipProps>) => {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;

  // Pies leave `label` empty and put the slice name on payload[0].name.
  const headerSource = label != null && String(label).length > 0 ? label : (payload[0]?.name ?? "");
  const headerText = formatXAxisTick(headerSource);

  return (
    <div className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
      {headerText && <div className="mb-2 text-sm font-medium text-slate-800">{headerText}</div>}
      <div className="flex flex-col gap-1.5">
        {payload.map((item) => {
          const key = item.dataKey ?? String(item.name ?? "");
          // payload.fill (per-row data.fill / pie <Cell>) wins over the Bar's series fallback.
          const indicatorColor = item.payload?.fill ?? item.color ?? CHART_BRAND_DARK;
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
