"use client";

import type { TFunction } from "i18next";
import { CalendarDaysIcon, LanguagesIcon, UserIcon } from "lucide-react";
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

export const FeedbackRecordCard = ({ record }: Readonly<{ record: FeedbackRecordData }>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  // Prefer the consolidated-language (translated) text; keep the original reachable via the tooltip.
  const { text, isTranslated, original, langKey } = resolveFeedbackDisplayText(record);
  const translatedLangLabel = langKey ? (getLanguageLabel(langKey, locale) ?? langKey) : null;
  const sentiment = record.sentiment ? sentimentBadge(record.sentiment, t) : null;

  const collectedAt = record.collected_at ? new Date(record.collected_at) : null;
  const formattedDate =
    collectedAt && Number.isFinite(collectedAt.getTime()) ? formatDateForDisplay(collectedAt, locale) : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          text={
            record.source_name || record.source_type || t("workspace.unify.taxonomy_feedback_source_fallback")
          }
          type="gray"
          size="tiny"
        />
        {record.field_type && <Badge text={record.field_type} type="gray" size="tiny" />}
        {isTranslated && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-default items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  <LanguagesIcon aria-hidden="true" className="size-3" />
                  {translatedLangLabel ?? t("workspace.unify.translated")}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap">
                <span className="font-medium">{t("workspace.unify.original_text")}: </span>
                {original ?? "—"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <p className="mt-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {record.field_label || record.field_id}
      </p>
      <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-slate-700">
        {text ?? t("workspace.unify.taxonomy_no_text_value")}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="font-medium text-slate-600">{t("workspace.unify.taxonomy_sentiment_label")}:</span>
          {sentiment ? <Badge text={sentiment.text} type={sentiment.type} size="tiny" /> : <span>—</span>}
        </span>
        <span
          className="inline-flex items-center gap-1.5"
          title={t("workspace.unify.taxonomy_emotion_coming_soon")}>
          <span className="font-medium text-slate-600">{t("workspace.unify.taxonomy_emotion_label")}:</span>
          <span>—</span>
        </span>
        {record.user_id && (
          <span className="inline-flex items-center gap-1">
            <UserIcon aria-hidden="true" className="size-3.5" />
            <span className="max-w-[180px] truncate">{record.user_id}</span>
          </span>
        )}
        {formattedDate && (
          <span className="inline-flex items-center gap-1">
            <CalendarDaysIcon aria-hidden="true" className="size-3.5" />
            {formattedDate}
          </span>
        )}
      </div>
    </div>
  );
};
