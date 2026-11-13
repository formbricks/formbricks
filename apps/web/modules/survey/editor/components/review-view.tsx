"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ERROR_LINK_CLASS,
  ErrorList,
  type TErrorSummaryItem,
} from "@/modules/ui/components/error-summary/error-list";

interface ReviewViewProps {
  /** One entry per kind of problem, already grouped by repeats; each goes to its place when selected. */
  readonly items: readonly TErrorSummaryItem[];
  /** How many problems there are, before repeats are merged into one entry. */
  readonly problemCount: number;
  /** Moves focus to the heading each time it changes, so a screen reader reads where it landed. */
  readonly focusRequest: number;
  /** The tab the list is narrowed to, when it was opened from a tab chip. */
  readonly filterLabel?: string;
  /** How many problems that tab has, for "2 of 8". */
  readonly filterCount?: number;
  readonly onClearFilter?: () => void;
}

/**
 * The last tab: everything that stands between the survey and being published, grouped by tab and question,
 * each with a link to where it is fixed. With nothing in the way it says so.
 */
export const ReviewView = ({
  items,
  problemCount,
  focusRequest,
  filterLabel,
  filterCount,
  onClearFilter,
}: Readonly<ReviewViewProps>) => {
  const { t } = useTranslation();
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [focusRequest]);

  const hasProblems = problemCount > 0;

  return (
    <div className="mt-12 w-full px-5 py-4">
      <section aria-labelledby={headingId}>
        <div className="flex items-start gap-3">
          {hasProblems ? null : (
            <CheckCircle2Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
          )}
          <div>
            <h2
              id={headingId}
              ref={headingRef}
              tabIndex={-1}
              className="text-lg font-semibold text-slate-900 focus:outline-hidden">
              {hasProblems
                ? t("workspace.surveys.edit.issue_summary_heading", { count: problemCount })
                : t("workspace.surveys.edit.issue_review_ready_heading")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {hasProblems
                ? t("workspace.surveys.edit.issue_review_intro")
                : t("workspace.surveys.edit.issue_review_ready_text")}
            </p>
          </div>
        </div>
        {hasProblems && filterLabel ? (
          <p className="mt-3 text-sm text-slate-600">
            {t("workspace.surveys.edit.issue_review_filtered", {
              shown: filterCount,
              total: problemCount,
              tab: filterLabel,
            })}{" "}
            <button type="button" className={ERROR_LINK_CLASS} onClick={onClearFilter}>
              {t("workspace.surveys.edit.issue_review_show_all")}
            </button>
          </p>
        ) : null}
        {hasProblems ? <ErrorList items={items} className="mt-4" /> : null}
      </section>
    </div>
  );
};
