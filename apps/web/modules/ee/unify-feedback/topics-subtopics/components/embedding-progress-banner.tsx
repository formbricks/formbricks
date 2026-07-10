"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ProgressBar } from "@/modules/ui/components/progress-bar";

/** Inline embedding-progress indicator shown when ≤ 50 records are still being embedded (organic
 * trickle) — the UI is usable while the remaining records catch up in the background. */
export const EmbeddingProgressBanner = ({ current, total }: Readonly<{ current: number; total: number }>) => {
  const { t } = useTranslation();
  const progress = total > 0 ? current / total : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Loader2Icon className="size-4 animate-spin text-slate-400" />
          <p className="text-sm font-medium text-slate-700">
            {t("workspace.unify.taxonomy_embedding_in_progress")}
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500">
          {t("workspace.unify.taxonomy_gate_embedding_progress", {
            current: current.toLocaleString(),
            total: total.toLocaleString(),
          })}
        </span>
      </div>
      <div className="mt-2">
        <ProgressBar progress={progress} barColor="bg-brand-dark" height={2} />
      </div>
    </div>
  );
};
