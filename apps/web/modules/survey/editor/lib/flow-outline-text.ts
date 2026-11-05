import type { TFunction } from "i18next";
import { RESERVED_FIELD_CATALOG, getSurveyEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import type { TI18nString } from "@formbricks/types/i18n";
import type { TSurveyBlockLogic, TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import { type TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TExpression } from "@formbricks/types/surveys/expressions";
import type {
  TConditionGroup,
  TLeftOperand,
  TRightOperand,
  TSingleCondition,
} from "@formbricks/types/surveys/logic";
import {
  isMatrixRowCondition,
  resolveMatrixColumnValue,
  resolveMatrixRowIndex,
} from "@formbricks/types/surveys/matrix-conditions";
import { type TOptionListKey, getOptionList } from "@formbricks/types/surveys/show-if";
import type { TSurvey, TSurveyEnding } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { isConditionGroup } from "@/lib/surveyLogic/utils";
import { formatStoredDateValue } from "@/lib/utils/datetime";
import { recallToHeadline } from "@/lib/utils/recall";
import { getBlockDisplayName } from "@/modules/survey/editor/lib/blocks";
import {
  formatFormula,
  getFormulaReferences,
  segmentFormulaText,
} from "@/modules/survey/editor/lib/expression-formula";
import {
  type TFlowTextPart,
  getFormulaSegmentChip,
  toPlainText,
} from "@/modules/survey/editor/lib/reference-chips";
import { getConditionOperatorOptions } from "@/modules/survey/editor/lib/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { getElementBadgeText } from "@/modules/survey/lib/element-code-label";

/**
 * The one-line summaries the Flow tab shows on a collapsed rule row ("If “services” is empty →
 * End: …", "score + 1"). Read off the survey as it is, so a reference to something deleted still
 * reads instead of crashing the row. Kept apart from the outline model, which stays free of labels.
 */

const quote = (text: string) => `“${text}”`;

/** How dates read on a row (P65): the viewer's locale, and their time zone for a timestamp's time. */
export interface TFlowTextFormat {
  locale?: string;
  timeZone?: string;
}

/** A value of a date operand: in the app's date format when it is a stored date, else quoted text. */
const describeDateValue = (value: string, format: TFlowTextFormat): string =>
  formatStoredDateValue(value, format.locale ?? "en-US", format.timeZone) ?? quote(value);

/**
 * Summaries come in two forms (ENG-6969 T3, guardrail 4): the parts a row draws, references as chips,
 * and their plain text (`toPlainText`) that a tooltip, an `aria-label` and the tests read.
 */
const text = (value: string): TFlowTextPart => ({ kind: "text", text: value });

/** Joins groups of parts with a separator, leaving out the empty ones. */
const joinParts = (groups: TFlowTextPart[][], separator: string): TFlowTextPart[] =>
  groups
    .filter((group) => toPlainText(group) !== "")
    .flatMap((group, idx) => (idx === 0 ? group : [text(separator), ...group]));

const findElement = (survey: TSurvey, elementId: string): TSurveyElement | undefined =>
  getElementsFromBlocks(survey.blocks).find((element) => element.id === elementId);

const findField = (survey: TSurvey, storageKey: string) =>
  getSurveyEmbeddedFields(survey).find(({ link }) => link.storageKey === storageKey)?.field;

/** An Embedded Data field as a chip: green for a computed one, the hidden-field style for an ingested one. */
const fieldChip = (survey: TSurvey, storageKey: string, plainPrefix = ""): TFlowTextPart => {
  const field = findField(survey, storageKey);
  const label = field?.name ?? storageKey;
  return {
    kind: "reference",
    chip: {
      kind: plainPrefix === "@" || field?.source === "ingested" ? "hiddenField" : "field",
      label,
      ...(field ? {} : { missing: true }),
    },
    plain: `${plainPrefix}${label}`,
  };
};

/** A question as a chip with its type icon and code; plain, its code in quotes. */
const questionChip = (survey: TSurvey, elementId: string): TFlowTextPart => {
  const element = findElement(survey, elementId);
  const label = element ? getElementBadgeText(element) : elementId;
  return {
    kind: "reference",
    chip: { kind: "question", label, ...(element ? { elementType: element.type } : { missing: true }) },
    plain: quote(label),
  };
};

const isDateField = (survey: TSurvey, storageKey: string): boolean =>
  getSurveyEmbeddedFields(survey).find(({ link }) => link.storageKey === storageKey)?.field.dataType ===
  "date";

/** Whether a condition's left side holds a date, so a fixed value compared with it is one too. */
const isDateOperand = (operand: TLeftOperand, survey: TSurvey): boolean => {
  switch (operand.type) {
    case "element":
      return findElement(survey, operand.value)?.type === TSurveyElementTypeEnum.Date;
    case "variable":
    case "hiddenField":
      return isDateField(survey, operand.value);
    default:
      return (
        RESERVED_FIELD_CATALOG.find((entry) => entry.name === (operand as { value?: unknown }).value)
          ?.dataType === "date"
      );
  }
};

type TOptionItem = { id: string; label?: Record<string, string> };

const getOptionItems = (element: TSurveyElement | undefined, key: TOptionListKey): readonly TOptionItem[] =>
  getOptionList<TOptionItem>(element, key);

const getOptionLabel = (item: TOptionItem | undefined): string | undefined =>
  item?.label ? getTextContent(getLocalizedValue(item.label, "default")) : undefined;

/**
 * An operand: a question by code, a field by name (`@` for ingested ones in the plain text), a reserved
 * field by name; each a chip.
 */
const describeOperandParts = (
  operand: TLeftOperand | Exclude<TRightOperand, { type: "static" }>,
  survey: TSurvey
): TFlowTextPart[] => {
  switch (operand.type) {
    case "element": {
      const element = findElement(survey, operand.value);
      const name = questionChip(survey, operand.value);
      const meta = "meta" in operand ? operand.meta : undefined;
      if (!isMatrixRowCondition(meta)) return [name];
      // Ids first (ADR 0027): a row reordered since the condition was written still reads as its row.
      const rows = getOptionItems(element, "rows");
      const rowIndex = resolveMatrixRowIndex({ rows, columns: [] }, meta);
      const rowLabel = rowIndex === undefined ? undefined : getOptionLabel(rows[rowIndex]);
      return [name, text(` ${rowLabel ?? meta?.rowId ?? meta?.row}`)];
    }
    case "variable":
      return [fieldChip(survey, operand.value)];
    case "hiddenField":
      return [fieldChip(survey, operand.value, "@")];
    default: {
      // A reserved field reads by its name ("language"), as people type it in a URL or a formula.
      const name = String((operand as { value?: unknown }).value ?? "");
      return [{ kind: "reference", chip: { kind: "reserved", label: name }, plain: name }];
    }
  }
};

/** A fixed right-hand value: option ids read as their labels, a matrix column index as its column. */
const describeStaticValue = (
  condition: TSingleCondition,
  survey: TSurvey,
  format: TFlowTextFormat
): string => {
  const value = condition.rightOperand?.value;
  const element =
    condition.leftOperand.type === "element" ? findElement(survey, condition.leftOperand.value) : undefined;

  if (
    element?.type === TSurveyElementTypeEnum.Matrix &&
    condition.rightOperand?.type === "static" &&
    condition.leftOperand.type === "element"
  ) {
    // Ids first (ADR 0027): the column ids resolve to positions, which name the columns as they are now.
    const resolved = resolveMatrixColumnValue(element, condition.rightOperand);
    const columns = getOptionItems(element, "columns");
    const toColumnLabel = (position: string | number) =>
      getOptionLabel(columns[Number(position)]) ?? String(position);
    return Array.isArray(resolved) ? resolved.map(toColumnLabel).join(", ") : toColumnLabel(resolved);
  }

  if (isDateOperand(condition.leftOperand, survey)) {
    if (typeof value === "string") return describeDateValue(value, format);
    if (Array.isArray(value)) return value.map((item) => describeDateValue(String(item), format)).join(", ");
  }

  const choices = getOptionItems(element, "choices");
  const toLabel = (id: string) => getOptionLabel(choices.find((choice) => choice.id === id)) ?? id;
  if (Array.isArray(value)) return value.map(toLabel).join(", ");
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    return choices.some((choice) => choice.id === value) ? toLabel(value) : quote(value);
  }
  return "";
};

const describeOperator = (condition: TSingleCondition, survey: TSurvey, t: TFunction): string => {
  const label = getConditionOperatorOptions(condition, survey, t).find(
    (option) => option.value === condition.operator
  )?.label;
  if (typeof label !== "string" || label.length === 0) return condition.operator;
  return label.charAt(0).toLowerCase() + label.slice(1);
};

const describeConditionParts = (
  condition: TSingleCondition,
  survey: TSurvey,
  t: TFunction,
  format: TFlowTextFormat
): TFlowTextPart[] => {
  const groups = [
    describeOperandParts(condition.leftOperand, survey),
    [text(describeOperator(condition, survey, t))],
  ];
  const right = condition.rightOperand;
  if (right) {
    groups.push(
      right.type === "static"
        ? [text(describeStaticValue(condition, survey, format))]
        : describeOperandParts(right, survey)
    );
  }
  return joinParts(groups, " ");
};

/** A condition group as parts: references as chips, typed values in quotes, option labels plain. */
export const describeConditionGroupParts = (
  group: TConditionGroup,
  survey: TSurvey,
  t: TFunction,
  format: TFlowTextFormat = {}
): TFlowTextPart[] => {
  if (group.conditions.length === 0) return [text(t("workspace.surveys.edit.flow.always"))];
  const connector =
    group.connector === "or" ? t("workspace.surveys.edit.flow.or") : t("workspace.surveys.edit.flow.and");
  return group.conditions.flatMap((item, idx) => [
    ...(idx === 0 ? [] : [text(` ${connector} `)]),
    ...(isConditionGroup(item)
      ? [text("("), ...describeConditionGroupParts(item, survey, t, format), text(")")]
      : describeConditionParts(item, survey, t, format)),
  ]);
};

export const describeConditionGroup = (
  group: TConditionGroup,
  survey: TSurvey,
  t: TFunction,
  format: TFlowTextFormat = {}
): string => toPlainText(describeConditionGroupParts(group, survey, t, format));

/** A question's or ending's text as plain words, with recalled answers shown by name. */
export const getHeadlineText = (headline: TI18nString | undefined, survey: TSurvey): string =>
  headline ? getTextContent(recallToHeadline(headline, survey, false, "default").default ?? "") : "";

export const getEndingLabel = (ending: TSurveyEnding, survey: TSurvey, t: TFunction): string => {
  if (ending.type === "redirectToUrl") {
    return ending.label || ending.url || t("workspace.surveys.edit.redirect_thank_you_card");
  }
  return getHeadlineText(ending.headline, survey) || t("workspace.surveys.edit.end_screen_card");
};

export type TFlowActionText =
  | { kind: "jump"; target: "block" | "missing"; label: string }
  | { kind: "jump"; target: "ending"; label: string }
  | { kind: "requireAnswer"; label: string }
  | { kind: "calculate"; label: string }
  /** ENG-6933: names nothing, so the row reads "Mark as low quality". */
  | { kind: "markLowQuality"; label: string }
  | { kind: "unknown"; label: string };

const CALCULATE_SYMBOLS: Record<string, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  assign: "=",
  concat: "+",
};

