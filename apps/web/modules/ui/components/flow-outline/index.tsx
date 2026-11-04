"use client";

import { ChevronDownIcon, ChevronRightIcon, CornerDownRightIcon, LockIcon } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * FlowOutline (ENG-3749): a survey's whole flow on one spine, read top to bottom in the order a
 * respondent moves. Blocks are rows; what runs after a block sits indented under it; endings come
 * last. Presentational only — the Flow tab builds the rows from its outline model.
 *
 * Tones follow the UI mock: blue for a rule (jump, require answer), green for an Embedded Data step
 * (a calculation), red for an ending, white for a block.
 */

export type TFlowOutlineTone = "block" | "rule" | "embeddedData" | "ending";

interface FlowOutlineProps {
  /** Left of the header: e.g. the Expand / Collapse toggle and an info button saying how to read it. */
  readonly actions?: ReactNode;
  /** Right of the header: e.g. "5 blocks · 4 endings". */
  readonly count?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

export const FlowOutline = ({ actions, count, children, className }: FlowOutlineProps) => (
  <div className={cn("space-y-3", className)}>
    <div className="flex items-center justify-between gap-3">
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      {count && <span className="shrink-0 text-xs text-slate-500">{count}</span>}
    </div>
    <div className="space-y-2 border-l-2 border-slate-200 pl-1.5">{children}</div>
  </div>
);

/** A section label on the spine: "Before the first question", "Endings". */
export const FlowOutlineSectionLabel = ({ children }: { readonly children: ReactNode }) => (
  <p className="pt-1 pl-6 text-[11px] font-medium tracking-wide text-slate-400 uppercase">{children}</p>
);

/** A block and everything indented under it. */
export const FlowOutlineGroup = ({ children }: { readonly children: ReactNode }) => (
  <div className="space-y-2">{children}</div>
);

/** The rows that run after a block, indented under it. */
export const FlowOutlineChildren = ({ children }: { readonly children: ReactNode }) => (
  <div className="ml-5 space-y-2 border-l-2 border-slate-200 pt-2 pl-3">{children}</div>
);

/** A quiet line on the spine, e.g. where everyone else goes after a block. */
export const FlowOutlineNote = ({
  icon,
  children,
}: {
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}) => (
  <div className="flex items-center gap-1.5 pl-6 text-xs text-slate-500 [&_svg]:size-3.5 [&_svg]:shrink-0">
    {icon}
    {children}
  </div>
);

const TONE_CARD: Record<TFlowOutlineTone, string> = {
  block: "border-slate-200 bg-white shadow-xs",
  rule: "border-blue-200 bg-blue-50/60",
  embeddedData: "border-emerald-200 bg-emerald-50/60",
  ending: "border-red-300 bg-red-50",
};

const TONE_ICON: Record<TFlowOutlineTone, string> = {
  block: "size-6 bg-slate-700",
  rule: "size-5 bg-blue-600",
  embeddedData: "size-5 bg-emerald-600",
  ending: "size-6 bg-red-600",
};

interface FlowOutlineRowProps {
  readonly tone: TFlowOutlineTone;
  readonly icon: ReactNode;
  /** The row's one-line summary. */
  readonly children: ReactNode;
  /** Opens or closes the row's settings in place. Without it the row is static. */
  readonly onToggle?: () => void;
  readonly isOpen?: boolean;
  /** The settings, shown under the summary while the row is open. */
  readonly details?: ReactNode;
  /** Content under the summary that is always shown, e.g. a block's questions. */
  readonly body?: ReactNode;
  /** Flagged by validation: a red border. */
  readonly isInvalid?: boolean;
  /** Shown but not editable here (written through the API with something this editor can't edit yet). */
  readonly readOnlyLabel?: string;
  /** Show a chevron that follows `isOpen`, for rows whose toggle collapses content (blocks). */
  readonly showChevron?: boolean;
  readonly id?: string;
  readonly ariaLabel?: string;
}

export const FlowOutlineRow = ({
  tone,
  icon,
  children,
  onToggle,
  isOpen = false,
  details,
  body,
  isInvalid = false,
  readOnlyLabel,
  showChevron = false,
  id,
  ariaLabel,
}: FlowOutlineRowProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onToggle || event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  };

  const Chevron = isOpen ? ChevronDownIcon : ChevronRightIcon;

  return (
    <div className="flex items-start gap-1.5" id={id}>
      <CornerDownRightIcon className="mt-2.5 size-4 shrink-0 text-slate-300" aria-hidden="true" />
      <div
        className={cn(
          "min-w-0 flex-1 scroll-mt-20 rounded-lg border",
          TONE_CARD[tone],
          isInvalid && "border-red-400 ring-1 ring-red-400"
        )}>
        {/* A div, not a <button>: the summary holds badges that are buttons themselves (ENG-3632),
            and a button inside a button is invalid HTML. Keyboard handling is added below. */}
        {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role */}
        <div
          role={onToggle ? "button" : undefined}
          tabIndex={onToggle ? 0 : undefined}
          aria-expanded={onToggle ? isOpen : undefined}
          aria-label={ariaLabel}
          onClick={onToggle}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-lg px-3 py-2",
            onToggle &&
              "cursor-pointer hover:bg-white/60 focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden"
          )}>
          {showChevron && <Chevron className="size-4 shrink-0 text-slate-400" aria-hidden="true" />}
          <span
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-md text-white [&_svg]:size-4",
              TONE_ICON[tone]
            )}
            aria-hidden="true">
            {icon}
          </span>
          {children}
          {readOnlyLabel && (
            <span
              className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500"
              title={readOnlyLabel}>
              <LockIcon className="size-3" aria-hidden="true" />
              {readOnlyLabel}
            </span>
          )}
        </div>
        {body && <div className="px-3 pb-2">{body}</div>}
        {/* Rounded to the card's inner corner (its radius less its border) rather than clipped by the
            card: overflow-hidden would also cut the focus rings at the card's edges. */}
        {isOpen && details && (
          <div className="rounded-b-[calc(0.5rem-1px)] border-t border-slate-200 bg-white px-3 py-3">
            {details}
          </div>
        )}
      </div>
    </div>
  );
};
