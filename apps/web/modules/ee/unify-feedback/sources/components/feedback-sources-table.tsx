"use client";

import type { TFunction } from "i18next";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  TFeedbackSourceStatus,
  TFeedbackSourceType,
  TFeedbackSourceWithMappings,
} from "@formbricks/types/feedback-source";
import { timeSinceDate } from "@/lib/time";
import { Badge } from "@/modules/ui/components/badge";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import { TUnifySurvey } from "../types";
import { getFeedbackSourceIcon, getFeedbackSourceTypeLabelKey } from "./feedback-source-display";
import { FeedbackSourceRowDropdown } from "./feedback-source-row-dropdown";
import { FeedbackSourceSuggestions } from "./feedback-source-suggestions";

const STATUS_BADGE_TYPE: Record<TFeedbackSourceStatus, "success" | "warning" | "error"> = {
  active: "success",
  paused: "warning",
  error: "error",
};

const getStatusLabel = (
  status: TFeedbackSourceStatus,
  feedbackSourceType: TFeedbackSourceType,
  t: TFunction
): string => {
  switch (status) {
    case "active":
      return feedbackSourceType === "csv"
        ? t("workspace.unify.status_ready")
        : t("workspace.unify.status_live_sync");
    case "paused":
      return t("common.disabled");
    case "error":
      return t("workspace.unify.status_error");
  }
};

/**
 * Defined at module level rather than inside the component: an inline `cell` that returns JSX reads as a
 * nested component definition to Sonar (typescript:S6478).
 *
 * The seven columns replace a `grid-cols-12` header in one file and a `grid-cols-12` row in another, whose
 * spans had to be kept in step by hand across two nested sub-grids.
 */
const getFeedbackSourceColumns = ({
  t,
  locale,
  surveyNameById,
  onCsvImport,
  onReimport,
  onToggleStatus,
  onDelete,
  onFeedbackSourceClick,
  isReadOnly,
}: Readonly<{
  t: TFunction;
  locale: string;
  surveyNameById: Record<string, string>;
  onCsvImport: (feedbackSource: TFeedbackSourceWithMappings) => void;
  onReimport: (feedbackSource: TFeedbackSourceWithMappings) => Promise<void>;
  onToggleStatus: (feedbackSource: TFeedbackSourceWithMappings) => Promise<void>;
  onDelete: (feedbackSourceId: string) => Promise<void>;
  onFeedbackSourceClick: (feedbackSource: TFeedbackSourceWithMappings) => void;
  isReadOnly: boolean;
}>): TSettingsTableColumn<TFeedbackSourceWithMappings>[] => [
  {
    id: "type",
    header: t("common.type"),
    headerClassName: "w-[14%]",
    skeletonWidth: "w-16",
    cell: (feedbackSource) => (
      <div className="flex items-center gap-2" title={t(getFeedbackSourceTypeLabelKey(feedbackSource.type))}>
        {getFeedbackSourceIcon(feedbackSource.type, "h-4 w-4 shrink-0 text-slate-500")}
        <Badge
          text={
            feedbackSource.type === "csv"
              ? t("workspace.unify.source_type_csv")
              : t("workspace.unify.source_type_survey")
          }
          type="gray"
          size="tiny"
        />
      </div>
    ),
  },
  {
    id: "name",
    header: t("common.name"),
    headerClassName: "w-[20%]",
    cellClassName: "font-medium text-slate-900",
    skeletonWidth: "w-32",
    cell: (feedbackSource) => feedbackSource.name,
  },
  {
    id: "origin",
    header: t("workspace.unify.data_origin"),
    headerClassName: "w-[20%]",
    hideBelow: "sm",
    skeletonWidth: "w-24",
    // The whole reason the old row had *two* separate `<button>`s wrapping the columns either side of
    // this one: a nested link cannot live inside a button. `stopRowClick` expresses that with one table
    // row instead, which is what collapses two tab stops into one.
    stopRowClick: true,
    cell: (feedbackSource) => {
      const originSurveyId = feedbackSource.formbricksMappings[0]?.surveyId;
      const originSurveyName = originSurveyId ? surveyNameById[originSurveyId] : undefined;

      if (feedbackSource.type !== "formbricks_survey" || !originSurveyId || !originSurveyName) {
        return <span className="text-sm text-slate-400">—</span>;
      }

      return (
        <Link
          href={`/workspaces/${feedbackSource.workspaceId}/surveys/${originSurveyId}/summary`}
          title={originSurveyName}
          className="text-sm text-slate-700 underline underline-offset-2 hover:text-slate-900">
          {originSurveyName}
        </Link>
      );
    },
  },
  {
    id: "status",
    header: t("common.status"),
    headerClassName: "w-[14%]",
    hideBelow: "sm",
    align: "center",
    skeletonWidth: "w-20",
    cell: (feedbackSource) => (
      <Badge
        text={getStatusLabel(feedbackSource.status, feedbackSource.type, t)}
        type={STATUS_BADGE_TYPE[feedbackSource.status]}
        size="tiny"
      />
    ),
  },
  {
    id: "updatedAt",
    header: t("workspace.unify.updated_at"),
    // `whitespace-nowrap` makes the header's min-content width its text width, so `table-auto`
    // has to allocate at least that and a two-word label cannot wrap in a narrow column.
    headerClassName: "w-[14%] whitespace-nowrap",
    hideBelow: "sm",
    align: "center",
    cellClassName: "text-slate-500",
    skeletonWidth: "w-20",
    // The shared helper, replacing a local `getRelativeTime` built on `Intl.RelativeTimeFormat` that
    // duplicated it and bypassed the repo's date-rendering rule.
    cell: (feedbackSource) => timeSinceDate(feedbackSource.updatedAt, locale),
  },
  {
    id: "createdBy",
    header: t("workspace.unify.created_by"),
    // `whitespace-nowrap` makes the header's min-content width its text width, so `table-auto`
    // has to allocate at least that and a two-word label cannot wrap in a narrow column.
    headerClassName: "w-[12%] whitespace-nowrap",
    hideBelow: "sm",
    align: "center",
    cellClassName: "text-slate-500",
    skeletonWidth: "w-16",
    cell: (feedbackSource) => feedbackSource.creatorName ?? "—",
  },
  {
    id: "actions",
    header: null,
    srLabel: t("common.actions"),
    headerClassName: "w-[6%]",
    stopRowClick: true,
    skeletonWidth: "w-8",
    cell: (feedbackSource) =>
      isReadOnly ? null : (
        // Flex on a wrapper, not on `cellClassName`, which would stop the `<td>` being a table cell.
        <div className="flex justify-end">
          <FeedbackSourceRowDropdown
            feedbackSource={feedbackSource}
            onEdit={() => onFeedbackSourceClick(feedbackSource)}
            onCsvImport={feedbackSource.type === "csv" ? () => onCsvImport(feedbackSource) : undefined}
            onReimport={() => onReimport(feedbackSource)}
            onToggleStatus={() => onToggleStatus(feedbackSource)}
            onDelete={() => onDelete(feedbackSource.id)}
          />
        </div>
      ),
  },
];

