import type { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TFormulaSegment } from "@/modules/survey/editor/lib/expression-formula";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

/**
 * References drawn as chips (ENG-6950, ENG-6969 T3): a question with its type icon and code, a hidden
 * field (URL parameter) or reserved field, an Embedded Data field, each in its own style, and a
 * reference to something deleted as a red chip, like broken recall.
 */
export type TReferenceChipKind = "question" | "hiddenField" | "field" | "reserved";

export interface TReferenceChip {
  kind: TReferenceChipKind;
  /** What the chip reads: a question's code, a field's name. */
  label: string;
  /** For a question: its type, for the icon. */
  elementType?: TSurveyElementTypeEnum;
  /** The survey no longer has it. */
  missing?: boolean;
}

/**
 * Words with references in them, in two forms: the parts a summary draws, references as chips, and
 * the plain text a tooltip, an `aria-label` and the tests read. A reference part carries both.
 */
export type TFlowTextPart =
  | { kind: "text"; text: string }
  | { kind: "reference"; chip: TReferenceChip; plain: string };

/** Parts as the plain sentence: each reference as its plain text (“code”, @field, field). */
export const toPlainText = (parts: TFlowTextPart[]): string =>
  parts.map((part) => (part.kind === "text" ? part.text : part.plain)).join("");

/** A stored operand's type as the chip kind it draws as. */
export const getReferenceChipKind = (operandType: string): TReferenceChipKind => {
  switch (operandType) {
    case "element":
      return "question";
    case "hiddenField":
      return "hiddenField";
    case "variable":
      return "field";
    default:
      return "reserved";
  }
};

/** A reference in the formula text as its chip; one nothing answers to is missing. */
export const getFormulaSegmentChip = (
  segment: Extract<TFormulaSegment, { kind: "reference" }>,
  survey: TSurvey
): TReferenceChip => {
  const leaf = segment.reference?.leaf;
  if (!leaf) return { kind: "question", label: segment.token, missing: true };
  const kind = getReferenceChipKind(leaf.type);
  const elementType =
    kind === "question"
      ? getElementsFromBlocks(survey.blocks).find((element) => element.id === leaf.value)?.type
      : undefined;
  return { kind, label: segment.token, ...(elementType ? { elementType } : {}) };
};
