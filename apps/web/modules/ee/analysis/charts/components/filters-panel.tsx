"use client";

import { Plus, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterDateInput } from "@/modules/ee/analysis/charts/components/filter-date-input";
import { FilterFieldCombobox } from "@/modules/ee/analysis/charts/components/filter-field-combobox";
import { FilterValueCombobox } from "@/modules/ee/analysis/charts/components/filter-value-combobox";
import {
  type FilterGroup,
  type FilterNode,
  type FilterRow,
  type TFilterFieldType,
  addFilterNode,
  isFilterGroup,
  removeFilterNode,
  updateFilterGroupLogic,
  updateFilterRow,
} from "@/modules/ee/analysis/lib/query-builder";
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

interface FieldOption {
  value: string;
  label: string;
  type: TFilterFieldType | "boolean";
  isGenerated: boolean;
}

interface FiltersPanelProps {
  filters: FilterNode[];
  filterLogic: "and" | "or";
  onFiltersChange: (filters: FilterNode[]) => void;
  onFilterLogicChange: (logic: "and" | "or") => void;
  hideTitle?: boolean;
  // When provided, low-cardinality string dimensions offer a value pick-list
  // (fetched per data source) instead of free-text entry for exact-match operators.
  workspaceId?: string;
  feedbackDirectoryId?: string | null;
}

interface FilterNodeHandlers {
  onUpdateRow: (id: string, updates: Partial<FilterRow>) => void;
  onRemoveNode: (id: string) => void;
  onAddRowToGroup: (groupId: string) => void;
  onGroupLogicChange: (groupId: string, logic: "and" | "or") => void;
}

interface FilterConditionRowProps extends FilterNodeHandlers {
  filter: FilterRow;
  fieldOptions: FieldOption[];
  workspaceId?: string;
  feedbackDirectoryId?: string | null;
}

function LogicSelect({
  value,
  onChange,
}: Readonly<{ value: "and" | "or"; onChange: (logic: "and" | "or") => void }>) {
  const { t } = useTranslation();

  return (
    <Select value={value} onValueChange={(next) => onChange(next as "and" | "or")}>
      <SelectTrigger className="w-[100px] bg-white">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="and">{t("workspace.analysis.charts.and_filter_logic")}</SelectItem>
        <SelectItem value="or">{t("workspace.analysis.charts.or_filter_logic")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function FilterConditionRow({
  filter,
  fieldOptions,
  workspaceId,
  feedbackDirectoryId,
  onUpdateRow,
  onRemoveNode,
}: Readonly<FilterConditionRowProps>) {
  const { t } = useTranslation();
  const field = getFieldById(filter.field);
  const fieldType = (field?.type || "string") as TFilterFieldType;
  const operators = getFilterOperatorsForType(fieldType);

  const getValueInput = () => {
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
          onChange={(value) => onUpdateRow(filter.id, { values: value ? [value] : null })}
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
          onValueChange={(value) => onUpdateRow(filter.id, { values: value ? [value] : null })}>
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
          onChange={(value) => onUpdateRow(filter.id, { values: value ? [value] : null })}
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
          onUpdateRow(filter.id, { values });
        }}
        className="min-w-0 flex-1 basis-36 bg-white"
      />
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
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
          const defaultOperator = value === EMOTIONS_DIMENSION_ID ? "contains" : newOperators[0] || "equals";
          onUpdateRow(filter.id, {
            field: value,
            operator: defaultOperator,
            values: null,
          });
        }}
      />

      <Select value={filter.operator} onValueChange={(value) => onUpdateRow(filter.id, { operator: value })}>
        <SelectTrigger className="min-w-0 flex-1 basis-32 bg-white">
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

      {getValueInput()}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("workspace.analysis.charts.remove_filter")}
        onClick={() => onRemoveNode(filter.id)}
        className="size-8 shrink-0">
        <TrashIcon className="size-4" />
      </Button>
    </div>
  );
}

