"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FeedbackRecordData, TaxonomyNode } from "@/modules/hub/types";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { FeedbackRecordCard } from "./feedback-record-card";

interface TaxonomyNodeRecordsProps {
  node: TaxonomyNode | null;
  records: FeedbackRecordData[];
  limit: number;
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
  isLoading,
  isFetching,
  isError,
  onRetry,
}: Readonly<TaxonomyNodeRecordsProps>) => {
  const { t } = useTranslation();

  return (
    <aside className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-900">
            {node ? node.label : t("workspace.unify.feedback_records")}
          </h2>
          {node?.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{node.description}</p>
          )}
        </div>
        {isFetching && !isLoading && <Loader2Icon className="size-4 shrink-0 animate-spin text-slate-400" />}
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
                <FeedbackRecordCard key={record.id} record={record} />
              ))}
            </div>
          );
        })()}
      </div>
    </aside>
  );
};
