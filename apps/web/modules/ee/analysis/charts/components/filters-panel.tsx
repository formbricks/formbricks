"use client";

import { useTranslation } from "react-i18next";
import { HUB_EMOTION_VALUES } from "@formbricks/types/feedback-source";
import { FilterDateInput } from "@/modules/ee/analysis/charts/components/filter-date-input";
import { FilterValueCombobox } from "@/modules/ee/analysis/charts/components/filter-value-combobox";
import {
  BOOLEAN_DIMENSION_VALUES,
  getChartDimensionValueLabel,
} from "@/modules/ee/analysis/charts/lib/dimension-value-label";
import {
  CHART_FILTER_ROOT_ID,
  type TDatasetFilterFields,
  createDefaultFilterRow,
  getAnswerOperatorOptions,
  getFilterFieldOptions,
  getFilterFieldType,
  getFilterOperatorLabel,
  getLegacyBooleanFilterValueOption,
  getNpsSegmentOptions,
  getQuestionValueOptions,
  toConditionGroup,
  toFilterRowUpdates,
} from "@/modules/ee/analysis/charts/lib/filter-conditions";
import { getAnswerBuilderQuestionId } from "@/modules/ee/analysis/lib/answer-filter";
import { isEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-data-fields";
import {
  type FilterNode,
  type FilterRow,
  duplicateFilterNode,
  insertFilterNodeAfter,
  normalizeNpsSegmentRows,
  removeFilterNode,
  toggleFilterGroupLogic,
  updateFilterRow,
  wrapFilterNodeInGroup,
} from "@/modules/ee/analysis/lib/query-builder";
import {
  NPS_SEGMENT_OPERATOR,
  QUESTION_ID_MEMBER,
  isNpsAnswerQuestion,
} from "@/modules/ee/analysis/lib/question-filter";
import {
  EMOTIONS_DIMENSION_ID,
  VALUE_BAND_DIMENSION_ID,
  VALUE_BAND_VALUES,
  getFilterOperatorsForType,
  getTranslatedFieldLabel,
  isSelectableValueDimension,
} from "@/modules/ee/analysis/lib/schema-definition";
import { ConditionsEditor } from "@/modules/ui/components/conditions-editor";
import type {
  TConditionsEditorCallbacks,
  TConditionsEditorConfig,
  TGenericCondition,
} from "@/modules/ui/components/conditions-editor/types";
import { Input } from "@/modules/ui/components/input";
import type { TComboboxGroupedOption } from "@/modules/ui/components/input-combo-box";

interface FiltersPanelProps {
  filters: FilterNode[];
  filterLogic: "and" | "or";
  onFiltersChange: (filters: FilterNode[]) => void;
  onFilterLogicChange: (logic: "and" | "or") => void;
  // When provided, low-cardinality string dimensions offer a value pick-list
  // (fetched per data source) instead of free-text entry for exact-match operators.
  workspaceId?: string;
  feedbackDirectoryId?: string | null;
  /** The dataset's embedded-data keys and answerable questions, offered as filter fields. */
  datasetFields?: TDatasetFilterFields;
}

const RANGE_OPERATORS = new Set(["gt", "gte", "lt", "lte"]);

// Only exact-match operators get the band pick-list; `contains` and the rest keep free text.
const isFixedValueBandCondition = (field: string, operator: string): boolean =>
  field === VALUE_BAND_DIMENSION_ID && (operator === "equals" || operator === "notEquals");

const isExactMatchOperator = (operator: string): boolean => operator === "equals" || operator === "notEquals";

const isBooleanPick = (field: string, operator: string): boolean =>
  isExactMatchOperator(operator) && getFilterFieldType(field) === "boolean";

/**
 * Chart filters drawn with the same `ConditionsEditor` as survey logic and quotas: connector
 * gutter, per-row menu (add below, remove, duplicate, create group), nested groups. Only the value
 * control is chart-specific — date picker, stored-value lookup, or a plain input.
 */
export function FiltersPanel({
  filters,
  filterLogic,
  onFiltersChange,
  onFilterLogicChange,
  workspaceId,
  feedbackDirectoryId,
  datasetFields = { embeddedFields: [], answerQuestions: [] },
}: Readonly<FiltersPanelProps>) {
  const { t } = useTranslation();
  const questions = datasetFields.questions ?? [];

  // A saved NPS segment comes back from the query as "is any of 0…6"; once the dataset's questions say
  // which are NPS, it is shown — and edited — as the segment again. Same query either way (ENG-7323).
  const npsQuestionIds = new Set(
    datasetFields.answerQuestions.filter(isNpsAnswerQuestion).map((question) => question.id)
  );
  const shownFilters = normalizeNpsSegmentRows(filters, (questionId) => npsQuestionIds.has(questionId));

  // A question filter picks from the dataset's questions while it tests one exact id (ENG-7323).
  const isQuestionPick = (field: string, operator: string) =>
    field === QUESTION_ID_MEMBER && isExactMatchOperator(operator) && questions.length > 0;

  const answerQuestionOf = (field: string) => {
    const questionId = getAnswerBuilderQuestionId(field);
    return questionId
      ? datasetFields.answerQuestions.find((question) => question.id === questionId)
      : undefined;
  };

  const updateRow = (id: string, updates: Partial<FilterRow>) =>
    onFiltersChange(updateFilterRow(shownFilters, id, updates));

  // One option group per fixed-vocabulary dimension, labelled with the dimension's own name.
  const fixedVocabularyGroup = (dimensionId: string, values: readonly string[]): TComboboxGroupedOption => ({
    label: getTranslatedFieldLabel(dimensionId, t),
    value: dimensionId,
    options: values.map((value) => ({
      value,
      label: getChartDimensionValueLabel(dimensionId, value, t) ?? value,
    })),
  });

  const renderValueInput = (condition: TGenericCondition) => {
    const field = condition.leftOperand.value;
    const { operator } = condition;

    if (operator === "set" || operator === "notSet") {
      return null;
    }

    // Emotions is a multi-label comma-set, so its values can't come from a Cube distinct lookup
    // (that returns joined combinations) and free text is error-prone. The editor's own combobox
    // offers the fixed emotion vocabulary (see `getValueProps`); pair with `contains` to match one.
    if (field === EMOTIONS_DIMENSION_ID) {
      return undefined;
    }

    // The band vocabulary is fixed and computed by Cube, so there is nothing to look up: the editor's
    // combobox offers the six tokens (a distinct-value lookup would also return the NULL band).
    if (isFixedValueBandCondition(field, operator)) {
      return undefined;
    }

    if (isBooleanPick(field, operator)) {
      return undefined;
    }

    // An answer rule picks from its question's options in the editor's combobox (`getValueProps`).
    if (getAnswerBuilderQuestionId(field)) {
      return undefined;
    }

    // A question filter picks the question by label in the editor's combobox (`getValueProps`).
    if (isQuestionPick(field, operator)) {
      return undefined;
    }

    const fieldType = getFilterFieldType(field);
    const currentValue = String(condition.rightOperand?.value ?? "");
    const onValueChange = (value: string | null) =>
      updateRow(condition.id, { values: value ? [value] : null });

    // Time-type dimensions (Collected At, Created At, Updated At, Value (Date)) get a date picker.
    if (fieldType === "time") {
      return <FilterDateInput value={currentValue} onChange={onValueChange} />;
    }

    // Exact-match operators on a low-cardinality string dimension get a pick-list of real stored
    // values, so the chosen value matches exactly (no casing/whitespace drift).
    const canSelectValues =
      (isSelectableValueDimension(field) || isEmbeddedMemberName(field)) &&
      (operator === "equals" || operator === "notEquals");

    if (canSelectValues && workspaceId && feedbackDirectoryId) {
      return (
        <FilterValueCombobox
          workspaceId={workspaceId}
          feedbackDirectoryId={feedbackDirectoryId}
          dimension={field}
          value={currentValue}
          onChange={onValueChange}
        />
      );
    }

    const isNumericInput = fieldType === "number" && RANGE_OPERATORS.has(operator);

    return (
      <Input
        type={isNumericInput ? "number" : "text"}
        placeholder={t("workspace.analysis.charts.enter_value")}
        value={currentValue}
        onChange={(e) => {
          let values: string[] | number[] | null = null;
          if (e.target.value) {
            values = isNumericInput ? [Number(e.target.value)] : [e.target.value];
          }
          updateRow(condition.id, { values });
        }}
        className="bg-white"
      />
    );
  };

  const config: TConditionsEditorConfig = {
    getLeftOperandOptions: () => getFilterFieldOptions(t, datasetFields),
    getOperatorOptions: (condition) =>
      getAnswerBuilderQuestionId(condition.leftOperand.value)
        ? getAnswerOperatorOptions(answerQuestionOf(condition.leftOperand.value), t)
        : getFilterOperatorsForType(getFilterFieldType(condition.leftOperand.value)).map((operator) => ({
            value: operator,
            label: getFilterOperatorLabel(operator, t),
          })),
    getValueProps: (condition) => {
      const field = condition.leftOperand.value;
      if (field === EMOTIONS_DIMENSION_ID) {
        return { show: true, options: [fixedVocabularyGroup(EMOTIONS_DIMENSION_ID, HUB_EMOTION_VALUES)] };
      }
      if (isFixedValueBandCondition(field, condition.operator)) {
        return { show: true, options: [fixedVocabularyGroup(VALUE_BAND_DIMENSION_ID, VALUE_BAND_VALUES)] };
      }
      if (isBooleanPick(field, condition.operator)) {
        const group = fixedVocabularyGroup(field, BOOLEAN_DIMENSION_VALUES);
        const savedOption = getLegacyBooleanFilterValueOption(condition.rightOperand?.value);
        if (savedOption) group.options.push(savedOption);
        return { show: true, options: [group] };
      }
      if (isQuestionPick(field, condition.operator)) {
        const current = condition.rightOperand?.value;
        return {
          show: true,
          options: [
            {
              label: t("workspace.analysis.charts.question_filter_field"),
              value: QUESTION_ID_MEMBER,
              options: getQuestionValueOptions(questions, typeof current === "string" ? current : undefined),
            },
          ],
        };
      }
      const question = answerQuestionOf(field);
      if (question && condition.operator === NPS_SEGMENT_OPERATOR) {
        return {
          show: true,
          options: [{ label: question.label, value: question.id, options: getNpsSegmentOptions(t) }],
        };
      }
      if (question) {
        return {
          show: true,
          options: [{ label: question.label, value: question.id, options: question.options }],
        };
      }
      return { show: false, options: [] };
    },
    // The editor resets the operator on a field change; `toFilterRowUpdates` then picks the real
    // default for the new field, so this only has to be a valid placeholder.
    getDefaultOperator: () => "equals",
    formatLeftOperandValue: (condition) => condition.leftOperand.value,
    renderValueInput,
  };

  const callbacks: TConditionsEditorCallbacks = {
    onAddConditionBelow: (id) =>
      onFiltersChange(insertFilterNodeAfter(shownFilters, id, createDefaultFilterRow())),
    onRemoveCondition: (id) => onFiltersChange(removeFilterNode(shownFilters, id)),
    onDuplicateCondition: (id) => onFiltersChange(duplicateFilterNode(shownFilters, id)),
    onCreateGroup: (id) => onFiltersChange(wrapFilterNodeInGroup(shownFilters, id, filterLogic)),
    onUpdateCondition: (id, updates) => updateRow(id, toFilterRowUpdates(updates)),
    onToggleGroupConnector: (groupId) => {
      if (groupId === CHART_FILTER_ROOT_ID) {
        onFilterLogicChange(filterLogic === "and" ? "or" : "and");
      } else {
        onFiltersChange(toggleFilterGroupLogic(shownFilters, groupId));
      }
    },
  };

  return (
    <div className="w-full">
      <ConditionsEditor
        conditions={toConditionGroup(shownFilters, filterLogic)}
        config={config}
        callbacks={callbacks}
      />
    </div>
  );
}