interface FeedbackSourcesTableProps {
  feedbackSources: TFeedbackSourceWithMappings[];
  /** Maps survey id -> survey name, used to render the "Data origin" column for Formbricks sources. */
  surveyNameById: Record<string, string>;
  /** Surveys not yet connected as a source — rendered as "Suggestions" below the table rows. */
  suggestedSurveys: TUnifySurvey[];
  workspaceId: string;
  onFeedbackSourceClick: (feedbackSource: TFeedbackSourceWithMappings) => void;
  onCsvImport: (feedbackSource: TFeedbackSourceWithMappings) => void;
  onReimport: (feedbackSource: TFeedbackSourceWithMappings) => Promise<void>;
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
  onReimport,
  onToggleStatus,
  onDelete,
  onImportResponses,
  onSelectQuestions,
  isLoading = false,
  isReadOnly = false,
}: Readonly<FeedbackSourcesTableProps>) {
  const { t, i18n } = useTranslation();

  // A CSV source opens the import flow instead of the edit modal; everything else edits.
  const handleRowClick = (feedbackSource: TFeedbackSourceWithMappings) => {
    if (!isReadOnly && feedbackSource.type === "csv") {
      onCsvImport(feedbackSource);
      return;
    }

    onFeedbackSourceClick(feedbackSource);
  };

  return (
    // `frame="card"` because this table stands on its own under `PageContentWrapper` rather than inside a
    // settings card — the only table in the series that draws its own frame.
    <SettingsTable
      columns={getFeedbackSourceColumns({
        t,
        locale: i18n.language,
        surveyNameById,
        onCsvImport,
        onReimport,
        onToggleStatus,
        onDelete,
        onFeedbackSourceClick,
        isReadOnly,
      })}
      rows={feedbackSources}
      getRowId={(feedbackSource) => feedbackSource.id}
      emptyMessage={t("workspace.unify.no_sources_connected")}
      frame="card"
      isLoading={isLoading}
      aria-label={t("workspace.unify.feedback_sources")}
      onRowClick={handleRowClick}
      getRowLabel={(feedbackSource) => feedbackSource.name}
      footer={
        isReadOnly ? undefined : (
          <FeedbackSourceSuggestions
            suggestedSurveys={suggestedSurveys}
            workspaceId={workspaceId}
            onImportResponses={onImportResponses}
            onSelectQuestions={onSelectQuestions}
          />
        )
      }
    />
  );
}
