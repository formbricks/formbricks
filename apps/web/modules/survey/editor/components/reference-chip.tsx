"use client";

import { type JSX, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { cn } from "@/lib/cn";
import type {
  TFlowTextPart,
  TReferenceChip,
  TReferenceChipKind,
} from "@/modules/survey/editor/lib/reference-chips";
import { getElementIconMap } from "@/modules/survey/lib/elements";

/**
 * Each reference's colours (ENG-6969 T3), on the recall pill's slate: a question slate, a hidden field
 * (URL parameter) or survey info outlined, an Embedded Data field green, and a deleted one red, like
 * broken recall.
 */
export const REFERENCE_CHIP_TONE: Record<TReferenceChipKind | "missing", string> = {
  question: "border-slate-200 bg-slate-100 text-slate-700",
  hiddenField: "border-slate-300 bg-white text-slate-700",
  reserved: "border-slate-300 bg-white text-slate-700",
  field: "border-emerald-200 bg-emerald-50 text-emerald-700",
  missing: "border-red-200 bg-red-50 text-red-700",
};

/**
 * The same tones drawn behind the formula box's text (ENG-6950): a background and a ring, which take
 * no room, so each chip sits exactly under the characters of its reference.
 */
export const REFERENCE_HIGHLIGHT_TONE: Record<TReferenceChipKind | "missing", string> = {
  question: "bg-slate-100 ring-slate-300",
  hiddenField: "bg-white ring-slate-300",
  reserved: "bg-white ring-slate-300",
  field: "bg-emerald-50 ring-emerald-200",
  missing: "bg-red-50 ring-red-300",
};

export const getReferenceTone = (chip: Pick<TReferenceChip, "kind" | "missing">) =>
  chip.missing ? "missing" : chip.kind;

interface ReferenceChipProps {
  readonly chip: TReferenceChip;
  readonly elementIcons: Record<TSurveyElementTypeEnum, JSX.Element>;
}

/** One reference as a chip: a question with its type icon and code, a field by its name. */
export const ReferenceChip = ({ chip, elementIcons }: ReferenceChipProps) => (
  <span
    className={cn(
      "inline-flex max-w-full items-center gap-1 rounded-[5px] border px-1.5 align-[1px] text-xs leading-[18px] font-medium whitespace-nowrap",
      REFERENCE_CHIP_TONE[getReferenceTone(chip)]
    )}>
    {chip.kind === "question" && chip.elementType && !chip.missing && (
      <span className="shrink-0 [&>svg]:size-3" aria-hidden="true">
        {elementIcons[chip.elementType]}
      </span>
    )}
    <span className="truncate">{chip.label}</span>
  </span>
);

/** The question type icons chips draw, for a component with no icon map at hand. */
export const useElementIcons = (): Record<TSurveyElementTypeEnum, JSX.Element> => {
  const { t } = useTranslation();
  return useMemo(() => getElementIconMap(t), [t]);
};

interface FlowTextPartsProps {
  readonly parts: TFlowTextPart[];
  readonly elementIcons: Record<TSurveyElementTypeEnum, JSX.Element>;
  /**
   * Inside a flex row (a show-if chip): words and chips are centred on one line, the words cut off
   * last. The row's `gap` stands in for the spaces around a chip, which flex drops.
   */
  readonly centered?: boolean;
}

/**
 * Keys for a summary's parts, from what they say: the same word or reference can appear twice, so a
 * repeat gets its occurrence number ("ref:score:1").
 */
const getPartKeys = (parts: TFlowTextPart[]): string[] => {
  const seen = new Map<string, number>();
  return parts.map((part) => {
    const content = part.kind === "text" ? `text:${part.text}` : `ref:${part.plain}`;
    const occurrence = seen.get(content) ?? 0;
    seen.set(content, occurrence + 1);
    return `${content}:${occurrence}`;
  });
};

/** A summary's parts: its words as text, its references as chips. */
/** Adjacent words as one piece, so a flex row puts its gap only around chips. */
const mergeTextParts = (parts: TFlowTextPart[]): TFlowTextPart[] =>
  parts.reduce<TFlowTextPart[]>((merged, part) => {
    const last = merged.at(-1);
    if (part.kind === "text" && last?.kind === "text") {
      return [...merged.slice(0, -1), { kind: "text", text: last.text + part.text }];
    }
    return [...merged, part];
  }, []);

export const FlowTextParts = ({ parts: rawParts, elementIcons, centered = false }: FlowTextPartsProps) => {
  const parts = centered ? mergeTextParts(rawParts) : rawParts;
  const keys = getPartKeys(parts);
  return parts.map((part, idx) =>
    part.kind === "text" ? (
      <span key={keys[idx]} className={centered ? "min-w-0 truncate" : undefined}>
        {centered ? part.text.trim() : part.text}
      </span>
    ) : (
      <ReferenceChip key={keys[idx]} chip={part.chip} elementIcons={elementIcons} />
    )
  );
};
