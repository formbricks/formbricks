"use client";

import { TFunction } from "i18next";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ProgressBar } from "@/modules/ui/components/progress-bar";
import type { TEnrichmentKind, TEnrichmentProgress } from "../lib/enrichment";
import { totalFailedTerminalEnrichments, totalPendingEnrichments } from "../lib/enrichment";

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
 * Shown while something is outstanding *or* while a permanent failure (ENG-2375) has nothing left to
 * report but itself — a bar keyed only on `pending` would hide the failure count at the exact moment
 * it becomes the final answer, which defeats the point of tracking it separately. With neither, there
 * is no job to report, and a permanent "all caught up" bar would just be a strip of chrome above every
 * page load. Enrichments that have caught up stay listed while the banner is up, so the reader sees
 * the whole picture rather than a lone straggler with no context.
 */
export const EnrichmentStatusBanner = ({ enrichments }: Readonly<{ enrichments: TEnrichmentProgress[] }>) => {
  const { t } = useTranslation();

  const totalPending = totalPendingEnrichments(enrichments);
  const totalFailedTerminal = totalFailedTerminalEnrichments(enrichments);
  if (totalPending === 0 && totalFailedTerminal === 0) return null;

  const isInProgress = totalPending > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isInProgress ? (
            <Loader2Icon className="size-4 animate-spin text-slate-400" aria-hidden="true" />
          ) : (
            <AlertCircleIcon className="size-4 text-red-500" aria-hidden="true" />
          )}
          <p className="text-sm font-medium text-slate-700">
            {isInProgress
              ? t("workspace.unify.enrichment_in_progress")
              : t("workspace.unify.enrichment_failed_summary_title")}
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500">
          {isInProgress
            ? t("workspace.unify.enrichment_pending_summary", { pending: totalPending })
            : t("workspace.unify.enrichment_failed_count", { failedCount: totalFailedTerminal })}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {enrichments.map((enrichment) => {
          const label = enrichmentLabel(enrichment.kind, t);
          const progressLabel = t("workspace.unify.enrichment_progress_count", {
            done: enrichment.done,
            eligible: enrichment.eligible,
          });

          return (
            <div key={enrichment.kind}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-600">{label}</span>
                <div className="flex items-center gap-2">
                  {enrichment.failedTerminal > 0 && (
                    <span className="text-xs font-medium text-red-500 tabular-nums">
                      {t("workspace.unify.enrichment_failed_count", {
                        failedCount: enrichment.failedTerminal,
                      })}
                    </span>
                  )}
                  <span className="text-xs text-slate-500 tabular-nums">{progressLabel}</span>
                </div>
              </div>
              <div className="mt-1">
                {/* Native <progress> carries the accessible semantics (Sonar S6819 — role="progressbar"
                    on a div is not exposed as a progress bar on every platform); visually hidden since
                    the styled bar below renders the same value for sighted users. */}
                <progress
                  className="sr-only"
                  value={enrichment.done}
                  max={enrichment.eligible || undefined}
                  aria-label={`${label}: ${progressLabel}`}
                />
                <div aria-hidden="true">
                  <ProgressBar
                    progress={enrichment.eligible > 0 ? enrichment.done / enrichment.eligible : 0}
                    barColor="bg-brand-dark"
                    height={2}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
