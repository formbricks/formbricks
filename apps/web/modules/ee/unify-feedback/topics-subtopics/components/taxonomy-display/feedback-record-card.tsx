"use client";

import type { TFunction } from "i18next";
import { CalendarDaysIcon, LanguagesIcon, UserIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { Badge } from "@/modules/ui/components/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { resolveFeedbackDisplayText } from "../../../lib/utils";

type SentimentValue = NonNullable<FeedbackRecordData["sentiment"]>;
type BadgeType = "warning" | "success" | "error" | "gray" | "info";

const sentimentBadge = (sentiment: SentimentValue, t: TFunction): { text: string; type: BadgeType } => {
  switch (sentiment) {
    case "very_positive":
      return { text: t("workspace.unify.taxonomy_sentiment_very_positive"), type: "success" };
    case "positive":
      return { text: t("workspace.unify.taxonomy_sentiment_positive"), type: "success" };
    case "neutral":
      return { text: t("workspace.unify.taxonomy_sentiment_neutral"), type: "gray" };
    case "negative":
      return { text: t("workspace.unify.taxonomy_sentiment_negative"), type: "warning" };
    case "very_negative":
      return { text: t("workspace.unify.taxonomy_sentiment_very_negative"), type: "error" };
    case "mixed":
      return { text: t("workspace.unify.taxonomy_sentiment_mixed"), type: "info" };
  }
};

/** A labelled metadata field ("Label: value"), the shared shape for source/type/sentiment/emotion. */
const MetaItem = ({ label, children }: Readonly<{ label: string; children: ReactNode }>) => (
  <span className="inline-flex min-w-0 items-center gap-1.5">
    <span className="shrink-0 font-medium text-slate-600">{label}:</span>
    {children}
  </span>
);

export const FeedbackRecordCard = ({ record }: Readonly<{ record: FeedbackRecordData }>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  // Prefer the consolidated-language (translated) text; keep the original reachable via the tooltip.
  const { text, isTranslated, original, langKey } = resolveFeedbackDisplayText(record);
  const translatedLangLabel = langKey ? (getLanguageLabel(langKey, locale) ?? langKey) : null;
  const sentiment = record.sentiment ? sentimentBadge(record.sentiment, t) : null;
  const sourceName =
    record.source_name || record.source_type || t("workspace.unify.taxonomy_feedback_source_fallback");

  const collectedAt = record.collected_at ? new Date(record.collected_at) : null;
  const formattedDate =
    collectedAt && Number.isFinite(collectedAt.getTime()) ? formatDateForDisplay(collectedAt, locale) : null;

  return (
    <TooltipProvider>
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-semibold tracking-wide text-slate-400 uppercase">
            {record.field_label || record.field_id}
          </p>
          {isTranslated && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex shrink-0 cursor-default items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  <LanguagesIcon aria-hidden="true" className="size-3" />
                  {translatedLangLabel ?? t("workspace.unify.translated")}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap">
                <span className="font-medium">{t("workspace.unify.original_text")}: </span>
                {original ?? "—"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-slate-700">
          {text ?? t("workspace.unify.taxonomy_no_text_value")}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
          <MetaItem label={t("workspace.unify.taxonomy_source")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="max-w-[220px] truncate">{sourceName}</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm wrap-break-word">
                {sourceName}
              </TooltipContent>
            </Tooltip>
          </MetaItem>

          {record.field_type && <MetaItem label={t("common.type")}>{record.field_type}</MetaItem>}

          <MetaItem label={t("workspace.unify.taxonomy_sentiment_label")}>
            {sentiment ? <Badge text={sentiment.text} type={sentiment.type} size="tiny" /> : <span>—</span>}
          </MetaItem>

          <MetaItem label={t("workspace.unify.taxonomy_emotion_label")}>
            <span title={t("workspace.unify.taxonomy_emotion_coming_soon")}>—</span>
          </MetaItem>

          {record.user_id && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <UserIcon aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="max-w-[180px] truncate">{record.user_id}</span>
            </span>
          )}
          {formattedDate && (
            <span className="inline-flex items-center gap-1">
              <CalendarDaysIcon aria-hidden="true" className="size-3.5 shrink-0" />
              {formattedDate}
            </span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};
