"use client";

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
  onEdit: () => void;
  onCsvImport?: () => void;
  onDuplicate: () => Promise<void>;
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
  onEdit,
  onCsvImport,
  onDuplicate,
  onToggleStatus,
  onDelete,
  isReadOnly = false,
}: Readonly<FeedbackSourcesTableDataRowProps>) {
  const { t, i18n } = useTranslation();
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
    <div
      role="button"
      tabIndex={0}
      className="grid h-12 min-h-12 cursor-pointer grid-cols-12 content-center p-2 text-left transition-colors ease-in-out hover:bg-slate-50"
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleRowClick();
        }
      }}>
      <div
        className="col-span-1 flex items-center gap-2 pl-4"
        title={t(getFeedbackSourceTypeLabelKey(feedbackSource.type))}>
        {getFeedbackSourceIcon(feedbackSource.type, "h-4 w-4 text-slate-500")}
      </div>
      <div className="col-span-4 flex items-center">
        <span className="truncate text-sm font-medium text-slate-900">{feedbackSource.name}</span>
      </div>
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
      <div className="col-span-2 hidden items-center justify-center text-sm text-slate-500 sm:flex">
        <span className="truncate">{feedbackSource.creatorName ?? "—"}</span>
      </div>
      <div className="col-span-1 flex items-center justify-end pr-2">
        {!isReadOnly && (
          <FeedbackSourceRowDropdown
            feedbackSource={feedbackSource}
            onEdit={onEdit}
            onCsvImport={onCsvImport}
            onDuplicate={onDuplicate}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
          />
        )}
      </div>
    </div>
  );
}
