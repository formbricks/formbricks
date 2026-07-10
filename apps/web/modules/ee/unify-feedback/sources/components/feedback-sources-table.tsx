"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TFeedbackSourceWithMappings } from "@formbricks/types/feedback-source";
import { TUnifySurvey } from "../types";
import { FeedbackSourceSuggestions } from "./feedback-source-suggestions";
import { FeedbackSourcesTableRowsContainer } from "./feedback-sources-table-rows-container";

interface FeedbackSourcesTableProps {
  feedbackSources: TFeedbackSourceWithMappings[];
  /** Maps survey id -> survey name, used to render the "Data origin" column for Formbricks sources. */
  surveyNameById: Record<string, string>;
  /** Surveys not yet connected as a source — rendered as "Suggestions" below the table rows. */
  suggestedSurveys: TUnifySurvey[];
  workspaceId: string;
  onFeedbackSourceClick: (feedbackSource: TFeedbackSourceWithMappings) => void;
  onCsvImport: (feedbackSource: TFeedbackSourceWithMappings) => void;
  onToggleStatus: (feedbackSource: TFeedbackSourceWithMappings) => Promise<void>;
  onDelete: (feedbackSourceId: string) => Promise<void>;
  onImportResponses: (survey: TUnifySurvey) => Promise<void>;
  onSelectQuestions: (survey: TUnifySurvey) => void;
  isLoading?: boolean;
  isReadOnly?: boolean;
}

export function FeedbackSourcesTable({
  feedbackSources,
  surveyNameById,
  suggestedSurveys,
  workspaceId,
  onFeedbackSourceClick,
  onCsvImport,
  onToggleStatus,
  onDelete,
  onImportResponses,
  onSelectQuestions,
  isLoading = false,
  isReadOnly = false,
}: Readonly<FeedbackSourcesTableProps>) {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="grid h-12 grid-cols-12 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
        <div className="col-span-2 pl-6">{t("common.type")}</div>
        <div className="col-span-2">{t("common.name")}</div>
        <div className="col-span-2 hidden sm:block">{t("workspace.unify.data_origin")}</div>
        <div className="col-span-2 hidden text-center sm:block">{t("common.status")}</div>
        <div className="col-span-2 hidden text-center sm:block">{t("workspace.unify.updated_at")}</div>
        <div className="col-span-1 hidden text-center sm:block">{t("workspace.unify.created_by")}</div>
        <div className="col-span-1" />
      </div>
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2Icon className="size-6 animate-spin text-slate-500" />
        </div>
      ) : (
        <>
          <FeedbackSourcesTableRowsContainer
            feedbackSources={feedbackSources}
            surveyNameById={surveyNameById}
            onFeedbackSourceClick={onFeedbackSourceClick}
            onCsvImport={onCsvImport}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
            isReadOnly={isReadOnly}
          />
          {!isReadOnly && (
            <FeedbackSourceSuggestions
              suggestedSurveys={suggestedSurveys}
              workspaceId={workspaceId}
              onImportResponses={onImportResponses}
              onSelectQuestions={onSelectQuestions}
            />
          )}
        </>
      )}
    </div>
  );
}
