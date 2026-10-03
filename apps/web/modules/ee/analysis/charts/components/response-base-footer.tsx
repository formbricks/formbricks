"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { TResponseBaseFamily } from "@/modules/ee/analysis/lib/schema-definition";

interface ResponseBaseFooterProps {
  family: TResponseBaseFamily;
  count: number;
  /** Big numbers print the base as a line under their label instead of a ruled footer. */
  inline?: boolean;
}

/** "Based on 312 NPS answers": how many answers the chart's numbers rest on. */
export function ResponseBaseFooter({ family, count, inline = false }: Readonly<ResponseBaseFooterProps>) {
  const { t } = useTranslation();
  const labels: Record<TResponseBaseFamily, string> = {
    nps: t("workspace.analysis.charts.response_base_nps", { count }),
    csat: t("workspace.analysis.charts.response_base_csat", { count }),
    ces: t("workspace.analysis.charts.response_base_ces", { count }),
    rating: t("workspace.analysis.charts.response_base_rating", { count }),
  };
  return (
    <p
      className={cn(
        "text-muted-foreground text-xs tabular-nums",
        inline ? "mt-1" : "shrink-0 border-t border-slate-100 px-1 pt-2"
      )}>
      {labels[family]}
    </p>
  );
}
