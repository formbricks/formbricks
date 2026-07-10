"use client";

import { Loader2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import type { FeedbackRecordData, TaxonomyNode } from "@/modules/hub/types";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { EmptyState } from "@/modules/ui/components/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { resolveFeedbackDisplayText } from "../../../lib/utils";
import { FeedbackRecordCard } from "./feedback-record-card";
import { RecordCountPlaceholder } from "./record-count-placeholder";

const COMMENT_LANGUAGE_TRANSLATED = "translated";
const COMMENT_LANGUAGE_ORIGINAL = "original";

interface TaxonomyNodeRecordsProps {
  node: TaxonomyNode | null;
  records: FeedbackRecordData[];
  limit: number;
  /** Subtree record total for the selected node; undefined while counts load. */
  recordCount?: number;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
}

/** Right pane: a capped sample of the feedback records under the selected topic. */
export const TaxonomyNodeRecords = ({
  node,
  records,
  limit,
  recordCount,
  isLoading,
  isFetching,
  isError,
  onRetry,
}: Readonly<TaxonomyNodeRecordsProps>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [showOriginal, setShowOriginal] = useState(false);

  // Offer the comment-language toggle only when the sample actually contains a translation. The label
  // for the translated option is the shared target language (e.g. "English") derived from the records.
  const targetLangLabel = useMemo(() => {
    const translatedRecord = records.find((record) => resolveFeedbackDisplayText(record).isTranslated);
    const langKey = translatedRecord ? resolveFeedbackDisplayText(translatedRecord).langKey : null;
    return langKey ? (getLanguageLabel(langKey, locale) ?? langKey) : null;
  }, [records, locale]);

  return (
    <aside className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-semibold text-slate-900">
              {node ? node.label : t("workspace.unify.feedback_records")}
            </h2>
            {node && <RecordCountPlaceholder count={recordCount} />}
          </div>
          {node?.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{node.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isFetching && !isLoading && <Loader2Icon className="size-4 animate-spin text-slate-400" />}
          {targetLangLabel && (
            <Select
              value={showOriginal ? COMMENT_LANGUAGE_ORIGINAL : COMMENT_LANGUAGE_TRANSLATED}
              onValueChange={(value) => setShowOriginal(value === COMMENT_LANGUAGE_ORIGINAL)}>
              <SelectTrigger
                className="h-8 w-auto gap-1.5 text-xs"
                aria-label={t("workspace.unify.comment_language")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={COMMENT_LANGUAGE_TRANSLATED}>{targetLangLabel}</SelectItem>
                <SelectItem value={COMMENT_LANGUAGE_ORIGINAL}>
                  {t("workspace.unify.original_text")}
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="p-4">
        {(() => {
          if (!node) {
            return <EmptyState text={t("workspace.unify.taxonomy_select_topic")} variant="simple" />;
          }
          if (isLoading) {
            return (
              <div className="flex items-center justify-center py-10">
                <Loader2Icon className="size-5 animate-spin text-slate-400" />
              </div>
            );
          }
          if (isError) {
            return (
              <Alert variant="error" size="small">
                <AlertTitle>{t("common.something_went_wrong_please_try_again")}</AlertTitle>
                <AlertDescription>{t("workspace.unify.taxonomy_load_records_failed")}</AlertDescription>
                <AlertButton onClick={onRetry}>{t("common.retry")}</AlertButton>
              </Alert>
            );
          }
          if (records.length === 0) {
            return <EmptyState text={t("workspace.unify.taxonomy_no_records")} variant="simple" />;
          }
          return (
            <div className="space-y-3">
              {records.length >= limit && (
                <p className="text-xs text-slate-400">
                  {t("workspace.unify.taxonomy_records_sample_note", { limit })}
                </p>
              )}
              {records.map((record) => (
                <FeedbackRecordCard key={record.id} record={record} showOriginal={showOriginal} />
              ))}
            </div>
          );
        })()}
      </div>
    </aside>
  );
};
