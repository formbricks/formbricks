import type { TFunction } from "i18next";
import { RESERVED_FIELD_CATALOG, getSurveyEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import type { TI18nString } from "@formbricks/types/i18n";
import type { TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import { type TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
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

/** How dates read on a row (P65): the viewer's locale, and their time zone for a timestamp's time. */
export interface TFlowTextFormat {
  locale?: string;
  timeZone?: string;
}

/** A value of a date operand: in the app's date format when it is a stored date, else quoted text. */
const describeDateValue = (value: string, format: TFlowTextFormat): string =>
  formatStoredDateValue(value, format.locale ?? "en-US", format.timeZone) ?? quote(value);

const findElement = (survey: TSurvey, elementId: string): TSurveyElement | undefined =>
  getElementsFromBlocks(survey.blocks).find((element) => element.id === elementId);

const getFieldName = (survey: TSurvey, storageKey: string): string =>
  getSurveyEmbeddedFields(survey).find(({ link }) => link.storageKey === storageKey)?.field.name ??
  storageKey;

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

/** An operand: a question by code, a field by name (`@` for ingested ones), a reserved field by name. */
const describeOperand = (
  operand: TLeftOperand | Exclude<TRightOperand, { type: "static" }>,
  survey: TSurvey
): string => {
  switch (operand.type) {
    case "element": {
      const element = findElement(survey, operand.value);
      const name = quote(element ? getElementBadgeText(element) : operand.value);
      const meta = "meta" in operand ? operand.meta : undefined;
      if (!isMatrixRowCondition(meta)) return name;
      // Ids first (ADR 0027): a row reordered since the condition was written still reads as its row.
      const rows = getOptionItems(element, "rows");
      const rowIndex = resolveMatrixRowIndex({ rows, columns: [] }, meta);
      const rowLabel = rowIndex === undefined ? undefined : getOptionLabel(rows[rowIndex]);
      return `${name} ${rowLabel ?? meta?.rowId ?? meta?.row}`;
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

const describeCondition = (
  condition: TSingleCondition,
  survey: TSurvey,
  t: TFunction,
  format: TFlowTextFormat
): string => {
  const parts = [describeOperand(condition.leftOperand, survey), describeOperator(condition, survey, t)];
  const right = condition.rightOperand;
  if (right) {
    parts.push(
      right.type === "static"
        ? describeStaticValue(condition, survey, format)
        : describeOperand(right, survey)
    );
  }
  return parts.filter((part) => part !== "").join(" ");
};

export const describeConditionGroup = (
  group: TConditionGroup,
  survey: TSurvey,
  t: TFunction,
  format: TFlowTextFormat = {}
): string => {
  if (group.conditions.length === 0) return t("workspace.surveys.edit.flow.always");
  const connector =
    group.connector === "or" ? t("workspace.surveys.edit.flow.or") : t("workspace.surveys.edit.flow.and");
  return group.conditions
    .map((item) =>
      isConditionGroup(item)
        ? `(${describeConditionGroup(item, survey, t, format)})`
        : describeCondition(item, survey, t, format)
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
  | { kind: "jump"; target: "block" | "missing"; label: string }
  /** An ending names its type, so its chip carries the same icon as the ending on the Questions tab. */
  | { kind: "jump"; target: "ending"; endingType: TSurveyEnding["type"]; label: string }
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
          endingType: ending.type,
          label: getEndingLabel(ending, survey, t),
        };
      }
      return { kind: "jump", target: "missing", label: "" };
    }
    case "requireAnswer": {
      const element = findElement(survey, action.target);
      return { kind: "requireAnswer", label: quote(element ? getElementBadgeText(element) : action.target) };
    }
    case "calculate": {
      // No field picked yet: the row says what is missing rather than ` = “”`.
      if (!action.variableId) {
        return { kind: "calculate", label: t("workspace.surveys.edit.flow.no_field_to_set") };
      }
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
      let value: string;
      if (action.value.type !== "static") value = describeOperand(action.value, survey);
      else if (typeof action.value.value === "number") value = String(action.value.value);
      else if (isDateField(survey, action.variableId)) value = describeDateValue(action.value.value, format);
      else value = quote(action.value.value);
      const symbol = CALCULATE_SYMBOLS[action.operator] ?? action.operator;
      return { kind: "calculate", label: `${getFieldName(survey, action.variableId)} ${symbol} ${value}` };
    }
    case "markLowQuality":
      return { kind: "markLowQuality", label: "" };
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
  t: TFunction,
  format: TFlowTextFormat = {}
): TFlowActionStep[] => {
  const described = actions.map((action) => describeAction(action, survey, t, format));
  const ordered = [
    ...described.filter((action) => action.kind !== "jump"),
    ...described.filter((action) => action.kind === "jump"),
  ];
  return ordered.map((action, idx): TFlowActionStep => {
    if (idx === 0) return { lead: "none", action };
    return { lead: action.kind === "jump" ? "then" : "and", action };
  });
};