/** A formula in the formula box's text form, its references as chips (ENG-6950). */
const describeFormulaParts = (tree: TExpression, survey: TSurvey): TFlowTextPart[] => {
  // A step just added has an empty formula until one is typed.
  if (tree.type === "static" && tree.value === "") return [text("…")];
  const references = getFormulaReferences(survey);
  return segmentFormulaText(formatFormula(tree, references), references).map((segment) =>
    segment.kind === "text"
      ? text(segment.text)
      : { kind: "reference", chip: getFormulaSegmentChip(segment, survey), plain: segment.text }
  );
};

const describeCalculateParts = (
  action: Extract<TSurveyBlockLogicAction, { objective: "calculate" }>,
  survey: TSurvey,
  t: TFunction,
  format: TFlowTextFormat
): TFlowTextPart[] => {
  // No field picked yet: the row says what is missing rather than ` = “”`.
  if (!action.variableId) return [text(t("workspace.surveys.edit.flow.no_field_to_set"))];
  const target = fieldChip(survey, action.variableId);
  // ENG-6935: a Set value step reads as its formula, in the formula box's own text form.
  if (action.value.type === "expression") {
    return [target, text(" = "), ...describeFormulaParts(action.value.value, survey)];
  }
  let value: TFlowTextPart[];
  if (action.value.type !== "static") value = describeOperandParts(action.value, survey);
  else if (typeof action.value.value === "number") value = [text(String(action.value.value))];
  else if (isDateField(survey, action.variableId)) {
    value = [text(describeDateValue(action.value.value, format))];
  } else value = [text(quote(action.value.value))];
  const symbol = CALCULATE_SYMBOLS[action.operator] ?? action.operator;
  return [target, text(` ${symbol} `), ...value];
};

