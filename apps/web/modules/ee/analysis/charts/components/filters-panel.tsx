"use client";

import { Plus, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterDateInput } from "@/modules/ee/analysis/charts/components/filter-date-input";
import { FilterFieldCombobox } from "@/modules/ee/analysis/charts/components/filter-field-combobox";
import { FilterValueCombobox } from "@/modules/ee/analysis/charts/components/filter-value-combobox";
import type { FilterRow, TFilterFieldType } from "@/modules/ee/analysis/lib/query-builder";
import {
  EMOTIONS_DIMENSION_ID,
  EMOTION_VALUES,
  FEEDBACK_FIELDS,
  getFieldById,
  getFilterOperatorsForType,
  getTranslatedDimensionValueLabel,
  getTranslatedFieldLabel,
  isSelectableValueDimension,
} from "@/modules/ee/analysis/lib/schema-definition";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface FiltersPanelProps {
  filters: FilterRow[];
  filterLogic: "and" | "or";
  onFiltersChange: (filters: FilterRow[]) => void;
  onFilterLogicChange: (logic: "and" | "or") => void;
  hideTitle?: boolean;
  // When provided, low-cardinality string dimensions offer a value pick-list
  // (fetched per data source) instead of free-text entry for exact-match operators.
  workspaceId?: string;
  feedbackDirectoryId?: string | null;
}

