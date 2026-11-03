import { createId } from "@paralleldrive/cuid2";
import type {
  TSurveyBlock,
  TSurveyBlockLogic,
  TSurveyBlockLogicAction,
} from "@formbricks/types/surveys/blocks";
import type { TConditionGroup, TSingleCondition } from "@formbricks/types/surveys/logic";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { duplicateLogicItem } from "@/lib/surveyLogic/utils";

/**
 * Operations on a list of logic rules (ENG-6929). The rule editor used to be wired to one block's
 * index; it now edits any rule list through these, so a block's rules and the rules before the first
 * question (ENG-6932) share one editor. Every function returns a new list and leaves its input alone.
 */

export const moveRule = (rules: TSurveyBlockLogic[], from: number, to: number): TSurveyBlockLogic[] => {
  if (from < 0 || from >= rules.length || to < 0 || to >= rules.length) return rules;
  const next = [...rules];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

export const removeRule = (rules: TSurveyBlockLogic[], ruleIdx: number): TSurveyBlockLogic[] =>
  rules.filter((_, idx) => idx !== ruleIdx);

export const duplicateRule = (rules: TSurveyBlockLogic[], ruleIdx: number): TSurveyBlockLogic[] => {
  const rule = rules[ruleIdx];
  if (!rule) return rules;
  const next = [...rules];
  next.splice(ruleIdx + 1, 0, duplicateLogicItem(structuredClone(rule)));
  return next;
};

/** Changes a rule's conditions. A rule left with no condition is removed, as the editor always did. */
export const updateRuleConditions = (
  rules: TSurveyBlockLogic[],
  ruleIdx: number,
  updater: (conditions: TConditionGroup) => TConditionGroup
): TSurveyBlockLogic[] => {
  const rule = rules[ruleIdx];
  if (!rule) return rules;
  const conditions = updater(structuredClone(rule.conditions));
  if (conditions.conditions.length === 0) return removeRule(rules, ruleIdx);
  return rules.map((item, idx) => (idx === ruleIdx ? { ...item, conditions } : item));
};

export const updateRuleActions = (
  rules: TSurveyBlockLogic[],
  ruleIdx: number,
  updater: (actions: TSurveyBlockLogicAction[]) => TSurveyBlockLogicAction[]
): TSurveyBlockLogic[] => {
  const rule = rules[ruleIdx];
  if (!rule) return rules;
  const actions = updater(structuredClone(rule.actions));
  return rules.map((item, idx) => (idx === ruleIdx ? { ...item, actions } : item));
};

/**
 * What the Add logic menu starts a rule as: a jump rule, a calculation (a condition, then a formula),
 * or a Set value step (ENG-6935), which always runs: its condition group is an empty `and` group
 * (ADR 0025).
 */
export type TNewRuleKind = "jump" | "calculate" | "setValue";

export interface TNewRuleOptions {
  /** The first condition, without an id. A Set value step has none. */
  condition: Omit<TSingleCondition, "id">;
  /** The computed field a calculation sets; empty when the survey has none yet. */
  variableId?: string;
}

/** An empty formula: the step is saved only once the formula box holds one. */
const EMPTY_FORMULA = { type: "expression", value: { type: "static", value: "" } } as const;

export const createRule = (
  kind: TNewRuleKind,
  { condition, variableId }: TNewRuleOptions
): TSurveyBlockLogic => {
  const action: TSurveyBlockLogicAction =
    kind === "jump"
      ? { id: createId(), objective: "jumpToBlock", target: "" }
      : {
          id: createId(),
          objective: "calculate",
          variableId: variableId ?? "",
          operator: "assign",
          value: { ...EMPTY_FORMULA, value: { ...EMPTY_FORMULA.value } },
        };

  return {
    id: createId(),
    conditions: {
      id: createId(),
      connector: "and",
      conditions: kind === "setValue" ? [] : [{ id: createId(), ...condition }],
    },
    actions: [action],
  };
};

/**
 * The block with `logicFallback` set, or removed. Removed rather than set to `undefined`: the
 * editor's dirty check compares the working copy with the saved survey key for key, so an empty key
 * left behind would read as an unsaved change.
 */
const withFallback = (block: TSurveyBlock, logicFallback: string | undefined): TSurveyBlock => {
  if (logicFallback) return { ...block, logicFallback };
  const { logicFallback: _removed, ...rest } = block;
  return rest;
};

const updateBlockAt = (
  survey: TSurvey,
  blockIdx: number,
  update: (block: TSurveyBlock) => TSurveyBlock
): TSurvey => {
  const block = survey.blocks[blockIdx];
  if (!block) return survey;
  return { ...survey, blocks: survey.blocks.map((item, idx) => (idx === blockIdx ? update(item) : item)) };
};

/** Sets a block's rules. Without rules a fallback means nothing, so it goes with the last rule. */
export const setBlockRules = (survey: TSurvey, blockIdx: number, rules: TSurveyBlockLogic[]): TSurvey =>
  updateBlockAt(survey, blockIdx, (block) => {
    const next = { ...block, logic: rules };
    return rules.length === 0 ? withFallback(next, undefined) : next;
  });

/** Sets where everyone else goes after a block; `undefined` means the next block. */
export const setBlockLogicFallback = (
  survey: TSurvey,
  blockIdx: number,
  logicFallback: string | undefined
): TSurvey => updateBlockAt(survey, blockIdx, (block) => withFallback(block, logicFallback));
