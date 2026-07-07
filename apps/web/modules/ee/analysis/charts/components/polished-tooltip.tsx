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
  /** Formats the header (dimension value); defaults to the generic date/string formatting. */
  labelFormatter?: (value: unknown) => string;
}

export const PolishedChartTooltip = ({
  active,
  payload,
  label,
  labelFormatter,
}: Readonly<RechartsTooltipProps>) => {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;

  // Pies leave `label` empty and put the slice name on payload[0].name.
  const headerSource = label != null && String(label).length > 0 ? label : (payload[0]?.name ?? "");
  const headerText = labelFormatter ? labelFormatter(headerSource) : formatXAxisTick(headerSource);

  return (
    <div className="border-border/50 min-w-[180px] rounded-lg border bg-white px-3 py-2.5 shadow-lg dark:bg-gray-950">
      {headerText && <div className="text-foreground mb-2 text-sm font-medium">{headerText}</div>}
      <div className="flex flex-col gap-1.5">
        {payload.map((item) => {
          const key = item.dataKey ?? String(item.name ?? "");
          // payload.fill (per-row data.fill / pie <Cell>) wins over the Bar's series fallback.
          const indicatorColor = item.payload?.fill ?? item.color ?? CHART_BRAND_DARK;
          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: indicatorColor }} />
                <span className="text-muted-foreground text-sm">{formatCubeColumnHeader(key, t)}</span>
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