/** Splits a sentence around the one placeholder its translation holds, for a chip in its place. */
const SLOT = "\u0000";
const fillSentence = (sentence: string, fill: TFlowTextPart[]): TFlowTextPart[] => {
  const [before, after = ""] = sentence.split(SLOT);
  return [text(before), ...fill, text(after)].filter((part) => part.kind !== "text" || part.text !== "");
};

/**
 * The first step of a collapsed rule row: the first action that isn't a jump, which trails as a pill
 * (ENG-6969 T2); the same one `summarizeRuleActions` puts first.
 */
const getFirstStep = (actions: TSurveyBlockLogicAction[]): TSurveyBlockLogicAction | undefined =>
  actions.find((action) => action.objective !== "jumpToBlock");

/**
 * The first step of a collapsed rule row as the parts the row draws (ENG-6969 T3): its questions and
 * fields as chips. `toPlainText` of these is what `getActionPlainText` says for the same step.
 */
export const describeFirstStepParts = (
  actions: TSurveyBlockLogicAction[],
  survey: TSurvey,
  t: TFunction,
  format: TFlowTextFormat = {}
): TFlowTextPart[] => {
  const action = getFirstStep(actions);
  if (!action) return [];
  switch (action.objective) {
    case "requireAnswer":
      return fillSentence(t("workspace.surveys.edit.flow.require_answer_to", { question: SLOT }), [
        questionChip(survey, action.target),
      ]);
    case "calculate":
      return describeCalculateParts(action, survey, t, format);
    default:
      return [text(getActionPlainText(describeAction(action, survey, t, format), t))];
  }
};