interface FilterGroupCardProps extends FilterNodeHandlers {
  group: FilterGroup;
  fieldOptions: FieldOption[];
  workspaceId?: string;
  feedbackDirectoryId?: string | null;
}

function FilterGroupCard({
  group,
  fieldOptions,
  workspaceId,
  feedbackDirectoryId,
  ...handlers
}: Readonly<FilterGroupCardProps>) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <LogicSelect value={group.logic} onChange={(logic) => handlers.onGroupLogicChange(group.id, logic)} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("workspace.analysis.charts.remove_filter_group")}
          onClick={() => handlers.onRemoveNode(group.id)}
          className="size-8 shrink-0">
          <TrashIcon className="size-4" />
        </Button>
      </div>

      {group.children.map((child) => (
        <FilterNodeItem
          key={child.id}
          node={child}
          fieldOptions={fieldOptions}
          workspaceId={workspaceId}
          feedbackDirectoryId={feedbackDirectoryId}
          {...handlers}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handlers.onAddRowToGroup(group.id)}
        className="h-8">
        <Plus className="size-4" />
        {t("workspace.analysis.charts.add_filter")}
      </Button>
    </div>
  );
}

interface FilterNodeItemProps extends FilterNodeHandlers {
  node: FilterNode;
  fieldOptions: FieldOption[];
  workspaceId?: string;
  feedbackDirectoryId?: string | null;
}

function FilterNodeItem({ node, ...rest }: Readonly<FilterNodeItemProps>) {
  // Groups render recursively so a deeper tree that arrived from an AI-generated or hand-written
  // query stays visible and editable; the panel itself only ever adds one level.
  if (isFilterGroup(node)) {
    return <FilterGroupCard group={node} {...rest} />;
  }
  return <FilterConditionRow filter={node} {...rest} />;
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

  const fieldOptions: FieldOption[] = [
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

  const createFilterRow = (): FilterRow => ({
    id: crypto.randomUUID(),
    field: fieldOptions[0]?.value || "",
    operator: "equals",
    values: null,
  });

  const handlers: FilterNodeHandlers = {
    onUpdateRow: (id, updates) => onFiltersChange(updateFilterRow(filters, id, updates)),
    onRemoveNode: (id) => onFiltersChange(removeFilterNode(filters, id)),
    onAddRowToGroup: (groupId) => onFiltersChange(addFilterNode(filters, createFilterRow(), groupId)),
    onGroupLogicChange: (groupId, logic) => onFiltersChange(updateFilterGroupLogic(filters, groupId, logic)),
  };

  const handleAddFilter = () => onFiltersChange(addFilterNode(filters, createFilterRow()));

  const handleAddGroup = () =>
    onFiltersChange(
      addFilterNode(filters, {
        id: crypto.randomUUID(),
        logic: "or",
        children: [createFilterRow()],
      })
    );

  const hasFilters = filters.length > 0;
  const hasMultipleFilters = filters.length > 1;

  return (
    <div className="w-full space-y-2">
      {hasMultipleFilters && (
        <div className={`flex items-center ${hideTitle ? "justify-start" : "justify-between"}`}>
          {!hideTitle && (
            <h3 className="text-md font-semibold text-gray-900">{t("workspace.analysis.charts.filters")}</h3>
          )}
          <LogicSelect value={filterLogic} onChange={onFilterLogicChange} />
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
        {filters.map((node) => (
          <FilterNodeItem
            key={node.id}
            node={node}
            fieldOptions={fieldOptions}
            workspaceId={workspaceId}
            feedbackDirectoryId={feedbackDirectoryId}
            {...handlers}
          />
        ))}

        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleAddFilter} className="h-8">
              <Plus className="size-4" />
              {t("workspace.analysis.charts.add_filter")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleAddGroup} className="h-8">
              <Plus className="size-4" />
              {t("workspace.analysis.charts.add_filter_group")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
