"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  TFeedbackSourceStatus,
  TFeedbackSourceType,
  TFeedbackSourceWithMappings,
} from "@formbricks/types/feedback-source";
import { Badge } from "@/modules/ui/components/badge";
import { getFeedbackSourceIcon, getFeedbackSourceTypeLabelKey } from "./feedback-source-display";
import { FeedbackSourceRowDropdown } from "./feedback-source-row-dropdown";

const RELATIVE_TIME_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "seconds" },
  { amount: 60, unit: "minutes" },
  { amount: 24, unit: "hours" },
  { amount: 7, unit: "days" },
  { amount: 4.345, unit: "weeks" },
  { amount: 12, unit: "months" },
  { amount: Number.POSITIVE_INFINITY, unit: "years" },
];

function getRelativeTime(date: Date, locale: string) {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let duration = (date.getTime() - Date.now()) / 1000;

  for (const division of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return formatter.format(Math.round(duration), "years");
}

interface FeedbackSourcesTableDataRowProps {
  feedbackSource: TFeedbackSourceWithMappings;
  surveyNameById: Record<string, string>;
  onEdit: () => void;
  onCsvImport?: () => void;
  onToggleStatus: () => Promise<void>;
  onDelete: () => Promise<void>;
  isReadOnly?: boolean;
}

const STATUS_BADGE_TYPE: Record<TFeedbackSourceStatus, "success" | "warning" | "error"> = {
  active: "success",
  paused: "warning",
  error: "error",
};

export function FeedbackSourcesTableDataRow({
  feedbackSource,
  surveyNameById,
  onEdit,
  onCsvImport,
  onToggleStatus,
  onDelete,
  isReadOnly = false,
}: Readonly<FeedbackSourcesTableDataRowProps>) {
  const { t, i18n } = useTranslation();
  // "Data origin": for Formbricks-survey sources, link to the survey summary (like the record level).
  const originSurveyId = feedbackSource.formbricksMappings[0]?.surveyId;
  const originSurveyName = originSurveyId ? surveyNameById[originSurveyId] : undefined;
  const showSurveyOrigin =
    feedbackSource.type === "formbricks_survey" && Boolean(originSurveyId) && Boolean(originSurveyName);
  const handleRowClick = () => {
    if (!isReadOnly && feedbackSource.type === "csv" && onCsvImport) {
      onCsvImport();
      return;
    }

    onEdit();
  };

  const getStatusLabel = (s: TFeedbackSourceStatus, feedbackSourceType: TFeedbackSourceType) => {
    switch (s) {
      case "active":
        if (feedbackSourceType === "csv") {
          return t("workspace.unify.status_ready");
        }
        return t("workspace.unify.status_live_sync");
      case "paused":
        return t("common.disabled");
      case "error":
        return t("workspace.unify.status_error");
    }
  };

  return (
    <div className="grid h-12 min-h-12 grid-cols-12 content-center transition-colors ease-in-out hover:bg-slate-50">
      <button
        type="button"
        className="col-span-4 grid cursor-pointer grid-cols-4 content-center p-2 text-left"
        onClick={handleRowClick}>
        <div
          className="col-span-2 flex items-center gap-2 pl-4"
          title={t(getFeedbackSourceTypeLabelKey(feedbackSource.type))}>
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
        <div className="col-span-2 flex items-center">
          <span className="truncate text-sm font-medium text-slate-900">{feedbackSource.name}</span>
        </div>
      </button>

      <div className="col-span-2 hidden min-w-0 items-center px-2 sm:flex">
        {showSurveyOrigin ? (
          <Link
            href={`/workspaces/${feedbackSource.workspaceId}/surveys/${originSurveyId}/summary`}
            title={originSurveyName}
            className="truncate text-sm text-slate-700 underline underline-offset-2 hover:text-slate-900">
            {originSurveyName}
          </Link>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        )}
      </div>

      <button
        type="button"
        className="col-span-5 grid cursor-pointer grid-cols-5 content-center p-2 text-left"
        onClick={handleRowClick}>
        <div className="col-span-2 hidden items-center justify-center sm:flex">
          <Badge
            text={getStatusLabel(feedbackSource.status, feedbackSource.type)}
            type={STATUS_BADGE_TYPE[feedbackSource.status]}
            size="tiny"
          />
        </div>
        <div className="col-span-2 hidden items-center justify-center text-sm text-slate-500 sm:flex">
          {getRelativeTime(feedbackSource.updatedAt, i18n.language)}
        </div>
        <div className="col-span-1 hidden items-center justify-center text-sm text-slate-500 sm:flex">
          <span className="truncate">{feedbackSource.creatorName ?? "—"}</span>
        </div>
      </button>

      <div className="col-span-1 flex items-center justify-end pr-2">
        {!isReadOnly && (
          <FeedbackSourceRowDropdown
            feedbackSource={feedbackSource}
            onEdit={onEdit}
            onCsvImport={onCsvImport}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
          />
        )}
      </div>
    </div>
  );
}
