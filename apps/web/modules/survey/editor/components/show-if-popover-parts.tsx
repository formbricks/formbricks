"use client";

import { PlusIcon } from "lucide-react";
import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { TConditionGroup, TSurveyLogicConditionsOperator } from "@formbricks/types/surveys/logic";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { LogicEditorConditions } from "@/modules/survey/editor/components/logic-editor-conditions";
import { type TShowIfTarget, getShowIfScope } from "@/modules/survey/editor/lib/show-if-editing";
import { getDefaultOperatorForElement } from "@/modules/survey/editor/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { InfoTooltip } from "@/modules/ui/components/info-tooltip";
import { PopoverContent } from "@/modules/ui/components/popover";

/**
 * What the Flow tab's two show-if popovers share (ENG-6931, ENG-6937): where they may open, their
 * frame, and the conditions editor scoped to what the target may reference.
 */

/**
 * The element the popovers stay inside: the editor column, so they never spill over the preview. The
 * Flow tab provides it; without it they fall back to the viewport.
 */
export const ShowIfPopoverBoundary = createContext<Element | null>(null);

/**
 * Marks the row a show-if popover lines up with and spans: a Questions-tab show-if section, a Flow-tab
 * question row or block header. The popover opens under the whole row, left-aligned with it, on both
 * tabs; without a marked row it opens under its trigger.
 */
export const SHOW_IF_ANCHOR_PROPS = { "data-show-if-anchor": "" } as const;

/**
 * A ref callback for the trigger, and the row it sits in (its nearest `SHOW_IF_ANCHOR_PROPS` element,
 * else the trigger itself) as the popover's anchor: pass `anchorRef` to `PopoverAnchor`'s `virtualRef`.
 */
export const useShowIfAnchor = () => {
  const [anchor, setAnchor] = useState<Element | null>(null);
  const triggerRef = useCallback((trigger: HTMLElement | null) => {
    setAnchor(trigger ? (trigger.closest("[data-show-if-anchor]") ?? trigger) : null);
  }, []);
  const anchorRef = useMemo(() => ({ current: anchor }), [anchor]);
  return { triggerRef, anchorRef, hasAnchor: anchor !== null };
};

const SHOW_IF_CELL_BASE =
  "inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-md border px-2 text-xs whitespace-nowrap focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden [&_svg]:size-3 [&_svg]:shrink-0";

/**
 * The box of every show-if cell on a block card (ENG-6969 T10), set or empty, so their left edges line
 * up: a set condition, a faint "Add condition", or a set condition the Flow tab can only show.
 */
export const SHOW_IF_CELL_CLASS = {
  set: cn(SHOW_IF_CELL_BASE, "border-slate-200 bg-slate-100 text-slate-700 hover:border-slate-300"),
  add: cn(SHOW_IF_CELL_BASE, "border-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-700"),
  readOnly: cn(SHOW_IF_CELL_BASE, "cursor-default border-slate-200 bg-slate-100 text-slate-500"),
} as const;

/** A faint "Add condition" in an empty show-if cell; also the trigger of the popover it opens. */
export const AddConditionCell = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<"button">>(
  function AddConditionCell({ className, onClick, ...props }, ref) {
    const { t } = useTranslation();
    return (
      <button
        ref={ref}
        type="button"
        className={cn(SHOW_IF_CELL_CLASS.add, className)}
        {...props}
        onClick={(event) => {
          // The block card toggles on click: adding a condition must not collapse it.
          event.stopPropagation();
          onClick?.(event);
        }}>
        <PlusIcon aria-hidden="true" />
        {t("workspace.surveys.edit.flow.add_show_if_condition")}
      </button>
    );
  }
);

/**
 * "Add condition" as the Questions tab's other secondary buttons ("Add description"): its show-if sits
 * under a section heading there, not in a table cell. Also the trigger of the popover it opens.
 */
export const AddConditionButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof Button>>(
  function AddConditionButton({ onClick, ...props }, ref) {
    const { t } = useTranslation();
    return (
      <Button
        ref={ref}
        type="button"
        size="sm"
        variant="secondary"
        {...props}
        onClick={(event) => {
          // The block card toggles on click: adding a condition must not collapse it.
          event.stopPropagation();
          onClick?.(event);
        }}>
        <PlusIcon className="mr-1 size-4" aria-hidden="true" />
        {t("workspace.surveys.edit.flow.add_show_if_condition")}
      </Button>
    );
  }
);

