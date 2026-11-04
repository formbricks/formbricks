"use client";

import { type ReactNode, createContext, useContext, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TConditionGroup, TSurveyLogicConditionsOperator } from "@formbricks/types/surveys/logic";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { LogicEditorConditions } from "@/modules/survey/editor/components/logic-editor-conditions";
import { type TShowIfTarget, getShowIfScope } from "@/modules/survey/editor/lib/show-if-editing";
import { getDefaultOperatorForElement } from "@/modules/survey/editor/lib/utils";
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

interface ShowIfPopoverFrameProps {
  readonly title: string;
  readonly help: string;
  /** The longer explanation, behind an (i) next to the title, and that (i)'s accessible name. */
  readonly info?: { readonly label: string; readonly content: ReactNode };
  /** Scrolls when the content is taller than the space left. */
  readonly children: ReactNode;
  /** Pinned below the scrolling content, so Done is always in reach. */
  readonly footer: ReactNode;
}

/**
 * The popover itself: as wide as the editor column allows (44rem at most) and as tall as the space
 * below or above the badge, with the content scrolling between a fixed heading and a fixed footer.
 */
export function ShowIfPopoverFrame({ title, help, info, children, footer }: ShowIfPopoverFrameProps) {
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
      className="flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-[min(44rem,var(--radix-popover-content-available-width))] flex-col p-0 outline-none"
      // The popover sits inside the block row in the React tree: keep its clicks off the row.
      onClick={(event) => event.stopPropagation()}
      // Opened from the Add logic menu, which hands focus back to its button as it closes; that must
      // not close the popover it just opened. Escape, a click outside and Done still close it.
      onFocusOutside={(event) => event.preventDefault()}>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {/* To the right, level with the title: above or below it would cover the heading. */}
          {info && (
            <InfoTooltip label={info.label} side="right" align="start">
              {info.content}
            </InfoTooltip>
          )}
        </div>
        <p className="text-xs text-slate-500">{help}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-1">{children}</div>
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
    <div className="overflow-x-auto pb-1 text-sm">
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