export const describeAction = (
  action: TSurveyBlockLogicAction,
  survey: TSurvey,
  t: TFunction,
  format: TFlowTextFormat = {}
): TFlowActionText => {
  switch (action.objective) {
    case "jumpToBlock": {
      const blockIdx = survey.blocks.findIndex((block) => block.id === action.target);
      if (blockIdx !== -1) {
        return {
          kind: "jump",
          target: "block",
          label: getBlockDisplayName(survey.blocks[blockIdx], blockIdx, t),
        };
      }
      const ending = survey.endings.find((item) => item.id === action.target);
      if (ending) {
        return {
          kind: "jump",
          target: "ending",
          label: getEndingLabel(ending, survey, t),
        };
      }
      return { kind: "jump", target: "missing", label: "" };
    }
    case "requireAnswer":
      return { kind: "requireAnswer", label: toPlainText([questionChip(survey, action.target)]) };
    case "calculate":
      return { kind: "calculate", label: toPlainText(describeCalculateParts(action, survey, t, format)) };
    case "markLowQuality":
      return { kind: "markLowQuality", label: "" };
    default:
      return { kind: "unknown", label: String((action as { objective?: unknown }).objective ?? "") };
  }
};

type TFlowJumpText = Extract<TFlowActionText, { kind: "jump" }>;

