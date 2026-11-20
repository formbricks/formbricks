"use client";

import { AlertCircleIcon } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";
import { ERROR_LINK_CLASS, type TErrorSummaryItem } from "./error-list";

export type { TErrorSummaryItem } from "./error-list";

/** How many problems one place has, e.g. a tab; selecting it opens the full list for that place. */
export interface TErrorSummaryGroup {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly onSelect: () => void;
}

interface ErrorSummaryProps {
  /** Where the problems are. Shown only when there is more than one place; one place is just the total. */
  readonly groups?: readonly TErrorSummaryGroup[];
  /** Says how many problems there are: "There is a problem", "There are 6 problems". */
  readonly heading: string;
  /** One entry per problem; the bar jumps to the first. */
  readonly items?: readonly TErrorSummaryItem[];
  /** A message with no place to go to, e.g. a failed save. */
  readonly description?: string;
  readonly goToFirstLabel: string;
  readonly reviewAllLabel: string;
  /** Opens the full list. */
  readonly onReviewAll: () => void;
  /** Set when a failed attempt has just shown the bar: focus moves to the heading, so a screen reader reads it. */
  readonly shouldFocus?: boolean;
  /** Called once the heading has the focus, so a later remount of the bar does not take it again. */
  readonly onFocused?: (heading: HTMLElement) => void;
  readonly className?: string;
}

/**
 * A slim "There is a problem" bar: how many problems there are, a jump to the first one, and a link to the
 * full list. It takes one row of height whatever the number of problems, so it never pushes the editor down;
 * the details sit next to each field and on the review tab.
 */
export const ErrorSummary = ({
  groups = [],
  heading,
  items = [],
  description,
  goToFirstLabel,
  reviewAllLabel,
  onReviewAll,
  shouldFocus,
  onFocused,
  className,
}: ErrorSummaryProps) => {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!shouldFocus) return;
    const heading = headingRef.current;
    if (!heading) return;
    heading.focus();
    onFocused?.(heading);
  }, [shouldFocus, onFocused]);

  return (
    // A labelled section, not role="alert": focus moves to the heading, which is what announces it.
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-red-200 bg-red-50 px-5 py-2.5",
        className
      )}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <AlertCircleIcon aria-hidden="true" className="size-4 shrink-0 text-error" />
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="text-sm font-semibold text-slate-900 focus:outline-hidden">
          {heading}
          {description ? <span className="font-normal text-error-foreground">: {description}</span> : null}
        </h2>
        {groups.length > 1 ? (
          <ul className="flex flex-wrap items-center gap-1.5">
            {groups.map((group) => (
              <li key={group.key}>
                <button
                  type="button"
                  onClick={group.onSelect}
                  className="rounded-full border border-red-200 bg-white px-2.5 py-0.5 text-xs text-error-foreground hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden">
                  {group.label} <span className="font-semibold">{group.count}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {items.length > 0 ? (
        <div className="flex shrink-0 items-center gap-4">
          <button type="button" className={ERROR_LINK_CLASS} onClick={items[0].onSelect}>
            {goToFirstLabel}
          </button>
          <button type="button" className={cn(ERROR_LINK_CLASS, "font-medium")} onClick={onReviewAll}>
            {reviewAllLabel}
          </button>
        </div>
      ) : null}
    </section>
  );
};
