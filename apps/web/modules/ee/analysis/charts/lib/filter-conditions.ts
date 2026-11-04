/**
 * Adapter between the chart builder's filter tree (`FilterNode[]` + a top-level AND/OR) and the
 * shared `ConditionsEditor`, so chart filters are drawn and edited exactly like survey logic.
 */
import type { TFunction } from "i18next";
import {
  ANSWER_IS_ANY_OF_OPERATOR,
  ANSWER_OPERATORS,
  type TAnswerQuestion,
  getAnswerBuilderQuestionId,
  toAnswerBuilderField,
} from "@/modules/ee/analysis/lib/answer-filter";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";
import { type FilterNode, type FilterRow, isFilterGroup } from "@/modules/ee/analysis/lib/query-builder";
import {
  EMOTIONS_DIMENSION_ID,
  FEEDBACK_FIELDS,
  getFieldById,
  getFilterOperatorsForType,
  getTranslatedFieldLabel,
} from "@/modules/ee/analysis/lib/schema-definition";
import { AiGlyph } from "@/modules/ui/components/ai";
import type {
  TGenericCondition,
  TGenericConditionGroup,
} from "@/modules/ui/components/conditions-editor/types";
import type { TComboboxGroupedOption } from "@/modules/ui/components/input-combo-box";

/** The editor addresses the top-level list by this id; node ids are UUIDs, so it cannot collide. */
export const CHART_FILTER_ROOT_ID = "root";

type TFilterFieldType = "string" | "number" | "time" | "boolean";

export function getFilterFieldType(fieldId: string): TFilterFieldType {
  const type = getFieldById(fieldId)?.type;
  // Count measures are never offered as filters, so a lookup miss and a count both fall back to text.
  return type === undefined || type === "count" ? "string" : type;
}

/**
 * Emotions is multi-label: default to `contains` so a single picked emotion matches records tagged
 * with it (equals would require an exact whole-set match).
 */
export function getDefaultFilterOperator(fieldId: string): string {
  if (fieldId === EMOTIONS_DIMENSION_ID) return "contains";
  if (getAnswerBuilderQuestionId(fieldId)) return "equals";
  return getFilterOperatorsForType(getFilterFieldType(fieldId))[0] ?? "equals";
}

export function createDefaultFilterRow(): FilterRow {
  const field = FEEDBACK_FIELDS.dimensions[0]?.id ?? "";
  return { id: crypto.randomUUID(), field, operator: getDefaultFilterOperator(field), values: null };
}

/** What the chart's Feedback Dataset adds to the filter fields (ENG-6893, ENG-6637). */
export type TDatasetFilterFields = {
  embeddedFields: readonly TEmbeddedChartField[];
  answerQuestions: readonly TAnswerQuestion[];
};

/** A dataset that adds nothing: no embedded-data keys, no answerable questions. */
const NO_DATASET_FIELDS: TDatasetFilterFields = { embeddedFields: [], answerQuestions: [] };

export function getFilterFieldOptions(
  t: TFunction,
  dataset: TDatasetFilterFields = NO_DATASET_FIELDS
): TComboboxGroupedOption[] {
  return [
    {
      label: t("workspace.analysis.charts.dimensions"),
      value: "dimensions",
      options: FEEDBACK_FIELDS.dimensions.map((d) => ({
        value: d.id,
        label: getTranslatedFieldLabel(d.id, t),
        ...(d.isGenerated ? { icon: AiGlyph } : {}),
      })),
    },
    {
      label: t("workspace.analysis.charts.measures"),
      value: "measures",
      // Only continuous aggregate measures (scores + averages) make sense as filters — you
      // threshold them (e.g. NPS score > 50, average sentiment > 0.5). Count measures are
      // excluded: filtering by a count is either a no-op here or redundant with a dimension
      // filter (e.g. "Sentiment: Positive" count vs. the Sentiment dimension = "positive").
      options: FEEDBACK_FIELDS.measures
        .filter((m) => m.group === "score" || m.group === "average")
        .map((m) => ({ value: m.id, label: getTranslatedFieldLabel(m.id, t) })),
    },
    // Groups the dataset has nothing for are left out rather than shown empty.
    ...(dataset.embeddedFields.length > 0
      ? [
          {
            label: t("workspace.analysis.charts.embedded_data"),
            value: "embeddedData",
            // Each key under its own name, as collected (ENG-6893).
            options: dataset.embeddedFields.map((field) => ({ value: field.name, label: field.key })),
          },
        ]
      : []),
    ...(dataset.answerQuestions.length > 0
      ? [
          {
            label: t("workspace.analysis.charts.answer_to_question"),
            value: "answerToQuestion",
            options: dataset.answerQuestions.map((question) => ({
              value: toAnswerBuilderField(question.id),
              label: question.label,
            })),
          },
        ]
      : []),
  ];
}

