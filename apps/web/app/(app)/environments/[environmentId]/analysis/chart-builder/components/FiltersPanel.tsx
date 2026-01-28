"use client";

import { Plus, TrashIcon } from "lucide-react";
import { Button } from "@/modules/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Input } from "@/modules/ui/components/input";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import { FEEDBACK_FIELDS, getFilterOperatorsForType, getFieldById } from "../lib/schema-definition";
import { FilterRow } from "../lib/query-builder";

interface FiltersPanelProps {
  filters: FilterRow[];
  filterLogic: "and" | "or";
  onFiltersChange: (filters: FilterRow[]) => void;
  onFilterLogicChange: (logic: "and" | "or") => void;
}

export function FiltersPanel({
  filters,
  filterLogic,
  onFiltersChange,
  onFilterLogicChange,
}: FiltersPanelProps) {
  const fieldOptions = [
    ...FEEDBACK_FIELDS.dimensions.map((d) => ({
      value: d.id,
      label: d.label,
      type: d.type,
    })),
    ...FEEDBACK_FIELDS.measures.map((m) => ({
      value: m.id,
      label: m.label,
      type: m.type === "count" ? "number" : "number",
    })),
  ];

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
    const fieldType = field?.type || "string";
    const operators = getFilterOperatorsForType(fieldType as "string" | "number" | "time");

    // For set/notSet operators, no value input needed
    if (filter.operator === "set" || filter.operator === "notSet") {
      return null;
    }

    // For number fields with comparison operators, use number input
    if (fieldType === "number" && (filter.operator === "gt" || filter.operator === "gte" || filter.operator === "lt" || filter.operator === "lte")) {
      return (
        <Input
          type="number"
          placeholder="Enter value"
          value={filter.values?.[0] || ""}
          onChange={(e) =>
            handleUpdateFilter(index, {
              values: e.target.value ? [Number(e.target.value)] : null,
            })
          }
          className="w-[150px]"
        />
      );
    }

    // For equals/notEquals with string fields, allow single value
    if ((filter.operator === "equals" || filter.operator === "notEquals") && fieldType === "string") {
      return (
        <Input
          placeholder="Enter value"
          value={filter.values?.[0] || ""}
          onChange={(e) =>
            handleUpdateFilter(index, {
              values: e.target.value ? [e.target.value] : null,
            })
          }
          className="w-[200px]"
        />
      );
    }

    // For contains/notContains, allow multiple values (multi-select)
    if (filter.operator === "contains" || filter.operator === "notContains") {
      // For now, use a simple input - could be enhanced with multi-select
      return (
        <Input
          placeholder="Enter value"
          value={filter.values?.[0] || ""}
          onChange={(e) =>
            handleUpdateFilter(index, {
              values: e.target.value ? [e.target.value] : null,
            })
          }
          className="w-[200px]"
        />
      );
    }

    // Default: single value input
    return (
      <Input
        placeholder="Enter value"
        value={filter.values?.[0] || ""}
        onChange={(e) =>
          handleUpdateFilter(index, {
            values: e.target.value ? [e.target.value] : null,
          })
        }
        className="w-[200px]"
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
            5
          </span>
          <h3 className="font-medium text-gray-900">Filters</h3>
        </div>
        <Select value={filterLogic} onValueChange={(value) => onFilterLogicChange(value as "and" | "or")}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="and">AND</SelectItem>
            <SelectItem value="or">OR</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="ml-8 space-y-3">
        {filters.map((filter, index) => {
          const field = getFieldById(filter.field);
          const fieldType = field?.type || "string";
          const operators = getFilterOperatorsForType(fieldType as "string" | "number" | "time");

          return (
            <div
              key={index}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
              <Select
                value={filter.field}
                onValueChange={(value) => {
                  const newField = getFieldById(value);
                  const newType = newField?.type || "string";
                  const newOperators = getFilterOperatorsForType(newType as "string" | "number" | "time");
                  handleUpdateFilter(index, {
                    field: value,
                    operator: newOperators[0] || "equals",
                    values: null,
                  });
                }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select field" />
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
                    operator: value as FilterRow["operator"],
                  })
                }>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((op) => (
                    <SelectItem key={op} value={op}>
                      {op === "equals" && "equals"}
                      {op === "notEquals" && "not equals"}
                      {op === "contains" && "contains"}
                      {op === "notContains" && "not contains"}
                      {op === "set" && "is set"}
                      {op === "notSet" && "is not set"}
                      {op === "gt" && "greater than"}
                      {op === "gte" && "greater than or equal"}
                      {op === "lt" && "less than"}
                      {op === "lte" && "less than or equal"}
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

        <Button type="button" variant="outline" size="sm" onClick={handleAddFilter} className="h-8">
          <Plus className="h-4 w-4" />
          Add Filter
        </Button>
      </div>
    </div>
  );
}