/**
 * A collapsed rule row's actions on one line (ENG-6969 T2): the first action in full, how many more
 * the row folds into "+N", and the destination as a trailing pill. The jump comes last whatever its
 * position in the list: every other action runs before the respondent moves on. The open row lists
 * every action.
 */
export interface TFlowRuleActionSummary {
  first?: TFlowActionText;
  moreCount: number;
  jump?: TFlowJumpText;
}

export const summarizeRuleActions = (
  actions: TSurveyBlockLogicAction[],
  survey: TSurvey,
  t: TFunction,
  format: TFlowTextFormat = {}
): TFlowRuleActionSummary => {
  const described = actions.map((action) => describeAction(action, survey, t, format));
  const jumps = described.filter((action): action is TFlowJumpText => action.kind === "jump");
  const others = described.filter((action) => action.kind !== "jump");
  // A second jump can only come through the API; it is counted rather than dropped.
  const moreCount = Math.max(others.length - 1, 0) + Math.max(jumps.length - 1, 0);
  return {
    ...(others[0] ? { first: others[0] } : {}),
    moreCount,
    ...(jumps[0] ? { jump: jumps[0] } : {}),
  };
};

/** An action as plain words: what its row shows, spelled out where the row uses a pill or an icon. */
export const getActionPlainText = (action: TFlowActionText, t: TFunction): string => {
  switch (action.kind) {
    case "jump":
      return action.target === "missing" ? t("workspace.surveys.edit.flow.no_destination") : action.label;
    case "requireAnswer":
      return t("workspace.surveys.edit.flow.require_answer_to", { question: action.label });
    case "markLowQuality":
      return t("workspace.surveys.edit.mark_as_low_quality");
    default:
      return action.label;
  }
};

/** A rule's condition as its row starts, as parts: "If …", or "Always" for a rule without conditions. */
export const describeRuleConditionParts = (
  rule: TSurveyBlockLogic,
  survey: TSurvey,
  t: TFunction,
  format: TFlowTextFormat = {}
): TFlowTextPart[] =>
  rule.conditions.conditions.length === 0
    ? [text(t("workspace.surveys.edit.flow.always_runs"))]
    : [
        text(`${t("workspace.surveys.edit.flow.if")} `),
        ...describeConditionGroupParts(rule.conditions, survey, t, format),
      ];

/** A rule's condition as its row starts, as plain text. */
export const describeRuleCondition = (
  rule: TSurveyBlockLogic,
  survey: TSurvey,
  t: TFunction,
  format: TFlowTextFormat = {}
): string => toPlainText(describeRuleConditionParts(rule, survey, t, format));

/**
 * A rule as one plain sentence with every action ("If … → a · b → Destination"): the tooltip of a
 * truncated row and the row's accessible name (ENG-6969 T2, guardrail 4).
 */
export const describeRuleSummary = (
  rule: TSurveyBlockLogic,
  survey: TSurvey,
  t: TFunction,
  format: TFlowTextFormat = {}
): string => {
  const described = rule.actions.map((action) => describeAction(action, survey, t, format));
  const steps = [
    described
      .filter((action) => action.kind !== "jump")
      .map((action) => getActionPlainText(action, t))
      .join(" · "),
    ...described.filter((action) => action.kind === "jump").map((action) => getActionPlainText(action, t)),
  ].filter((step) => step !== "");
  return [describeRuleCondition(rule, survey, t, format), ...steps].join(" → ");
};

/** A block header's counts: its questions, and its rules once it has any (ENG-6969 T15). */
export const describeBlockCounts = (
  block: { elementCount: number; ruleCount: number },
  t: TFunction
): string =>
  [
    t("common.count_questions", { count: block.elementCount }),
    ...(block.ruleCount > 0
      ? [t("workspace.surveys.edit.flow.count_rules", { count: block.ruleCount })]
      : []),
  ].join(" · ");
