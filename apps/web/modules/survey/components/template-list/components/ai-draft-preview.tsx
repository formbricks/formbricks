"use client";

import { type ReactNode, memo, useEffect, useMemo, useRef } from "react";
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
import { Badge } from "@/modules/ui/components/badge";
import { Skeleton } from "@/modules/ui/components/skeleton";

/** How close to the bottom still counts as "following along", in px. */
const PIN_THRESHOLD_PX = 32;
const PENDING_ROW_COUNT = 3;
const CHOICE_ELEMENT_TYPES = new Set(["multipleChoiceSingle", "multipleChoiceMulti", "ranking", "matrix"]);

type AiDraftRowProps = {
  question: TAiDraftQuestion;
  icon?: ReactNode;
  typeName?: string;
  t: (key: string, options?: Record<string, unknown>) => string;
};

/**
 * Memoised, and the reducer guarantees an unchanged question keeps its object identity — together
 * that is what stops every row re-rendering on each snapshot.
 */
const AiDraftRow = memo(({ question, icon, typeName, t }: Readonly<AiDraftRowProps>) => {
  const showsOptionCount = question.type ? CHOICE_ELEMENT_TYPES.has(question.type) : false;
  const optionCount =
    showsOptionCount && question.choiceCount
      ? t("workspace.surveys.ai_create.option_count", { count: question.choiceCount })
      : undefined;

  return (
    <li className="flex animate-fadeIn items-start gap-3 px-4 py-2.5">
      <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>
      <div className="min-w-0 flex-1">
        {question.headline ? (
          // truncate, never wrap: a headline growing character by character extends rightwards and
          // clips, so the row height is fixed from the moment it mounts and nothing below it moves.
          <p className="truncate text-sm text-slate-700">{question.headline}</p>
        ) : (
          // Same height as the text it becomes, and no fade on the swap — a transition on every
          // keystroke-sized update is exactly what reads as flicker.
          <Skeleton className="my-1 h-3 w-48 rounded-md" />
        )}
        {/*
          The type in words, because a 16px glyph alone does not tell an open text from a rating. A
          pill rather than a line of text: set below the headline as plain prose it reads like an
          answer to the question. The row always reserves the line — the type is the first field the
          model writes — so the option count fills in later without anything jumping.
        */}
        <div className="mt-1 flex h-5 items-center">
          {typeName ? (
            <Badge
              type="gray"
              size="tiny"
              className="font-normal"
              text={optionCount ? `${typeName} · ${optionCount}` : typeName}
            />
          ) : null}
        </div>
      </div>
    </li>
  );
});

AiDraftRow.displayName = "AiDraftRow";

type AiDraftPreviewProps = {
  draft: TAiDraftState;
  isGenerating: boolean;
  className?: string;
};

export const AiDraftPreview = ({ draft, isGenerating, className }: Readonly<AiDraftPreviewProps>) => {
  const { t } = useTranslation();
  // The same glyphs and labels the editor uses two seconds later, so the draft reads as the product
  // rather than as a bespoke preview.
  const iconMap = useMemo(() => getElementIconMap(t), [t]);
  const nameMap = useMemo(() => getElementNameMap(t), [t]);

  const blocks = useMemo(() => groupAiDraftByBlock(draft.questions), [draft.questions]);
  const showsBlockNames = blocks.length > 1;

  const scrollRef = useRef<HTMLDivElement>(null);
  const isPinnedRef = useRef(true);

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
  };

  return (
    <div
      // tabIndex makes the scroll region keyboard-operable (WCAG 2.1.1 — only Firefox does this for
      // overflow containers by default) and gives the completed generation somewhere to land focus.
      tabIndex={0}
      role="group"
      aria-label={t("workspace.surveys.ai_create.draft_survey")}
      aria-busy={isGenerating}
      className={cn(
        "focus-visible:ring-ring relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white focus-visible:ring-1 focus-visible:outline-hidden",
        className
      )}>
      {isGenerating ? <AiActivityBar /> : null}

      <div className="shrink-0 border-b border-slate-100 px-4 py-3">
        {draft.name ? (
          <p className="truncate text-sm font-medium text-slate-800">{draft.name}</p>
        ) : (
          <Skeleton className="my-0.5 h-4 w-56 rounded-md" />
        )}
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto">
        {blocks.map((block) => (
          <section key={block.key}>
            {/*
              The model is asked to name every block, so show that structure rather than flattening
              it into one list — but only when there is more than one, since a lone header over the
              whole draft is chrome that says nothing.
            */}
            {showsBlockNames && (
              <h4 className="sticky top-0 z-10 bg-slate-50/95 px-4 py-1.5 text-xs font-medium text-slate-500">
                {block.name ?? <Skeleton className="my-0.5 inline-block h-3 w-24 rounded-md align-middle" />}
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
              <li key={`pending-${index}`} className="flex items-start gap-3 px-4 py-2.5">
                <Skeleton className="mt-0.5 size-4 shrink-0 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-40 rounded-md" />
                  <Skeleton className="h-2 w-16 rounded-md" />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
};
