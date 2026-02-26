"use client";

import { Plus, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FilterRow, TFilterFieldType } from "@/modules/ee/analysis/lib/query-builder";
import {
  FEEDBACK_FIELDS,
  getFieldById,
  getFilterOperatorsForType,
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
}

const fieldOptions = [
  ...FEEDBACK_FIELDS.dimensions.map((d) => ({
    value: d.id,
    label: d.label,
    type: d.type,
  })),
  ...FEEDBACK_FIELDS.measures.map((m) => ({
    value: m.id,
    label: m.label,
    type: "number" as TFilterFieldType,
  })),
];

export function FiltersPanel({
  filters,
  filterLogic,
  onFiltersChange,
  onFilterLogicChange,
  hideTitle = false,
}: Readonly<FiltersPanelProps>) {
  const { t } = useTranslation();

  const handleAddFilter = () => {
    const firstField = fieldOptions[0];
    onFiltersChange([
      ...filters,
      {
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
    // Reset values if operator changed to set/notSet
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

    const isNumericInput =
      fieldType === "number" &&
      (filter.operator === "gt" ||
        filter.operator === "gte" ||
        filter.operator === "lt" ||
        filter.operator === "lte");

    return (
      <Input
        type={isNumericInput ? "number" : "text"}
        placeholder={t("environments.analysis.charts.enter_value")}
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
        <div className={`flex items-center ${hideTitle ? "justify-end" : "justify-between"}`}>
          {!hideTitle && (
            <h3 className="text-md font-semibold text-gray-900">
              {t("environments.analysis.charts.filters")}
            </h3>
          )}
          <Select value={filterLogic} onValueChange={(value) => onFilterLogicChange(value as "and" | "or")}>
            <SelectTrigger className="w-[100px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">{t("common.and")}</SelectItem>
              <SelectItem value="or">{t("environments.analysis.charts.or_filter_logic")}</SelectItem>
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
            <div key={filter.operator + index} className="flex items-center gap-2">
              <Select
                value={filter.field}
                onValueChange={(value) => {
                  const newField = getFieldById(value);
                  const newType = (newField?.type || "string") as TFilterFieldType;
                  const newOperators = getFilterOperatorsForType(newType);
                  handleUpdateFilter(index, {
                    field: value,
                    operator: newOperators[0] || "equals",
                    values: null,
                  });
                }}>
                <SelectTrigger className="w-[200px] bg-white">
                  <SelectValue placeholder={t("environments.analysis.charts.select_field")} />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                      {op === "equals" && t("environments.analysis.charts.equals")}
                      {op === "notEquals" && t("environments.analysis.charts.not_equals")}
                      {op === "contains" && t("environments.analysis.charts.contains")}
                      {op === "notContains" && t("environments.analysis.charts.not_contains")}
                      {op === "set" && t("environments.analysis.charts.is_set")}
                      {op === "notSet" && t("environments.analysis.charts.is_not_set")}
                      {op === "gt" && t("environments.analysis.charts.greater_than")}
                      {op === "gte" && t("environments.analysis.charts.greater_than_or_equal")}
                      {op === "lt" && t("environments.analysis.charts.less_than")}
                      {op === "lte" && t("environments.analysis.charts.less_than_or_equal")}
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
                className="h-8 w-8">
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          );
        })}

        {hasFilters && (
          <Button type="button" variant="outline" size="sm" onClick={handleAddFilter} className="h-8">
            <Plus className="h-4 w-4" />
            {t("environments.analysis.charts.add_filter")}
          </Button>
        )}
      </div>
    </div>
  );
}
