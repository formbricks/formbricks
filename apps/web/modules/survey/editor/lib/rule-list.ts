import { createId } from "@paralleldrive/cuid2";
import { getIngestedStorageKeys } from "@formbricks/types/embedded-data-fields";
import type {
  TSurveyBlock,
  TSurveyBlockLogic,
  TSurveyBlockLogicAction,
  TSurveyBlockLogicActionObjective,
} from "@formbricks/types/surveys/blocks";
import type { TConditionGroup, TSingleCondition } from "@formbricks/types/surveys/logic";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { createEmptyFormulaAction, duplicateLogicItem } from "@/lib/surveyLogic/utils";

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

/** Actions that may run for everyone: setting a value and marking the response Low quality. */
const ALWAYS_RUNNABLE = new Set<TSurveyBlockLogicActionObjective>(["calculate", "markLowQuality"]);

/** Whether a rule may stand with no condition, shown as "Always runs" (ADR 0026). */
export const canRuleAlwaysRun = (actions: TSurveyBlockLogicAction[]): boolean =>
  actions.every((action) => ALWAYS_RUNNABLE.has(action.objective));

/**
 * Changes a rule's conditions. When the last condition goes, a rule that only sets values or marks
 * the response Low quality stays and always runs (ADR 0026); its group becomes an `and` group, since
 * an empty group reads and runs as "all". Any other rule (a jump, a required answer) is removed with
 * its last condition, as before the Flow tab: a jump for everyone is never what removing a condition
 * meant.
 */
export const updateRuleConditions = (
  rules: TSurveyBlockLogic[],
  ruleIdx: number,
  updater: (conditions: TConditionGroup) => TConditionGroup
): TSurveyBlockLogic[] => {
  const rule = rules[ruleIdx];
  if (!rule) return rules;
  const updated = updater(structuredClone(rule.conditions));
  if (updated.conditions.length > 0) {
    return rules.map((item, idx) => (idx === ruleIdx ? { ...item, conditions: updated } : item));
  }
  if (!canRuleAlwaysRun(rule.actions)) return removeRule(rules, ruleIdx);
  const conditions: TConditionGroup = { ...updated, connector: "and" };
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
 * What the Add logic menu starts a rule as: a jump rule, a Set value step (ENG-6935), which always
 * runs: its condition group is an empty `and` group (ADR 0026), or a Mark as low quality rule
 * (ENG-6933). A Set value that runs only sometimes is the same step with "Add a condition" used on it,
 * so the menu offers no separate calculation.
 */
export type TNewRuleKind = "jump" | "setValue" | "markLowQuality";

export interface TNewRuleOptions {
  /** The first condition, without an id. A Set value step has none. */
  condition: Omit<TSingleCondition, "id">;
  /** The computed field a Set value step sets; empty when the survey has none yet. */
  variableId?: string;
  /**
   * The field's value is stored as an expression even in one step (a date field, P38): the step starts
   * as an empty expression leaf, which the editor shows with the Expression switch off. Any other field
   * starts on the operator picker (Assign), with Expression one switch away.
   */
  storedAsExpression?: boolean;
}

const createFirstAction = (
  kind: TNewRuleKind,
  variableId: string | undefined,
  storedAsExpression: boolean
): TSurveyBlockLogicAction => {
  switch (kind) {
    case "jump":
      return { id: createId(), objective: "jumpToBlock", target: "" };
    // ENG-6933: complete as it is; the respondent sees nothing when it fires.
    case "markLowQuality":
      return { id: createId(), objective: "markLowQuality" };
    case "setValue":
      return storedAsExpression
        ? createEmptyFormulaAction(createId(), variableId)
        : {
            id: createId(),
            objective: "calculate",
            variableId: variableId ?? "",
            operator: "assign",
            value: { type: "static", value: "" },
          };
  }
};

export const createRule = (
  kind: TNewRuleKind,
  { condition, variableId, storedAsExpression = false }: TNewRuleOptions
): TSurveyBlockLogic => {
  const action = createFirstAction(kind, variableId, storedAsExpression);

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

/**
 * The rule editor's scope for the rules before the first question (ENG-6932): they run before any
 * block, so no answer can be read and every block is a jump target.
 */
export const START_SCOPE_BLOCK_IDX = -1;

/**
 * Sets the rules before the first question. Without rules the survey stores none (`null`), as a
 * survey that never had any does, so adding and removing a rule leaves no unsaved change behind.
 */
export const setStartRules = (survey: TSurvey, rules: TSurveyBlockLogic[]): TSurvey => ({
  ...survey,
  startLogic: rules.length > 0 ? rules : null,
});

/**
 * What a rule's actions may do where it runs: before the first question jump, set a value or mark the
 * response Low quality (ENG-6933, ENG-6952); a block's rules may also require an answer.
 */
export const getAllowedActionObjectives = (scopeBlockIdx: number): TSurveyBlockLogicActionObjective[] =>
  scopeBlockIdx === START_SCOPE_BLOCK_IDX
    ? ["calculate", "jumpToBlock", "markLowQuality"]
    : ["calculate", "requireAnswer", "jumpToBlock", "markLowQuality"];

/** What an action's choices depend on besides its list: whether the rule has no condition. */
export interface TRuleShape {
  /** The rule has no condition, so it runs for everyone ("Always"). */
  alwaysRuns?: boolean;
}

/** Objectives a rule holds at most once: one jump, and one Mark as low quality (ENG-6933). */
const ONCE_PER_RULE = new Set<TSurveyBlockLogicActionObjective>(["jumpToBlock", "markLowQuality"]);

/**
 * What one action of a rule may change to: what the scope allows, less a jump or a Mark as low quality
 * another action of the rule already is.
 */
export const getObjectivesForAction = (
  actions: TSurveyBlockLogicAction[],
  actionIdx: number,
  scopeBlockIdx: number,
  { alwaysRuns = false }: TRuleShape = {}
): TSurveyBlockLogicActionObjective[] => {
  const takenElsewhere = new Set(
    actions.filter((_, idx) => idx !== actionIdx).map((action) => action.objective)
  );
  return getAllowedActionObjectives(scopeBlockIdx).filter(
    (objective) =>
      (!alwaysRuns || ALWAYS_RUNNABLE.has(objective)) &&
      (!ONCE_PER_RULE.has(objective) || !takenElsewhere.has(objective))
  );
};

/**
 * The objective of an action added below: a jump first, then whatever else the scope allows. A rule
 * with no condition runs for everyone, so it only adds another Set value.
 */
export const getNextActionObjective = (
  actions: TSurveyBlockLogicAction[],
  scopeBlockIdx: number,
  { alwaysRuns = false }: TRuleShape = {}
): TSurveyBlockLogicActionObjective => {
  if (alwaysRuns) return "calculate";
  if (!actions.some((action) => action.objective === "jumpToBlock")) return "jumpToBlock";
  return scopeBlockIdx === START_SCOPE_BLOCK_IDX ? "calculate" : "requireAnswer";
};

/**
 * The condition a new rule before the first question starts with. There is no answer yet, so it
 * reads the first URL parameter (ingested field), or the page URL when the survey has none.
 */
export const getDefaultStartCondition = (survey: TSurvey): Omit<TSingleCondition, "id"> => {
  const [firstField] = getIngestedStorageKeys(survey);
  return firstField
    ? { leftOperand: { type: "hiddenField", value: firstField }, operator: "isSet" }
    : { leftOperand: { type: "reserved", value: "url" }, operator: "isSet" };
};
