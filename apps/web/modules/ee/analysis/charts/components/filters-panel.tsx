"use client";

import { useTranslation } from "react-i18next";
import { FilterDateInput } from "@/modules/ee/analysis/charts/components/filter-date-input";
import { FilterValueCombobox } from "@/modules/ee/analysis/charts/components/filter-value-combobox";
import {
  CHART_FILTER_ROOT_ID,
  createDefaultFilterRow,
  getFilterFieldOptions,
  getFilterFieldType,
  getFilterOperatorLabel,
  toConditionGroup,
  toFilterRowUpdates,
} from "@/modules/ee/analysis/charts/lib/filter-conditions";
import {
  type FilterNode,
  type FilterRow,
  duplicateFilterNode,
  insertFilterNodeAfter,
  removeFilterNode,
  toggleFilterGroupLogic,
  updateFilterRow,
  wrapFilterNodeInGroup,
} from "@/modules/ee/analysis/lib/query-builder";
import {
  EMOTIONS_DIMENSION_ID,
  EMOTION_VALUES,
  getFilterOperatorsForType,
  getTranslatedDimensionValueLabel,
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

interface FiltersPanelProps {
  filters: FilterNode[];
  filterLogic: "and" | "or";
  onFiltersChange: (filters: FilterNode[]) => void;
  onFilterLogicChange: (logic: "and" | "or") => void;
  // When provided, low-cardinality string dimensions offer a value pick-list
  // (fetched per data source) instead of free-text entry for exact-match operators.
  workspaceId?: string;
  feedbackDirectoryId?: string | null;
}

const RANGE_OPERATORS = new Set(["gt", "gte", "lt", "lte"]);

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
}: Readonly<FiltersPanelProps>) {
  const { t } = useTranslation();

  const updateRow = (id: string, updates: Partial<FilterRow>) =>
    onFiltersChange(updateFilterRow(filters, id, updates));

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
      isSelectableValueDimension(field) && (operator === "equals" || operator === "notEquals");

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
    getLeftOperandOptions: () => getFilterFieldOptions(t),
    getOperatorOptions: (condition) =>
      getFilterOperatorsForType(getFilterFieldType(condition.leftOperand.value)).map((operator) => ({
        value: operator,
        label: getFilterOperatorLabel(operator, t),
      })),
    getValueProps: (condition) => {
      if (condition.leftOperand.value !== EMOTIONS_DIMENSION_ID) {
        return { show: false, options: [] };
      }
      return {
        show: true,
        options: [
          {
            label: getTranslatedFieldLabel(EMOTIONS_DIMENSION_ID, t),
            value: EMOTIONS_DIMENSION_ID,
            options: EMOTION_VALUES.map((emotion) => ({
              value: emotion,
              label: getTranslatedDimensionValueLabel(EMOTIONS_DIMENSION_ID, emotion, t) ?? emotion,
            })),
          },
        ],
      };
    },
    // The editor resets the operator on a field change; `toFilterRowUpdates` then picks the real
    // default for the new field, so this only has to be a valid placeholder.
    getDefaultOperator: () => "equals",
    formatLeftOperandValue: (condition) => condition.leftOperand.value,
    renderValueInput,
  };

  const callbacks: TConditionsEditorCallbacks = {
    onAddConditionBelow: (id) =>
      onFiltersChange(insertFilterNodeAfter(filters, id, createDefaultFilterRow())),
    onRemoveCondition: (id) => onFiltersChange(removeFilterNode(filters, id)),
    onDuplicateCondition: (id) => onFiltersChange(duplicateFilterNode(filters, id)),
    onCreateGroup: (id) => onFiltersChange(wrapFilterNodeInGroup(filters, id, filterLogic)),
    onUpdateCondition: (id, updates) => updateRow(id, toFilterRowUpdates(updates)),
    onToggleGroupConnector: (groupId) => {
      if (groupId === CHART_FILTER_ROOT_ID) {
        onFilterLogicChange(filterLogic === "and" ? "or" : "and");
      } else {
        onFiltersChange(toggleFilterGroupLogic(filters, groupId));
      }
    },
  };

  return (
    <div className="w-full">
      <ConditionsEditor
        conditions={toConditionGroup(filters, filterLogic)}
        config={config}
        callbacks={callbacks}
      />
    </div>
  );
}
