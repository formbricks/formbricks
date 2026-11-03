import type { TFunction } from "i18next";
import { getSurveyEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import type { TI18nString } from "@formbricks/types/i18n";
import type { TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import { type TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type {
  TConditionGroup,
  TLeftOperand,
  TRightOperand,
  TSingleCondition,
} from "@formbricks/types/surveys/logic";
import type { TSurvey, TSurveyEnding } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { isConditionGroup } from "@/lib/surveyLogic/utils";
import { recallToHeadline } from "@/lib/utils/recall";
import { getBlockDisplayName } from "@/modules/survey/editor/lib/blocks";
import { formatFormula, getFormulaReferences } from "@/modules/survey/editor/lib/expression-formula";
import { getConditionOperatorOptions } from "@/modules/survey/editor/lib/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { getElementBadgeText } from "@/modules/survey/lib/element-code-label";

/**
 * The one-line summaries the Flow tab shows on a collapsed rule row ("If “services” is empty →
 * End: …", "score + 1"). Read off the survey as it is, so a reference to something deleted still
 * reads instead of crashing the row. Kept apart from the outline model, which stays free of labels.
 */

const quote = (text: string) => `“${text}”`;

const findElement = (survey: TSurvey, elementId: string): TSurveyElement | undefined =>
  getElementsFromBlocks(survey.blocks).find((element) => element.id === elementId);

const getFieldName = (survey: TSurvey, storageKey: string): string =>
  getSurveyEmbeddedFields(survey).find(({ link }) => link.storageKey === storageKey)?.field.name ??
  storageKey;

type TOptionItem = { id: string; label?: Record<string, string> };

const getOptionItems = (element: TSurveyElement | undefined, key: "choices" | "rows" | "columns") => {
  const items = element && key in element ? (element as unknown as Record<string, unknown>)[key] : undefined;
  return Array.isArray(items) ? (items as TOptionItem[]) : [];
};

const getOptionLabel = (item: TOptionItem | undefined): string | undefined =>
  item?.label ? getTextContent(getLocalizedValue(item.label, "default")) : undefined;

/** An operand: a question by code, a field by name (`@` for ingested ones), a reserved field by name. */
const describeOperand = (
  operand: TLeftOperand | Exclude<TRightOperand, { type: "static" }>,
  survey: TSurvey
): string => {
  switch (operand.type) {
    case "element": {
      const element = findElement(survey, operand.value);
      const name = quote(element ? getElementBadgeText(element) : operand.value);
      const row = "meta" in operand ? operand.meta?.row : undefined;
      if (row === undefined) return name;
      const rowLabel = getOptionLabel(getOptionItems(element, "rows")[Number(row)]);
      return `${name} ${rowLabel ?? row}`;
    }
    case "variable":
      return getFieldName(survey, operand.value);
    case "hiddenField":
      return `@${getFieldName(survey, operand.value)}`;
    default:
      // A reserved field reads by its name ("language"), as people type it in a URL or a formula.
      return String((operand as { value?: unknown }).value ?? "");
  }
};

/** A fixed right-hand value: option ids read as their labels, a matrix column index as its column. */
const describeStaticValue = (condition: TSingleCondition, survey: TSurvey): string => {
  const value = condition.rightOperand?.value;
  const element =
    condition.leftOperand.type === "element" ? findElement(survey, condition.leftOperand.value) : undefined;

  if (element?.type === TSurveyElementTypeEnum.Matrix && condition.leftOperand.type === "element") {
    const column = getOptionItems(element, "columns")[Number(value)];
    return getOptionLabel(column) ?? String(value);
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

const describeCondition = (condition: TSingleCondition, survey: TSurvey, t: TFunction): string => {
  const parts = [describeOperand(condition.leftOperand, survey), describeOperator(condition, survey, t)];
  const right = condition.rightOperand;
  if (right) {
    parts.push(
      right.type === "static" ? describeStaticValue(condition, survey) : describeOperand(right, survey)
    );
  }
  return parts.filter((part) => part !== "").join(" ");
};

export const describeConditionGroup = (group: TConditionGroup, survey: TSurvey, t: TFunction): string => {
  if (group.conditions.length === 0) return t("workspace.surveys.edit.flow.always");
  const connector =
    group.connector === "or" ? t("workspace.surveys.edit.flow.or") : t("workspace.surveys.edit.flow.and");
  return group.conditions
    .map((item) =>
      isConditionGroup(item)
        ? `(${describeConditionGroup(item, survey, t)})`
        : describeCondition(item, survey, t)
    )
    .join(` ${connector} `);
};

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
  | { kind: "jump"; target: "block" | "ending" | "missing"; label: string }
  | { kind: "requireAnswer"; label: string }
  | { kind: "calculate"; label: string }
  | { kind: "unknown"; label: string };

const CALCULATE_SYMBOLS: Record<string, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  assign: "=",
  concat: "+",
};

export const describeAction = (
  action: TSurveyBlockLogicAction,
  survey: TSurvey,
  t: TFunction
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
      if (ending) return { kind: "jump", target: "ending", label: getEndingLabel(ending, survey, t) };
      return { kind: "jump", target: "missing", label: "" };
    }
    case "requireAnswer": {
      const element = findElement(survey, action.target);
      return { kind: "requireAnswer", label: quote(element ? getElementBadgeText(element) : action.target) };
    }
    case "calculate": {
      // ENG-6935: a Set value step reads as its formula, in the formula box's own text form.
      if (action.value.type === "expression") {
        const tree = action.value.value;
        // A step just added has an empty formula until one is typed.
        const formula =
          tree.type === "static" && tree.value === ""
            ? "…"
            : formatFormula(tree, getFormulaReferences(survey));
        return { kind: "calculate", label: `${getFieldName(survey, action.variableId)} = ${formula}` };
      }
      const value =
        action.value.type === "static"
          ? typeof action.value.value === "number"
            ? String(action.value.value)
            : quote(action.value.value)
          : describeOperand(action.value, survey);
      const symbol = CALCULATE_SYMBOLS[action.operator] ?? action.operator;
      return { kind: "calculate", label: `${getFieldName(survey, action.variableId)} ${symbol} ${value}` };
    }
    default:
      return { kind: "unknown", label: String((action as { objective?: unknown }).objective ?? "") };
  }
};

/**
 * How one action of a rule is introduced on its row: the first reads on its own, later ones are set
 * apart ("·"), and the jump is announced with "then". Run together, "Require an answer to “q3” What
 * went wrong" read the jump's destination as part of the question's name.
 */
export type TFlowActionLead = "none" | "and" | "then";

export interface TFlowActionStep {
  lead: TFlowActionLead;
  action: TFlowActionText;
}

/**
 * A rule's actions as the steps its row shows. The jump goes last whatever its position in the
 * list: every other action runs before the respondent moves on.
 */
export const describeRuleActions = (
  actions: TSurveyBlockLogicAction[],
  survey: TSurvey,
  t: TFunction
): TFlowActionStep[] => {
  const described = actions.map((action) => describeAction(action, survey, t));
  const ordered = [
    ...described.filter((action) => action.kind !== "jump"),
    ...described.filter((action) => action.kind === "jump"),
  ];
  return ordered.map((action, idx): TFlowActionStep => {
    if (idx === 0) return { lead: "none", action };
    return { lead: action.kind === "jump" ? "then" : "and", action };
  });
};
