"use client";

import { type ReactNode, memo, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { cn } from "@/lib/cn";
import type {
  TAiDraftQuestion,
  TAiDraftState,
} from "@/modules/survey/components/template-list/lib/ai-draft-reducer";
import { getElementIconMap, getElementNameMap } from "@/modules/survey/lib/elements";
import { AiActivityBar } from "@/modules/ui/components/ai";
import { Skeleton } from "@/modules/ui/components/skeleton";

/** How close to the bottom still counts as "following along", in px. */
const PIN_THRESHOLD_PX = 32;
const PENDING_ROW_COUNT = 3;
const CHOICE_ELEMENT_TYPES = new Set(["multipleChoiceSingle", "multipleChoiceMulti", "ranking", "matrix"]);

type AiDraftRowProps = {
  question: TAiDraftQuestion;
  icon?: ReactNode;
  typeName?: string;
};

/**
 * Memoised, and the reducer guarantees an unchanged question keeps its object identity — together
 * that is what stops every row re-rendering on each snapshot.
 */
const AiDraftRow = memo(({ question, icon, typeName }: Readonly<AiDraftRowProps>) => {
  const showsOptionCount = question.type ? CHOICE_ELEMENT_TYPES.has(question.type) : false;

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
        {/* Reserved as soon as the type lands, filled when the choices do, so it never jumps. */}
        {showsOptionCount ? (
          <p className="mt-0.5 text-xs text-slate-400">
            {question.choiceCount ? `${question.choiceCount} options` : " "}
          </p>
        ) : null}
      </div>
      {typeName ? <span className="sr-only">{typeName}</span> : null}
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
        "focus-visible:ring-ring relative overflow-hidden rounded-lg border border-slate-200 bg-white focus-visible:ring-1 focus-visible:outline-hidden",
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
        <ul className="divide-y divide-slate-100">
          {draft.questions.map((question) => (
            <AiDraftRow
              key={question.key}
              question={question}
              icon={iconMap[question.type as TSurveyElementTypeEnum]}
              typeName={nameMap[question.type as TSurveyElementTypeEnum]}
            />
          ))}

          {isGenerating
            ? Array.from({ length: PENDING_ROW_COUNT }, (_, index) => (
                <li key={`pending-${index}`} className="flex items-start gap-3 px-4 py-2.5">
                  <Skeleton className="mt-0.5 size-4 shrink-0 rounded-md" />
                  <Skeleton className="my-1 h-3 w-40 rounded-md" />
                </li>
              ))
            : null}
        </ul>
      </div>
    </div>
  );
};
