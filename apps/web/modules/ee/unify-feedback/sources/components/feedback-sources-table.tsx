"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TFeedbackSourceWithMappings } from "@formbricks/types/feedback-source";
import type { TFeedbackSourceWithMappingsAndContext } from "@/lib/feedback-source/service";
import { FeedbackSourcesTableRowsContainer } from "./feedback-sources-table-rows-container";

interface FeedbackSourcesTableProps {
  feedbackSources: TFeedbackSourceWithMappingsAndContext[];
  onFeedbackSourceClick: (feedbackSource: TFeedbackSourceWithMappings) => void;
  onCsvImport: (feedbackSource: TFeedbackSourceWithMappings) => void;
  onDuplicate: (feedbackSource: TFeedbackSourceWithMappings) => Promise<void>;
  onToggleStatus: (feedbackSource: TFeedbackSourceWithMappings) => Promise<void>;
  onDelete: (feedbackSource: TFeedbackSourceWithMappings) => Promise<void>;
  isLoading?: boolean;
  isReadOnly?: boolean;
}

export function FeedbackSourcesTable({
  feedbackSources,
  onFeedbackSourceClick,
  onCsvImport,
  onDuplicate,
  onToggleStatus,
  onDelete,
  isLoading = false,
  isReadOnly = false,
}: Readonly<FeedbackSourcesTableProps>) {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="grid h-12 grid-cols-12 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
        <div className="col-span-1 pl-6">{t("common.type")}</div>
        <div className="col-span-3">{t("common.name")}</div>
        <div className="col-span-2 hidden sm:block">{t("common.workspace")}</div>
        <div className="col-span-2 hidden sm:block">
          {t("workspace.settings.feedback_directories.directory_name")}
        </div>
        <div className="col-span-1 hidden text-center sm:block">{t("common.status")}</div>
        <div className="col-span-2 hidden text-center sm:block">{t("workspace.unify.updated_at")}</div>
        <div className="col-span-1" />
      </div>
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2Icon className="size-6 animate-spin text-slate-500" />
        </div>
      ) : (
        <FeedbackSourcesTableRowsContainer
          feedbackSources={feedbackSources}
          onFeedbackSourceClick={onFeedbackSourceClick}
          onCsvImport={onCsvImport}
          onDuplicate={onDuplicate}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
}
