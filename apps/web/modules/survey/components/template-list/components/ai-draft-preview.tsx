"use client";

import type React from "react";
import { type ReactNode, memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { cn } from "@/lib/cn";
import {
  type TAiDraftQuestion,
  type TAiDraftState,
  groupAiDraftByBlock,
} from "@/modules/survey/components/template-list/lib/ai-draft-reducer";
import { getElementIconMap, getElementNameMap } from "@/modules/survey/lib/elements";
import { AiActivityBar } from "@/modules/ui/components/ai";
import { Skeleton } from "@/modules/ui/components/skeleton";

/** How close to the bottom still counts as "following along", in px. */
const PIN_THRESHOLD_PX = 32;
const PENDING_ROW_COUNT = 3;
/** Above this many rows the list is windowed: only the rows near the viewport are mounted (edge case #75). */
export const DRAFT_PREVIEW_VIRTUALIZE_THRESHOLD = 50;
/** Every row has the same height by construction (truncate, never wrap), which is what makes windowing cheap. */
const ROW_HEIGHT_PX = 60;
const OVERSCAN_ROWS = 8;
const CHOICE_ELEMENT_TYPES = new Set(["multipleChoiceSingle", "multipleChoiceMulti", "ranking", "matrix"]);

type AiDraftRowProps = {
  question: TAiDraftQuestion;
  icon?: ReactNode;
  typeName?: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  /** Set by the windowed list, which positions each row absolutely inside a fixed-height track. */
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Memoised, and the reducer guarantees an unchanged question keeps its object identity — together
 * that is what stops every row re-rendering on each snapshot.
 */
const AiDraftRow = memo(({ question, icon, typeName, t, className, style }: Readonly<AiDraftRowProps>) => {
  const showsOptionCount = question.type ? CHOICE_ELEMENT_TYPES.has(question.type) : false;
  const optionCount =
    showsOptionCount && question.choiceCount
      ? t("workspace.surveys.ai_create.option_count", { count: question.choiceCount })
      : undefined;
  // Import drafts carry several languages per row; a prompt draft carries none, so nothing renders.
  const languageBadge =
    question.languages && question.languages.length > 1
      ? question.languages.map((code) => code.split("-")[0].toUpperCase()).join(" · ")
      : undefined;

  return (
    <li
      className={cn("flex animate-fadeIn items-start gap-3 px-4 py-3", className)}
      style={{ minHeight: ROW_HEIGHT_PX, ...style }}>
      <span className="mt-0.5 flex shrink-0 items-center text-slate-600">{icon}</span>
      <div className="min-w-0 flex-1">
        {question.headline ? (
          // Semibold, primary ink: the question is the content, so it has to outweigh everything
          // else in the row. truncate, never wrap — a headline growing character by character
          // extends rightwards and clips, so the row height is fixed from the moment it mounts.
          <h3 className="truncate text-sm font-semibold text-slate-800">{question.headline}</h3>
        ) : (
          // Same height as the text it becomes, and no fade on the swap — a transition on every
          // keystroke-sized update is exactly what reads as flicker.
          <Skeleton className="my-1 h-3.5 w-48 rounded-md" />
        )}
        {/*
          Muted plain text rather than a pill: a chip carries a border and a fill, which made the
          metadata louder than the question it describes. The weight gap against the semibold
          headline is what stops this reading as an answer to it. Matches the row the survey editor
          already uses for the same job, down to the token.
        */}
        <p className="mt-1 truncate text-xs text-slate-500">
          {typeName ?? "\u00a0"}
          {optionCount ? ` · ${optionCount}` : ""}
        </p>
      </div>
      {languageBadge ? (
        <span className="mt-0.5 shrink-0 rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-600 tabular-nums">
          {languageBadge}
        </span>
      ) : null}
    </li>
  );
});

AiDraftRow.displayName = "AiDraftRow";

type AiDraftPreviewProps = {
  draft: TAiDraftState;
  isGenerating: boolean;
  className?: string;
  /** The scroll container, exposed so a finished generation can land focus where scrolling works. */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
};

export const AiDraftPreview = ({
  draft,
  isGenerating,
  className,
  scrollContainerRef,
}: Readonly<AiDraftPreviewProps>) => {
  const { t } = useTranslation();
  // The same glyphs and labels the editor uses two seconds later, so the draft reads as the product
  // rather than as a bespoke preview.
  const iconMap = useMemo(() => getElementIconMap(t), [t]);
  const nameMap = useMemo(() => getElementNameMap(t), [t]);

  const blocks = useMemo(() => groupAiDraftByBlock(draft.questions), [draft.questions]);
  const showsBlockNames = blocks.length > 1;

  const scrollRef = useRef<HTMLElement>(null);
  const isPinnedRef = useRef(true);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const isVirtualized = draft.questions.length > DRAFT_PREVIEW_VIRTUALIZE_THRESHOLD;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !isVirtualized) return;
    const update = () => setViewportHeight(element.clientHeight);
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [isVirtualized]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !isPinnedRef.current) return;

    // The CSS reduced-motion kill-switch cannot reach a JS scroll option, so check it here.
    const prefersReducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ top: element.scrollHeight, behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [draft.questions.length]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;

    isPinnedRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < PIN_THRESHOLD_PX;
    if (isVirtualized) setScrollTop(element.scrollTop);
  };

  // Plain windowing for long imports: the rows are equal-height, so the visible slice is arithmetic.
  // Block headers are dropped in this mode; a 150-question review is a list to scan, not to navigate.
  const rowWindow = useMemo(() => {
    if (!isVirtualized) return null;
    const total = draft.questions.length;
    const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - OVERSCAN_ROWS);
    const visibleCount = Math.ceil((viewportHeight || ROW_HEIGHT_PX * 8) / ROW_HEIGHT_PX) + OVERSCAN_ROWS * 2;
    const last = Math.min(total, first + visibleCount);
    return { first, last, total };
  }, [draft.questions.length, isVirtualized, scrollTop, viewportHeight]);

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white",
        className
      )}>
      {isGenerating ? <AiActivityBar /> : null}

      <div className="shrink-0 border-b border-slate-100 px-4 py-3">
        {draft.name ? (
          <p className="truncate text-sm font-semibold text-slate-800">{draft.name}</p>
        ) : (
          <Skeleton className="my-0.5 h-4 w-56 rounded-md" />
        )}
      </div>

      {/*
        The focus target is the scroll container itself, not the card around it: a tabIndex on a
        non-scrolling ancestor gives a keyboard user a tab stop that cannot scroll anything (WCAG
        2.1.1 — only Firefox makes overflow containers focusable on its own). One stop, on the
        element that moves, which is also where the finished generation lands focus.
      */}
      <section
        ref={(node) => {
          scrollRef.current = node;
          if (scrollContainerRef) scrollContainerRef.current = node;
        }}
        onScroll={handleScroll}
        // A scroll container that cannot take focus cannot be scrolled from the keyboard, which is
        // the WCAG 2.1.1 failure this exists to fix — so the tabIndex stays on a non-interactive
        // element on purpose. `<section>` with an accessible name is a region natively, which is why
        // there is no `role` here.
        tabIndex={0} // NOSONAR
        aria-label={t("workspace.surveys.ai_create.draft_survey")}
        aria-busy={isGenerating}
        className="focus-visible:ring-ring min-h-0 flex-1 overflow-y-auto focus-visible:ring-1 focus-visible:outline-hidden">
        {rowWindow ? (
          <ul
            className="relative"
            style={{ height: rowWindow.total * ROW_HEIGHT_PX }}
            aria-rowcount={rowWindow.total}>
            {draft.questions.slice(rowWindow.first, rowWindow.last).map((question, index) => (
              <AiDraftRow
                key={question.key}
                question={question}
                icon={iconMap[question.type as TSurveyElementTypeEnum]}
                typeName={nameMap[question.type as TSurveyElementTypeEnum]}
                t={t}
                className="absolute inset-x-0 border-b border-slate-100"
                style={{ top: (rowWindow.first + index) * ROW_HEIGHT_PX, height: ROW_HEIGHT_PX }}
              />
            ))}
          </ul>
        ) : null}
        {!rowWindow &&
          blocks.map((block) => (
            <section key={block.key} className="-mt-px first:mt-0">
              {/*
              The model is asked to name every block, so show that structure rather than flattening
              it into one list — but only when there is more than one, since a lone header over the
              whole draft is chrome that says nothing.

              Sticky so the section you are reading stays named while you scroll through it. The
              band is opaque, so rows pass cleanly behind it rather than showing through.
            */}
              {showsBlockNames && (
                <h4 className="sticky top-0 z-10 border-y border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-medium text-slate-500">
                  {block.name ?? (
                    <Skeleton className="my-0.5 inline-block h-3 w-24 rounded-md align-middle" />
                  )}
                </h4>
              )}
              <ul className="divide-y divide-slate-100">
                {block.questions.map((question) => (
                  <AiDraftRow
                    key={question.key}
                    question={question}
                    icon={iconMap[question.type as TSurveyElementTypeEnum]}
                    typeName={nameMap[question.type as TSurveyElementTypeEnum]}
                    t={t}
                  />
                ))}
              </ul>
            </section>
          ))}

        {isGenerating ? (
          <ul className="divide-y divide-slate-100">
            {Array.from({ length: PENDING_ROW_COUNT }, (_, index) => (
              <li key={`pending-${index}`} className="flex items-start gap-3 px-4 py-3">
                <Skeleton className="mt-0.5 size-4 shrink-0 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-44 rounded-md" />
                  <Skeleton className="h-2.5 w-16 rounded-md" />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
};
