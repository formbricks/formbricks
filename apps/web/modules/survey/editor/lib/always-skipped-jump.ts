import type { TConditionGroup, TSingleCondition } from "@formbricks/types/surveys/logic";
import { evaluateUnansweredCondition } from "@formbricks/types/surveys/logic-evaluation";
import type { TSurvey } from "@formbricks/types/surveys/types";

/**
 * A jump into a block whose show-if can never match on the path the jump takes (review of ENG-6969):
 * the start rule `seg = heavy → Heavy users`, where Heavy users is shown only if Services
 * includes all of Netflix, Disney+ and Prime Video. The jump skips Services, so on that path Services
 * has no answer, the show-if is false, and the respondent silently lands on the block after it.
 *
 * The check reads the show-if the way the renderer does on that path (`evaluateShowIf`): a condition on
 * a question the jump skips reads as unanswered (`evaluateUnansweredCondition`, the shared rule: only
 * "is skipped" and a CTA's "is not clicked" hold). Anything else (an answer from before the jump, a
 * hidden field, a variable) could go either way, so the check only flags a show-if that is false
 * whatever those hold.
 */

type TMaybe = boolean | undefined;

const readLeaf = (condition: TSingleCondition, skippedIds: ReadonlySet<string>): TMaybe =>
  condition.leftOperand.type === "element" && skippedIds.has(condition.leftOperand.value)
    ? evaluateUnansweredCondition(condition, {}, () => true)
    : undefined;

/** The group as true, false, or `undefined` when it depends on something the path doesn't decide. */
const readGroup = (group: TConditionGroup, skippedIds: ReadonlySet<string>): TMaybe => {
  // An empty group always holds (ADR 0026).
  if (group.conditions.length === 0) return true;
  const results = group.conditions.map((condition) =>
    "conditions" in condition ? readGroup(condition, skippedIds) : readLeaf(condition, skippedIds)
  );
  const [decides, otherwise] = group.connector === "or" ? [true, false] : [false, true];
  if (results.includes(decides)) return decides;
  return results.every((result) => result === otherwise) ? otherwise : undefined;
};

/** The questions a group's conditions read, by id, in order, once each. */
const getReadElementIds = (group: TConditionGroup): string[] => [
  ...new Set(
    group.conditions.flatMap((condition) =>
      "conditions" in condition
        ? getReadElementIds(condition)
        : condition.leftOperand.type === "element"
          ? [condition.leftOperand.value]
          : []
    )
  ),
];

export interface TAlwaysSkippedJump {
  /** The block the jump goes to, which is then always skipped. */
  targetBlockId: string;
  /** The skipped questions its show-if reads, by id. */
  skippedElementIds: string[];
}

/**
 * Whether a jump from after block `fromBlockIdx` (-1: before the first question) to `targetBlockId`
 * lands on a block that is always skipped on that path; `null` when it isn't, or might not be.
 */
export const getAlwaysSkippedJump = (
  survey: TSurvey,
  fromBlockIdx: number,
  targetBlockId: string
): TAlwaysSkippedJump | null => {
  const targetIdx = survey.blocks.findIndex((block) => block.id === targetBlockId);
  const showIf = survey.blocks[targetIdx]?.showIf;
  // A jump back, or to the very next block, skips nothing.
  if (!showIf || targetIdx <= fromBlockIdx + 1) return null;

  const skippedIds = new Set(
    survey.blocks.slice(fromBlockIdx + 1, targetIdx).flatMap((block) => block.elements.map((el) => el.id))
  );
  if (readGroup(showIf, skippedIds) !== false) return null;

  return {
    targetBlockId,
    skippedElementIds: getReadElementIds(showIf).filter((id) => skippedIds.has(id)),
  };
};
