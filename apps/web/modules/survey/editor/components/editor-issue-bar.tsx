"use client";

import { useTranslation } from "react-i18next";
import {
  ErrorSummary,
  type TErrorSummaryGroup,
  type TErrorSummaryItem,
} from "@/modules/ui/components/error-summary";

interface EditorIssueBarProps {
  readonly items: readonly TErrorSummaryItem[];
  readonly groups: readonly TErrorSummaryGroup[];
  readonly problemCount: number;
  /** A failed save or publish that is not about the survey's content; it replaces the list while it lasts. */
  readonly systemError: string | null;
  /** The review tab lists the problems itself, so the bar steps aside there; a failed save still shows. */
  readonly isReviewOpen: boolean;
  readonly onReviewAll: () => void;
  readonly shouldFocus: boolean;
  readonly onFocused: () => void;
}

/** The slim bar under the menu bar: how many problems the survey has, or why the last save failed. */
export const EditorIssueBar = ({
  items,
  groups,
  problemCount,
  systemError,
  isReviewOpen,
  onReviewAll,
  shouldFocus,
  onFocused,
}: EditorIssueBarProps) => {
  const { t } = useTranslation();

  if (!systemError && (items.length === 0 || isReviewOpen)) return null;

  return (
    <ErrorSummary
      heading={t("workspace.surveys.edit.issue_summary_heading", { count: systemError ? 1 : problemCount })}
      items={systemError ? [] : items}
      groups={systemError ? [] : groups}
      description={systemError ?? undefined}
      goToFirstLabel={t("workspace.surveys.edit.issue_summary_go_to_first")}
      reviewAllLabel={t("workspace.surveys.edit.issue_summary_review_all")}
      onReviewAll={onReviewAll}
      shouldFocus={shouldFocus}
      onFocused={onFocused}
    />
  );
};
