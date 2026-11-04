"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createId } from "@paralleldrive/cuid2";
import type { TFunction } from "i18next";
import { GripVerticalIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TDatasetFieldsStatus } from "@/modules/ee/analysis/charts/hooks/chart-field-catalog-query";
import {
  getFilterFieldOptions,
  getFilterOperatorLabel,
} from "@/modules/ee/analysis/charts/lib/filter-conditions";
import { ListLoadError } from "@/modules/ee/analysis/components/list-load-error";
import { isEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-data-fields";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";
import { getTranslatedFieldLabel } from "@/modules/ee/analysis/lib/schema-definition";
import { Button } from "@/modules/ui/components/button";
import { ConditionsEditor } from "@/modules/ui/components/conditions-editor";
import type {
  TConditionsEditorCallbacks,
  TConditionsEditorConfig,
} from "@/modules/ui/components/conditions-editor/types";
import { Input } from "@/modules/ui/components/input";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { FilterChip } from "@/modules/ui/components/table-toolbar/components/filter-chip";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import {
  getEditableFilterChipValue,
  reorderDashboardFilters,
  saveDashboardFilterAt,
} from "../lib/dashboard-filter-editing";
import {
  MAX_DASHBOARD_FILTERS,
  MAX_DASHBOARD_FILTER_LABEL_LENGTH,
  type TDashboardFilter,
  type TDashboardFilterOperator,
  getDashboardFilterField,
  getDashboardFilterOperators,
} from "../lib/dashboard-filters";

/** The dashboard datasets' embedded-data keys, and whether they are still loading or failed. */
export type TDashboardFilterFields = TDatasetFieldsStatus & {
  embeddedFields: readonly TEmbeddedChartField[];
};

const FILTER_GROUP_ID = "dashboard-filter";
const FILTER_ROW_ID = "dashboard-filter-row";

/**
 * How a filter's field reads: an embedded-data key by its own name (from the dashboard's datasets), any
 * other field by its translated label. An embedded key not (yet) in the catalogs has no name to show, so
 * it reads as `undefined` rather than as its member name.
 */
const getFieldLabel = (
  field: string,
  embeddedFields: readonly TEmbeddedChartField[],
  t: TFunction
): string | undefined => {
  if (isEmbeddedMemberName(field)) return embeddedFields.find(({ name }) => name === field)?.key;
  return getDashboardFilterField(field) ? getTranslatedFieldLabel(field, t) : undefined;
};

/**
 * One filter's definition, as a row of the chart builder's conditions editor: the field and operator
 * pickers, with the label the top bar shows in the value's place. The label follows the field until it
 * is edited. Nothing is applied until Save; closing the popover discards the changes. The filter is
 * removed with its chip's ×, the one way to remove it.
 */
const DashboardFilterForm = ({
  initial,
  fields,
  onSave,
}: Readonly<{
  initial: TDashboardFilter | null;
  fields: TDashboardFilterFields;
  onSave: (filter: TDashboardFilter) => void;
}>) => {
  const { t } = useTranslation();
  const [field, setField] = useState(initial?.field ?? "");
  const [operator, setOperator] = useState<TDashboardFilterOperator | "">(initial?.operator ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [labelEdited, setLabelEdited] = useState(Boolean(initial));

  if (fields.isLoading) {
    return (
      <div className="flex w-80 justify-center p-6">
        <LoadingSpinner className="size-5" />
      </div>
    );
  }
  if (fields.error) {
    return (
      <div className="w-80 p-3">
        <ListLoadError error={fields.error} onRetry={fields.retry} />
      </div>
    );
  }

  // The chart builder's field picker, less measures and answer rules: a dashboard filter narrows
  // records, not groups, and an answer rule names one dataset's question.
  const fieldOptions = getFilterFieldOptions(t, {
    embeddedFields: fields.embeddedFields,
    answerQuestions: [],
  }).filter((group) => group.value === "dimensions" || group.value === "embeddedData");
  const trimmedLabel = label.trim();
  const canSave = Boolean(field && operator && trimmedLabel);

  const config: TConditionsEditorConfig = {
    getLeftOperandOptions: () => fieldOptions,
    getOperatorOptions: () =>
      (field ? getDashboardFilterOperators(field) : []).map((value) => ({
        value,
        label: getFilterOperatorLabel(value, t),
      })),
    getValueProps: () => ({ show: false, options: [] }),
    // A field change resets the operator; `onUpdateCondition` picks the field's own default.
    getDefaultOperator: () => "",
    formatLeftOperandValue: (condition) => condition.leftOperand.value,
    // Everyone picks the value; what the editor sets in its place is the label the top bar shows.
    renderValueInput: () => (
      <Input
        aria-label={t("common.label")}
        placeholder={t("common.label")}
        value={label}
        maxLength={MAX_DASHBOARD_FILTER_LABEL_LENGTH}
        onChange={(event) => {
          setLabel(event.target.value);
          setLabelEdited(true);
        }}
        className="bg-white"
      />
    ),
    showWhenLabel: false,
    hideConditionMenu: true,
  };

  const callbacks: TConditionsEditorCallbacks = {
    onAddConditionBelow: () => undefined,
    onRemoveCondition: () => undefined,
    onDuplicateCondition: () => undefined,
    onToggleGroupConnector: () => undefined,
    onUpdateCondition: (_id, updates) => {
      if (updates.leftOperand) {
        const next = updates.leftOperand.value;
        setField(next);
        setOperator(getDashboardFilterOperators(next)[0] ?? "");
        if (!labelEdited) setLabel(getFieldLabel(next, fields.embeddedFields, t) ?? "");
      } else if (updates.operator !== undefined) {
        setOperator(updates.operator as TDashboardFilterOperator);
      }
    },
  };

  return (
    <form
      className="flex w-80 flex-col gap-3 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave || !operator) return;
        onSave({ id: initial?.id ?? createId(), field, operator, label: trimmedLabel });
      }}>
      <ConditionsEditor
        conditions={{
          id: FILTER_GROUP_ID,
          connector: "and",
          conditions: [{ id: FILTER_ROW_ID, leftOperand: { value: field, type: "static" }, operator }],
        }}
        config={config}
        callbacks={callbacks}
        isConnectorLocked
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!canSave}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
};

