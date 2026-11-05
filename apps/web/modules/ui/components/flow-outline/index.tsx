"use client";

import { ChevronDownIcon, ChevronRightIcon, LockIcon } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * FlowOutline (ENG-3749): a survey's whole flow on one spine, read top to bottom in the order a
 * respondent moves. Blocks are rows; what runs after a block sits indented under it; endings come
 * last. Presentational only — the Flow tab builds the rows from its outline model.
 *
 * Tones: white for a block and for an ending (its tile is pink, `ENDING_TONE`), and one colour per rule
 * type — blue for a jump, green for Set value (an Embedded Data step), violet for Require answer, orange
 * for Low quality.
 */

export type TFlowOutlineTone = "block" | "jump" | "setValue" | "requireAnswer" | "markLowQuality" | "ending";

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

/** A section label on the spine: "Before the first question", "Endings · 4". Blocks line up with it. */
export const FlowOutlineSectionLabel = ({ children }: { readonly children: ReactNode }) => (
  <p className="pt-1 pl-0.5 text-[11px] font-medium tracking-wide text-slate-400 uppercase">{children}</p>
);

/** A block and everything indented under it. */
export const FlowOutlineGroup = ({ children }: { readonly children: ReactNode }) => (
  <div className="space-y-2">{children}</div>
);

/**
 * The rows that run after a block, indented under it. No top padding: the group's own gap sits above
 * it, so "Add logic" is as far from its block as from the next one.
 */
export const FlowOutlineChildren = ({ children }: { readonly children: ReactNode }) => (
  <div className="ml-5 space-y-2 border-l-2 border-slate-200 pl-3">{children}</div>
);

/**
 * The last line under a block's rules: where everyone else goes (ENG-6969 T7). As tall as a rule row,
 * with a dashed neutral border, as it is not a rule of any type.
 */
export const FlowOutlineNote = ({
  icon,
  children,
}: {
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}) => (
  <div className="flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-slate-300 py-1.5 pr-1.5 pl-3 text-sm text-slate-600 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-slate-400">
    {icon}
    {children}
  </div>
);

/**
 * Every colour an ending shows in, on its own row and on a chip that jumps to it. Pink means "the
 * survey ends" without shouting (ENG-6969 T4, T14): the row is white like a block card and only its
 * tile is solid pink; a destination chip is an outline. Change an ending's colour here only.
 */
export const ENDING_TONE = {
  /** The row's outline and background: a block card's. */
  card: "border-slate-200 bg-white shadow-xs",
  /** The icon tile's background (the icon is white). */
  tile: "bg-pink-500",
  /** The line under an open row's header. */
  divider: "border-slate-200",
  /** The header's hover tint. */
  hover: "hover:bg-slate-50",
  /** The row's title. */
  title: "text-slate-900",
  /** Secondary text on the row, e.g. a redirect's URL. */
  detail: "text-slate-500",
  /** A jump-target chip that points to an ending: an outline with a pink border, icon and text. */
  pill: "border-pink-300 bg-white text-pink-700",
} as const;

/**
 * A rule type's one colour is its outline and its icon tile; a lighter tint of it is the row's
 * background, and a little more of that tint its header's hover.
 */
const TONE_CARD: Record<TFlowOutlineTone, string> = {
  block: "border-slate-200 bg-white shadow-xs",
  jump: "border-blue-500 bg-blue-50",
  setValue: "border-emerald-500 bg-emerald-50",
  requireAnswer: "border-violet-500 bg-violet-50",
  markLowQuality: "border-orange-500 bg-orange-50",
  ending: ENDING_TONE.card,
};

const TONE_ICON: Record<TFlowOutlineTone, string> = {
  block: "size-6 bg-slate-700",
  jump: "size-5 bg-blue-500",
  setValue: "size-5 bg-emerald-500",
  requireAnswer: "size-5 bg-violet-500",
  markLowQuality: "size-5 bg-orange-500",
  ending: `size-6 ${ENDING_TONE.tile}`,
};

/** The line between an open row's header and its settings: the card's own outline colour. */
const TONE_DIVIDER: Record<TFlowOutlineTone, string> = {
  block: "border-slate-200",
  jump: "border-blue-500",
  setValue: "border-emerald-500",
  requireAnswer: "border-violet-500",
  markLowQuality: "border-orange-500",
  ending: ENDING_TONE.divider,
};

/** The header's hover tint: a block card is white, so a white wash on it would not show. */
const TONE_HOVER: Record<TFlowOutlineTone, string> = {
  block: "hover:bg-slate-50",
  jump: "hover:bg-blue-100/70",
  setValue: "hover:bg-emerald-100/70",
  requireAnswer: "hover:bg-violet-100/70",
  markLowQuality: "hover:bg-orange-100/70",
  ending: ENDING_TONE.hover,
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
  /** Controls at the right of the header (move, duplicate, delete), as on a question card's header. */
  readonly actions?: ReactNode;
  /** Show a chevron that follows `isOpen`, for rows that open and close (blocks, rule rows). */
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
  actions,
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
  // With content under it, the header's tint keeps the card's top corners only.
  const hasContentBelow = Boolean(body) || (isOpen && Boolean(details));

  return (
    <div className="flex scroll-mt-20 items-start" id={id}>
      <div
        className={cn(
          "min-w-0 flex-1 rounded-lg border",
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
          // One line (ENG-6969 T2): the summary truncates, and the controls keep their slot on the right.
          className={cn(
            "group/row flex min-h-11 items-center gap-2 px-3 py-1.5",
            hasContentBelow ? "rounded-t-[calc(0.5rem-1px)]" : "rounded-[calc(0.5rem-1px)]",
            onToggle && [
              "cursor-pointer focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden",
              TONE_HOVER[tone],
            ]
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
          <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
          {(readOnlyLabel || actions) && (
            // Clicks and keys here act on the control, never open or close the row.
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            <div
              className="flex shrink-0 items-center gap-2"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}>
              {readOnlyLabel && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500" title={readOnlyLabel}>
                  <LockIcon className="size-3" aria-hidden="true" />
                  {readOnlyLabel}
                </span>
              )}
              {actions && <div className="flex items-center">{actions}</div>}
            </div>
          )}
        </div>
        {body && <div className="px-3 pb-2">{body}</div>}
        {/* Rounded to the card's inner corner (its radius less its border) rather than clipped by the
            card: overflow-hidden would also cut the focus rings at the card's edges. */}
        {isOpen && details && (
          <div
            className={cn(
              "rounded-b-[calc(0.5rem-1px)] border-t bg-white px-3 py-3",
              // The line under the header is the card's outline colour, red when the row is flagged.
              isInvalid ? "border-red-400" : TONE_DIVIDER[tone]
            )}>
            {details}
          </div>
        )}
      </div>
    </div>
  );
};