interface ShowIfPopoverFrameProps {
  readonly title: string;
  readonly help: string;
  /**
   * The heading is already on the page right above the trigger (a Questions-tab section): the popover
   * leaves out its title and help, and keeps the title as its accessible name.
   */
  readonly hideHeading?: boolean;
  /** The longer explanation, behind an (i) next to the title, and that (i)'s accessible name. */
  readonly info?: { readonly label: string; readonly content: ReactNode };
  /** Scrolls when the content is taller than the space left. */
  readonly children: ReactNode;
  /** Pinned below the scrolling content, so Done is always in reach. */
  readonly footer: ReactNode;
}

/**
 * The popover itself: as wide as the row it opens under (`useShowIfAnchor`), at least 24rem, never
 * wider than the editor column, and as tall as the space below or above it, with the content scrolling
 * between a fixed heading and a fixed footer.
 */
export function ShowIfPopoverFrame({
  title,
  help,
  hideHeading = false,
  info,
  children,
  footer,
}: ShowIfPopoverFrameProps) {
  const boundary = useContext(ShowIfPopoverBoundary);
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <PopoverContent
      ref={contentRef}
      tabIndex={-1}
      // Focus the popover itself, not its first control: that is the heading's (i), whose tooltip would
      // open on its own and cover the subtitle and the first rows.
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        contentRef.current?.focus();
      }}
      align="start"
      collisionBoundary={boundary ?? undefined}
      collisionPadding={8}
      aria-label={hideHeading ? title : undefined}
      className="flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-[min(max(24rem,var(--radix-popover-trigger-width)),var(--radix-popover-content-available-width))] flex-col p-0 outline-none"
      // The popover sits inside the block row in the React tree: keep its clicks off the row.
      onClick={(event) => event.stopPropagation()}
      // Opened from the Add logic menu, which hands focus back to its button as it closes; that must
      // not close the popover it just opened. Escape, a click outside and Done still close it.
      onFocusOutside={(event) => event.preventDefault()}>
      {!hideHeading && (
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            {/* To the right, level with the title: above or below it would cover the heading. */}
            {info && (
              <InfoTooltip label={info.label} side="right" align="start" collisionBoundary={boundary}>
                {info.content}
              </InfoTooltip>
            )}
          </div>
          <p className="text-xs text-slate-500">{help}</p>
        </div>
      )}
      <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-1", hideHeading && "pt-3")}>{children}</div>
      <div className="border-t border-slate-100 px-4 py-3">{footer}</div>
    </PopoverContent>
  );
}

/**
 * The scoped survey a target's conditions may reference (`getShowIfScope`), with recalled headlines
 * read as plain text as in the rule editor, and the operator a new condition starts with.
 */
export const useShowIfScope = (localSurvey: TSurvey, target: TShowIfTarget) => {
  const { t } = useTranslation();
  const { blockIdx } = target;
  const elementIdx = target.type === "block" ? undefined : target.elementIdx;
  const scope = useMemo(() => {
    const scopeTarget: TShowIfTarget =
      elementIdx === undefined ? { type: "block", blockIdx } : { type: "element", blockIdx, elementIdx };
    const scoped = getShowIfScope(localSurvey, scopeTarget);
    return { ...scoped, survey: replaceHeadlineRecall(scoped.survey, "default") };
  }, [localSurvey, blockIdx, elementIdx]);

  const nearest = scope.survey.blocks.flatMap((block) => block.elements).at(-1);
  const getDefaultOperator = (): TSurveyLogicConditionsOperator =>
    nearest ? getDefaultOperatorForElement(nearest, t) : "isSet";

  return { scope, getDefaultOperator };
};

interface ShowIfConditionsEditorProps {
  readonly conditions: TConditionGroup;
  readonly scope: ReturnType<typeof useShowIfScope>["scope"];
  readonly getDefaultOperator: () => TSurveyLogicConditionsOperator;
  readonly onConditionsChange: (updater: (conditions: TConditionGroup) => TConditionGroup) => void;
}

/** The logic editor's conditions editor, on the scoped survey. */
export function ShowIfConditionsEditor({
  conditions,
  scope,
  getDefaultOperator,
  onConditionsChange,
}: ShowIfConditionsEditorProps) {
  return (
    // "If" sits at the popover's left edge (review of ENG-6969): the rule editor's right-aligned label
    // column lines "If" up with "Then", which a show-if doesn't have.
    <div className="overflow-x-auto pb-1 text-sm [&_[data-sentence-lead]]:justify-start [&_[data-sentence-row]]:grid-cols-[3.75rem_minmax(0,1fr)_3.75rem]">
      <LogicEditorConditions
        conditions={conditions}
        localSurvey={scope.survey}
        scopeBlockIdx={scope.blockIdx}
        getDefaultOperator={getDefaultOperator}
        onConditionsChange={onConditionsChange}
      />
    </div>
  );
}