/**
 * One pinned filter in edit mode: the view mode's chip, opening its definition, with a grip to drag it
 * into place (or move it with the keyboard). Its × removes it from the draft; Cancel brings it back.
 */
const EditableFilterChip = ({
  filter,
  filters,
  fields,
  onFiltersChange,
}: Readonly<{
  filter: TDashboardFilter;
  filters: readonly TDashboardFilter[];
  fields: TDashboardFilterFields;
  onFiltersChange: (filters: TDashboardFilter[]) => void;
}>) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: filter.id,
  });
  const fieldLabel = getFieldLabel(filter.field, fields.embeddedFields, t);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="flex items-center">
      <button
        type="button"
        className="focus-visible:ring-ring flex h-10 w-5 shrink-0 cursor-grab items-center justify-center rounded text-slate-400 hover:text-slate-700 focus-visible:text-slate-700 focus-visible:ring-1 focus-visible:outline-hidden active:cursor-grabbing"
        aria-label={t("workspace.analysis.dashboards.reorder_filter", { filter: filter.label })}
        {...attributes}
        {...listeners}>
        <GripVerticalIcon className="size-4" />
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FilterChip
            size="md"
            label={filter.label}
            value={getEditableFilterChipValue(fieldLabel, getFilterOperatorLabel(filter.operator, t))}
            accessibleName={filter.label}
            onRemove={() => onFiltersChange(filters.filter((candidate) => candidate.id !== filter.id))}
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <DashboardFilterForm
            initial={filter}
            fields={fields}
            onSave={(next) => {
              onFiltersChange(saveDashboardFilterAt(filters, next, filters.indexOf(filter)));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

/**
 * The dashboard filters as editors change them, in edit mode: each pinned filter as the chip view mode
 * shows, dragged into order, opening its field, operator and label, and "Add filter" until the
 * dashboard holds the most it may. Changes are drafts until the dashboard is saved.
 */
export const DashboardFilterEditor = ({
  filters,
  fields,
  onFiltersChange,
}: Readonly<{
  filters: readonly TDashboardFilter[];
  /** The embedded-data keys of the dashboard's datasets (`useDashboardEmbeddedFields`). */
  fields: TDashboardFilterFields;
  onFiltersChange: (filters: TDashboardFilter[]) => void;
}>) => {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const isFull = filters.length >= MAX_DASHBOARD_FILTERS;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onFiltersChange(reorderDashboardFilters(filters, String(active.id), String(over.id)));
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filters.map(({ id }) => id)} strategy={rectSortingStrategy}>
          {filters.map((filter) => (
            <EditableFilterChip
              key={filter.id}
              filter={filter}
              filters={filters}
              fields={fields}
              onFiltersChange={onFiltersChange}
            />
          ))}
        </SortableContext>
      </DndContext>
      <Popover open={isAdding} onOpenChange={setIsAdding}>
        <TooltipRenderer
          shouldRender={isFull}
          triggerClass="inline-flex"
          tooltipContent={t("workspace.analysis.dashboards.filter_limit_reached", {
            max: MAX_DASHBOARD_FILTERS,
          })}>
          <PopoverTrigger asChild>
            <Button type="button" variant="secondary" disabled={isFull}>
              <PlusIcon />
              {t("common.add_filter")}
            </Button>
          </PopoverTrigger>
        </TooltipRenderer>
        <PopoverContent align="start" className="w-auto p-0">
          <DashboardFilterForm
            initial={null}
            fields={fields}
            onSave={(filter) => {
              onFiltersChange(saveDashboardFilterAt(filters, filter, filters.length));
              setIsAdding(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
};
