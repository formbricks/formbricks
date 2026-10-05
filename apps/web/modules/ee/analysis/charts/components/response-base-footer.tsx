"use client";

import { useTranslation } from "react-i18next";
import type { TResponseBaseFamily } from "@/modules/ee/analysis/lib/schema-definition";

interface ResponseBaseFooterProps {
  family: TResponseBaseFamily;
  count: number;
}

/**
 * "Based on 312 NPS answers": how many answers the chart's numbers rest on. A caption, not a
 * section: it sits in the chart's lower-left corner in the quietest ink, with no rule above it, so
 * the eye lands on the chart and finds the base only when it asks for it.
 */
export function ResponseBaseFooter({ family, count }: Readonly<ResponseBaseFooterProps>) {
  const { t } = useTranslation();
  const labels: Record<TResponseBaseFamily, string> = {
    nps: t("workspace.analysis.charts.response_base_nps", { count }),
    csat: t("workspace.analysis.charts.response_base_csat", { count }),
    ces: t("workspace.analysis.charts.response_base_ces", { count }),
    rating: t("workspace.analysis.charts.response_base_rating", { count }),
  };
  return (
    <p className="shrink-0 self-start pt-1 text-left text-[11px] leading-4 text-slate-400 tabular-nums">
      {labels[family]}
    </p>
  );
}
