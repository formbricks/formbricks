import type { TFunction } from "i18next";
import type { TWorkflowCondition, TWorkflowConditionGroup } from "@formbricks/workflows";
import type { TChoiceLabels } from "@/modules/ee/workflows/lib/choice-conditions";
import { describeIfElseCondition } from "@/modules/ee/workflows/lib/if-else-summary";
import { getVariableDisplayName } from "@/modules/ee/workflows/lib/variable-name";
import type { TFlowTextPart, TReferenceChip } from "@/modules/survey/editor/lib/reference-chips";

/**
 * Canvas summaries as sentences with chips, the way the survey flow editor draws its rules
 * (FlowTextParts): a Variable reads as a chip with its icon and name, the words around it as text.
 * The sentence comes from the same translated template as the plain summary, so word order stays
 * right in every language; only the Variable's slot is cut out and replaced by its chip.
 */

/** What each Variable path draws as: a survey question with its type icon, a field, or a plain chip. */
export type TVariableRefs = ReadonlyMap<string, TReferenceChip>;

// Stand-ins the template fills in, then split on. Private-use characters can't appear in a name.
const SLOT = "";
const slotFor = (index: number) => `${SLOT}${index}${SLOT}`;

const RESPONSE_PREFIX = "response.";

/**
 * A path's chip. Once the survey is known (refs has entries), a survey answer it no longer has reads
 * as a red missing chip with its id, as the survey flow editor draws a deleted question.
 */
const chipFor = (path: string, refs: TVariableRefs | undefined): TReferenceChip => {
  const known = refs?.get(path);
  if (known) return known;
  if (refs && refs.size > 0 && path.startsWith(RESPONSE_PREFIX)) {
    return { kind: "question", label: path.slice(RESPONSE_PREFIX.length), missing: true };
  }
  return { kind: "reserved", label: getVariableDisplayName(path) };
};

/** Splits a sentence rendered with slots back into words and the chips that fill the slots. */
const toParts = (sentence: string, chips: TReferenceChip[]): TFlowTextPart[] =>
  sentence
    .split(SLOT)
    .map((piece, index): TFlowTextPart | null => {
      if (index % 2 === 0) return piece ? { kind: "text", text: piece } : null;
      const chip = chips[Number(piece)];
      return chip ? { kind: "reference", chip, plain: chip.label } : null;
    })
    .filter((part): part is TFlowTextPart => part !== null);

const firstCondition = (group: TWorkflowConditionGroup): TWorkflowCondition | undefined => {
  for (const item of group.conditions) {
    if ("conditions" in item) {
      const nested = firstCondition(item);
      if (nested) return nested;
    } else {
      return item;
    }
  }
  return undefined;
};

/**
 * An If/else card's summary as parts: its first condition with the Variable (and a Variable value) as
 * chips, e.g. [Which plan?] includes all of gold. Null when the plain summary would be null.
 */
export const describeIfElseConditionParts = (
  group: TWorkflowConditionGroup,
  t: TFunction,
  refs?: TVariableRefs,
  choiceLabels?: TChoiceLabels
): TFlowTextPart[] | null => {
  const first = firstCondition(group);
  if (!first) return null;
  const chips: TReferenceChip[] = [chipFor(first.left.path, refs)];
  const slotLabels = new Map([[first.left.path, slotFor(0)]]);
  const right = first.right;
  if (right !== null && typeof right === "object" && !Array.isArray(right) && "path" in right) {
    chips.push(chipFor(right.path, refs));
    slotLabels.set(right.path, slotFor(1));
  }
  const sentence = describeIfElseCondition(group, t, slotLabels, choiceLabels);
  return sentence === null ? null : toParts(sentence, chips);
};

/** A Switch card's summary as parts: the compared Variable as a chip, then the case count. */
export const describeSwitchParts = (
  path: string,
  caseCount: number,
  t: TFunction,
  refs?: TVariableRefs
): TFlowTextPart[] =>
  toParts(t("workspace.workflows.switch_summary", { variable: slotFor(0), count: caseCount }), [
    chipFor(path, refs),
  ]);
