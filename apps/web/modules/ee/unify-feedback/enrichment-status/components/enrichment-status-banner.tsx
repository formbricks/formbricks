"use client";

import { TFunction } from "i18next";
import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ProgressBar } from "@/modules/ui/components/progress-bar";
import type { TEnrichmentKind, TEnrichmentProgress } from "../lib/enrichment";
import { totalPendingEnrichments } from "../lib/enrichment";

// Spelled out per kind rather than built from the kind: the translation-key scanner only sees literal
// `t("…")` calls, so a computed key would be reported as unused and never reach the other locales.
const enrichmentLabel = (kind: TEnrichmentKind, t: TFunction): string => {
  switch (kind) {
    case "translation":
      return t("workspace.unify.translation");
    case "sentiment":
      return t("workspace.unify.sentiment");
    case "emotions":
      return t("workspace.unify.emotions");
  }
};

/**
 * Progress of the record-level AI enrichments (translation, sentiment, emotions) running behind the
 * Feedback Data table.
 *
 * Shown only while something is outstanding: with nothing pending there is no job to report, and a
 * permanent "all caught up" bar would just be a strip of chrome above every page load. Enrichments
 * that have caught up stay listed while the banner is up, so the reader sees the whole picture rather
 * than a lone straggler with no context.
 */
export const EnrichmentStatusBanner = ({ enrichments }: Readonly<{ enrichments: TEnrichmentProgress[] }>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";

  const totalPending = totalPendingEnrichments(enrichments);
  if (totalPending === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Loader2Icon className="size-4 animate-spin text-slate-400" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-700">{t("workspace.unify.enrichment_in_progress")}</p>
        </div>
        <span className="text-xs font-medium text-slate-500">
          {t("workspace.unify.enrichment_pending_summary", { pending: totalPending.toLocaleString(locale) })}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {enrichments.map((enrichment) => {
          const label = enrichmentLabel(enrichment.kind, t);
          const progressLabel = t("workspace.unify.enrichment_progress_count", {
            done: enrichment.done.toLocaleString(locale),
            eligible: enrichment.eligible.toLocaleString(locale),
          });

          return (
            <div key={enrichment.kind}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-600">{label}</span>
                <div className="flex items-center gap-2">
                  {enrichment.failedTerminal > 0 && (
                    <span className="text-xs font-medium text-red-500 tabular-nums">
                      {t("workspace.unify.enrichment_failed_count", {
                        failedCount: enrichment.failedTerminal.toLocaleString(locale),
                      })}
                    </span>
                  )}
                  <span className="text-xs text-slate-500 tabular-nums">{progressLabel}</span>
                </div>
              </div>
              <div
                className="mt-1"
                role="progressbar"
                aria-label={`${label}: ${progressLabel}`}
                aria-valuemin={0}
                aria-valuemax={enrichment.eligible}
                aria-valuenow={enrichment.done}>
                <ProgressBar
                  progress={enrichment.eligible > 0 ? enrichment.done / enrichment.eligible : 0}
                  barColor="bg-brand-dark"
                  height={2}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