/**
 * The operators an answer rule offers for its question's kind (ENG-6637): equals, not equals and is any
 * of; a multi-select reads "contains" for `equals` and has no "does not contain".
 */
export function getAnswerOperatorOptions(
  question: TAnswerQuestion | undefined,
  t: TFunction
): { value: string; label: string }[] {
  const operators = question ? ANSWER_OPERATORS[question.kind] : ANSWER_OPERATORS.choice;
  const isMulti = question?.kind === "multi";
  return [
    // The builder's own operator wording (U7); only a multi-select reads `equals` as "contains".
    ...operators.map((operator) => ({
      value: operator,
      label:
        operator === "equals" && isMulti
          ? t("workspace.analysis.charts.contains")
          : getFilterOperatorLabel(operator, t),
    })),
    { value: ANSWER_IS_ANY_OF_OPERATOR, label: t("workspace.analysis.charts.is_any_of") },
  ];
}

export function getFilterOperatorLabel(operator: string, t: TFunction): string {
  switch (operator) {
    case "equals":
      return t("workspace.analysis.charts.equals");
    case "notEquals":
      return t("workspace.analysis.charts.not_equals");
    case "contains":
      return t("workspace.analysis.charts.contains");
    case "notContains":
      return t("workspace.analysis.charts.not_contains");
    case "set":
      return t("workspace.analysis.charts.is_set");
    case "notSet":
      return t("workspace.analysis.charts.is_not_set");
    case "gt":
      return t("workspace.analysis.charts.greater_than");
    case "gte":
      return t("workspace.analysis.charts.greater_than_or_equal");
    case "lt":
      return t("workspace.analysis.charts.less_than");
    case "lte":
      return t("workspace.analysis.charts.less_than_or_equal");
    default:
      return operator;
  }
}

function toCondition(node: FilterNode): TGenericCondition | TGenericConditionGroup {
  if (isFilterGroup(node)) {
    return { id: node.id, connector: node.logic, conditions: node.children.map(toCondition) };
  }

  // "Is any of" holds every picked value; every other operator shows its first.
  const value = node.operator === ANSWER_IS_ANY_OF_OPERATOR ? node.values?.map(String) : node.values?.[0];
  return {
    id: node.id,
    leftOperand: { value: node.field, type: "field" },
    operator: node.operator,
    rightOperand: value === undefined ? undefined : { value, type: "static" },
  };
}

/** The whole filter tree as the editor's root group; the top-level AND/OR is that group's connector. */
export function toConditionGroup(filters: FilterNode[], filterLogic: "and" | "or"): TGenericConditionGroup {
  return { id: CHART_FILTER_ROOT_ID, connector: filterLogic, conditions: filters.map(toCondition) };
}

/**
 * Maps an editor update back onto a filter row. The editor sends a field change together with a
 * reset operator and value, and an operator change together with a reset value, so the first
 * matching branch owns the whole update.
 */
export function toFilterRowUpdates(updates: Partial<TGenericCondition>): Partial<FilterRow> {
  if (updates.leftOperand) {
    const field = updates.leftOperand.value;
    return { field, operator: getDefaultFilterOperator(field), values: null };
  }

  if (updates.operator !== undefined) {
    return { operator: updates.operator, values: null };
  }

  if ("rightOperand" in updates) {
    const value = updates.rightOperand?.value;
    if (value === undefined || value === "") return { values: null };
    if (Array.isArray(value)) return { values: value.length > 0 ? value : null };
    // Split by type so the array stays homogeneous (`string[] | number[]`), never `(string | number)[]`.
    const values: string[] | number[] = typeof value === "number" ? [value] : [String(value)];
    return { values };
  }

  return {};
}