export function FiltersPanel({
  filters,
  filterLogic,
  onFiltersChange,
  onFilterLogicChange,
  hideTitle = false,
  workspaceId,
  feedbackDirectoryId,
}: Readonly<FiltersPanelProps>) {
  const { t } = useTranslation();

  const fieldOptions = [
    ...FEEDBACK_FIELDS.dimensions.map((d) => ({
      value: d.id,
      label: getTranslatedFieldLabel(d.id, t),
      type: d.type,
      isGenerated: d.isGenerated ?? false,
    })),
    // Only continuous aggregate measures (scores + averages) make sense as filters — you
    // threshold them (e.g. NPS score > 50, average sentiment > 0.5). Count measures are
    // excluded: filtering by a count is either a no-op here or redundant with a dimension
    // filter (e.g. "Sentiment: Positive" count vs. the Sentiment dimension = "positive").
    ...FEEDBACK_FIELDS.measures
      .filter((m) => m.group === "score" || m.group === "average")
      .map((m) => ({
        value: m.id,
        label: getTranslatedFieldLabel(m.id, t),
        type: "number" as TFilterFieldType,
        isGenerated: false,
      })),
  ];

  const handleAddFilter = () => {
    const firstField = fieldOptions[0];
    onFiltersChange([
      ...filters,
      {
        id: crypto.randomUUID(),
        field: firstField?.value || "",
        operator: "equals",
        values: null,
      },
    ]);
  };

  const handleRemoveFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  const handleUpdateFilter = (index: number, updates: Partial<FilterRow>) => {
    const updated = [...filters];
    updated[index] = { ...updated[index], ...updates };
    if (updates.operator && (updates.operator === "set" || updates.operator === "notSet")) {
      updated[index].values = null;
    }
    onFiltersChange(updated);
  };

  const getValueInput = (filter: FilterRow, index: number) => {
    const field = getFieldById(filter.field);
    const fieldType = (field?.type || "string") as TFilterFieldType;

    if (filter.operator === "set" || filter.operator === "notSet") {
      return null;
    }

    const currentValue = String(filter.values?.[0] ?? "");

    // Time-type dimensions (Collected At, Created At, Updated At, Value (Date)) get a
    // date picker instead of a free-text field.
    if (fieldType === "time") {
      return (
        <FilterDateInput
          value={currentValue}
          onChange={(value) => handleUpdateFilter(index, { values: value ? [value] : null })}
        />
      );
    }

    // Emotions is a multi-label comma-set, so its values can't come from a Cube distinct
    // lookup (that returns joined combinations) and free text is error-prone. Offer the
    // fixed emotion vocabulary as a pick-list; pair with `contains` to match one emotion.
    if (filter.field === EMOTIONS_DIMENSION_ID) {
      return (
        <Select
          value={currentValue || undefined}
          onValueChange={(value) => handleUpdateFilter(index, { values: value ? [value] : null })}>
          <SelectTrigger className="w-[200px] bg-white">
            <SelectValue placeholder={t("workspace.analysis.charts.enter_value")} />
          </SelectTrigger>
          <SelectContent>
            {EMOTION_VALUES.map((emotion) => (
              <SelectItem key={emotion} value={emotion}>
                {getTranslatedDimensionValueLabel(EMOTIONS_DIMENSION_ID, emotion, t) ?? emotion}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Exact-match operators on a low-cardinality string dimension get a pick-list of
    // real stored values, so the chosen value matches exactly (no casing/whitespace drift).
    const canSelectValues =
      isSelectableValueDimension(filter.field) &&
      (filter.operator === "equals" || filter.operator === "notEquals");

    if (canSelectValues && workspaceId && feedbackDirectoryId) {
      return (
        <FilterValueCombobox
          workspaceId={workspaceId}
          feedbackDirectoryId={feedbackDirectoryId}
          dimension={filter.field}
          value={currentValue}
          onChange={(value) => handleUpdateFilter(index, { values: value ? [value] : null })}
        />
      );
    }

    const isNumericInput =
      fieldType === "number" &&
      (filter.operator === "gt" ||
        filter.operator === "gte" ||
        filter.operator === "lt" ||
        filter.operator === "lte");

    return (
      <Input
        type={isNumericInput ? "number" : "text"}
        placeholder={t("workspace.analysis.charts.enter_value")}
        value={filter.values?.[0] ?? ""}
        onChange={(e) => {
          let values: string[] | number[] | null = null;
          if (e.target.value) {
            values = isNumericInput ? [Number(e.target.value)] : [e.target.value];
          }
          handleUpdateFilter(index, { values });
        }}
        className={isNumericInput ? "w-[150px] bg-white" : "w-[200px] bg-white"}
      />
    );
  };

  const hasFilters = filters.length > 0;
  const hasMultipleFilters = filters.length > 1;

  return (
    <div className="w-full space-y-2">
      {hasMultipleFilters && (
        <div className={`flex items-center ${hideTitle ? "justify-start" : "justify-between"}`}>
          {!hideTitle && (
            <h3 className="text-md font-semibold text-gray-900">{t("workspace.analysis.charts.filters")}</h3>
          )}
          <Select value={filterLogic} onValueChange={(value) => onFilterLogicChange(value as "and" | "or")}>
            <SelectTrigger className="w-[100px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">{t("workspace.analysis.charts.and_filter_logic")}</SelectItem>
              <SelectItem value="or">{t("workspace.analysis.charts.or_filter_logic")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
        {filters.map((filter, index) => {
          const field = getFieldById(filter.field);
          const fieldType = (field?.type || "string") as "string" | "number" | "time";
          const operators = getFilterOperatorsForType(fieldType);

          return (
            <div key={filter.id} className="flex items-center gap-2">
              <FilterFieldCombobox
                options={fieldOptions}
                value={filter.field}
                onChange={(value) => {
                  const newField = getFieldById(value);
                  const newType = (newField?.type || "string") as TFilterFieldType;
                  const newOperators = getFilterOperatorsForType(newType);
                  // Emotions is multi-label: default to `contains` so a single picked
                  // emotion matches records tagged with it (equals would require an exact
                  // whole-set match).
                  const defaultOperator =
                    value === EMOTIONS_DIMENSION_ID ? "contains" : newOperators[0] || "equals";
                  handleUpdateFilter(index, {
                    field: value,
                    operator: defaultOperator,
                    values: null,
                  });
                }}
              />

              <Select
                value={filter.operator}
                onValueChange={(value) =>
                  handleUpdateFilter(index, {
                    operator: value,
                  })
                }>
                <SelectTrigger className="w-[150px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((op) => (
                    <SelectItem key={op} value={op}>
                      {op === "equals" && t("workspace.analysis.charts.equals")}
                      {op === "notEquals" && t("workspace.analysis.charts.not_equals")}
                      {op === "contains" && t("workspace.analysis.charts.contains")}
                      {op === "notContains" && t("workspace.analysis.charts.not_contains")}
                      {op === "set" && t("workspace.analysis.charts.is_set")}
                      {op === "notSet" && t("workspace.analysis.charts.is_not_set")}
                      {op === "gt" && t("workspace.analysis.charts.greater_than")}
                      {op === "gte" && t("workspace.analysis.charts.greater_than_or_equal")}
                      {op === "lt" && t("workspace.analysis.charts.less_than")}
                      {op === "lte" && t("workspace.analysis.charts.less_than_or_equal")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {getValueInput(filter, index)}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveFilter(index)}
                className="size-8">
                <TrashIcon className="size-4" />
              </Button>
            </div>
          );
        })}

        {hasFilters && (
          <Button type="button" variant="outline" size="sm" onClick={handleAddFilter} className="h-8">
            <Plus className="size-4" />
            {t("workspace.analysis.charts.add_filter")}
          </Button>
        )}
      </div>
    </div>
  );
}
