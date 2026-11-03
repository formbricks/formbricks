import type { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import type { TConditionGroup } from "@formbricks/types/surveys/logic";
import type { TSurvey } from "@formbricks/types/surveys/types";

/**
 * The Flow tab's outline model (ENG-6929): a pure function from the survey to the rows the
 * FlowOutline renders, top to bottom in the order a respondent moves.
 *
 * - rules before the first question (`startLogic`, ENG-6932), a section that is always there
 * - each block, with its questions, and indented under it its rules and its fallback
 * - the endings
 *
 * **Everything the survey holds produces a row or a badge** (D2, Javier's ENG-3651 rule): whatever
 * the v3 API or MCP can write is shown, so nothing an AI wrote is hidden from the person checking
 * it. A construct the Flow tab cannot edit yet comes out with `editable: false` and is rendered
 * read-only. The keys this module reads beyond `TSurvey` (`showIf`, `hidden`,
 * `optionsCopiedFrom`, and rule actions or values the editor doesn't know) are the approved shapes
 * of the later Survey Flow Editor tickets; each of those tickets makes its construct editable.
 *
 * Labels are left to the renderer: the model carries ids, indices and the raw rules, so it stays
 * free of translations and of the survey's languages.
 */

/** How a rule reads on the outline: blue for a rule (jump, require answer), green for an Embedded Data step. */
export type TFlowRuleTone = "rule" | "embeddedData";

/** Why a row or badge is shown read-only. */
export type TFlowReadOnlyReason = "unsupportedAction" | "unsupportedValue" | "unsupportedCondition";

export type TFlowRuleOwner = { type: "block"; blockId: string; blockIdx: number } | { type: "start" };

export interface TFlowRuleRow {
  kind: "rule";
  id: string;
  owner: TFlowRuleOwner;
  ruleIdx: number;
  tone: TFlowRuleTone;
  rule: TSurveyBlockLogic;
  editable: boolean;
  readOnlyReason?: TFlowReadOnlyReason;
}

export type TFlowFallbackTarget =
  | { kind: "nextBlock" }
  | { kind: "block"; id: string }
  | { kind: "ending"; id: string }
  | { kind: "missing"; id: string };

export interface TFlowFallbackRow {
  blockId: string;
  blockIdx: number;
  target: TFlowFallbackTarget;
}

/**
 * A badge on a block or a question. None of these are editable on the Flow tab yet; they are shown
 * so a survey written through the API never hides them.
 *
 * - `showIf`: the item is shown only when its condition group matches
 * - `optionsShowIf`: `count` options (or matrix rows and columns) carry their own show-if
 * - `hiddenOptions`: `count` options are hidden
 * - `optionsCopiedFrom`: the options are copied from the question `sourceId`
 */
export type TFlowBadge =
  | { kind: "showIf"; conditions: TConditionGroup; editable: false }
  | { kind: "optionsShowIf"; count: number; editable: false }
  | { kind: "hiddenOptions"; count: number; editable: false }
  | { kind: "optionsCopiedFrom"; sourceId: string; editable: false };

export interface TFlowElementItem {
  id: string;
  elementIdx: number;
  badges: TFlowBadge[];
}

export interface TFlowBlockSection {
  kind: "block";
  id: string;
  blockIdx: number;
  elementCount: number;
  ruleCount: number;
  elements: TFlowElementItem[];
  badges: TFlowBadge[];
  rules: TFlowRuleRow[];
  /** Shown once a block has rules (or a stored fallback): where everyone else goes. */
  fallback: TFlowFallbackRow | null;
}

export interface TFlowEndingRow {
  id: string;
  endingIdx: number;
  type: "endScreen" | "redirectToUrl";
  url?: string;
}

export interface TFlowStartSection {
  rules: TFlowRuleRow[];
}

export interface TFlowOutline {
  /** Rules before the first question; always there, so a first rule can be added (ENG-6932). */
  start: TFlowStartSection;
  blocks: TFlowBlockSection[];
  endings: TFlowEndingRow[];
  counts: { blocks: number; endings: number };
}

const EDITABLE_ACTION_OBJECTIVES = new Set(["jumpToBlock", "requireAnswer", "calculate"]);
const EDITABLE_VALUE_TYPES = new Set(["static", "element", "variable", "hiddenField", "reserved"]);
const EDITABLE_OPERAND_TYPES = new Set(["element", "variable", "hiddenField", "reserved"]);

/**
 * Before the first question the editor offers no answers and no "require answer" (ENG-6932). A rule
 * written there through the API with either is shown read-only, as the validator refuses it anyway.
 */
const START_EDITABLE = {
  objectives: new Set(["jumpToBlock", "calculate"]),
  valueTypes: new Set(["static", "variable", "hiddenField", "reserved"]),
  operandTypes: new Set(["variable", "hiddenField", "reserved"]),
};
const BLOCK_EDITABLE = {
  objectives: EDITABLE_ACTION_OBJECTIVES,
  valueTypes: EDITABLE_VALUE_TYPES,
  operandTypes: EDITABLE_OPERAND_TYPES,
};
type TEditableSets = typeof BLOCK_EDITABLE;

type TLooseRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TLooseRecord => typeof value === "object" && value !== null;

const isGroup = (value: unknown): value is { conditions: unknown[] } =>
  isRecord(value) && Array.isArray(value.conditions);

/** Whether the rule editor can show every condition of a group: known operand types only. */
const areConditionsEditable = (group: unknown, editable: TEditableSets): boolean => {
  if (!isGroup(group)) return false;
  return group.conditions.every((condition) => {
    if (isGroup(condition)) return areConditionsEditable(condition, editable);
    if (!isRecord(condition) || !isRecord(condition.leftOperand)) return false;
    const leftType = condition.leftOperand.type;
    if (typeof leftType !== "string" || !editable.operandTypes.has(leftType)) return false;
    const right = condition.rightOperand;
    if (right === undefined) return true;
    return isRecord(right) && typeof right.type === "string" && editable.valueTypes.has(right.type);
  });
};

const getReadOnlyReason = (
  rule: TSurveyBlockLogic,
  editable: TEditableSets = BLOCK_EDITABLE
): TFlowReadOnlyReason | undefined => {
  const actions: unknown[] = Array.isArray(rule.actions) ? rule.actions : [];
  for (const action of actions) {
    if (!isRecord(action) || typeof action.objective !== "string") return "unsupportedAction";
    if (!editable.objectives.has(action.objective)) return "unsupportedAction";
    if (action.objective === "calculate") {
      const value = action.value;
      if (!isRecord(value) || typeof value.type !== "string" || !editable.valueTypes.has(value.type)) {
        return "unsupportedValue";
      }
    }
  }
  if (!areConditionsEditable(rule.conditions, editable)) return "unsupportedCondition";
  return undefined;
};

const getRuleTone = (rule: TSurveyBlockLogic): TFlowRuleTone => {
  const actions = Array.isArray(rule.actions) ? rule.actions : [];
  return actions.length > 0 && actions.every((action) => action.objective === "calculate")
    ? "embeddedData"
    : "rule";
};

const toRuleRow = (rule: TSurveyBlockLogic, ruleIdx: number, owner: TFlowRuleOwner): TFlowRuleRow => {
  const readOnlyReason = getReadOnlyReason(rule, owner.type === "start" ? START_EDITABLE : BLOCK_EDITABLE);
  return {
    kind: "rule",
    id: rule.id,
    owner,
    ruleIdx,
    tone: getRuleTone(rule),
    rule,
    editable: readOnlyReason === undefined,
    ...(readOnlyReason ? { readOnlyReason } : {}),
  };
};

const getShowIfBadge = (item: unknown): TFlowBadge[] =>
  isRecord(item) && isGroup(item.showIf)
    ? [{ kind: "showIf", conditions: item.showIf as unknown as TConditionGroup, editable: false }]
    : [];

/** The options of an element, wherever its type keeps them: choices, or matrix rows and columns. */
const getOptionLikeItems = (element: TLooseRecord): unknown[] =>
  ["choices", "rows", "columns"].flatMap((key) => {
    const items = element[key];
    return Array.isArray(items) ? items : [];
  });

const getElementBadges = (element: unknown): TFlowBadge[] => {
  if (!isRecord(element)) return [];
  const badges: TFlowBadge[] = [...getShowIfBadge(element)];

  if (typeof element.optionsCopiedFrom === "string") {
    badges.push({ kind: "optionsCopiedFrom", sourceId: element.optionsCopiedFrom, editable: false });
  }

  const options = getOptionLikeItems(element);
  const hiddenCount = options.filter((option) => isRecord(option) && option.hidden === true).length;
  const showIfCount = options.filter(
    (option) => isRecord(option) && option.hidden !== true && isGroup(option.showIf)
  ).length;
  if (showIfCount > 0) badges.push({ kind: "optionsShowIf", count: showIfCount, editable: false });
  if (hiddenCount > 0) badges.push({ kind: "hiddenOptions", count: hiddenCount, editable: false });

  return badges;
};

const getFallbackTarget = (survey: TSurvey, logicFallback: string | undefined): TFlowFallbackTarget => {
  if (!logicFallback) return { kind: "nextBlock" };
  if (survey.blocks.some((block) => block.id === logicFallback)) return { kind: "block", id: logicFallback };
  if (survey.endings.some((ending) => ending.id === logicFallback)) {
    return { kind: "ending", id: logicFallback };
  }
  return { kind: "missing", id: logicFallback };
};

const getStartSection = (survey: TSurvey): TFlowStartSection => ({
  rules: (survey.startLogic ?? []).map((rule, ruleIdx) => toRuleRow(rule, ruleIdx, { type: "start" })),
});

export const buildFlowOutline = (survey: TSurvey): TFlowOutline => {
  const blocks = survey.blocks.map((block, blockIdx): TFlowBlockSection => {
    const logic = block.logic ?? [];
    const owner: TFlowRuleOwner = { type: "block", blockId: block.id, blockIdx };
    const hasFallbackRow = logic.length > 0 || Boolean(block.logicFallback);

    return {
      kind: "block",
      id: block.id,
      blockIdx,
      elementCount: block.elements.length,
      ruleCount: logic.length,
      elements: block.elements.map((element, elementIdx) => ({
        id: element.id,
        elementIdx,
        badges: getElementBadges(element),
      })),
      badges: getShowIfBadge(block),
      rules: logic.map((rule, ruleIdx) => toRuleRow(rule, ruleIdx, owner)),
      fallback: hasFallbackRow
        ? { blockId: block.id, blockIdx, target: getFallbackTarget(survey, block.logicFallback) }
        : null,
    };
  });

  const endings = survey.endings.map(
    (ending, endingIdx): TFlowEndingRow => ({
      id: ending.id,
      endingIdx,
      type: ending.type,
      ...(ending.type === "redirectToUrl" && ending.url ? { url: ending.url } : {}),
    })
  );

  return {
    start: getStartSection(survey),
    blocks,
    endings,
    counts: { blocks: blocks.length, endings: endings.length },
  };
};
