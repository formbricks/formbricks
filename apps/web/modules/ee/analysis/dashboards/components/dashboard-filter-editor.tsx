"use client";

import { createId } from "@paralleldrive/cuid2";
import type { TFunction } from "i18next";
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getFilterFieldOptions,
  getFilterOperatorLabel,
} from "@/modules/ee/analysis/charts/lib/filter-conditions";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";
import { getTranslatedFieldLabel } from "@/modules/ee/analysis/lib/schema-definition";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";
import { Label } from "@/modules/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { FilterChip } from "@/modules/ui/components/table-toolbar/components/filter-chip";
import {
  MAX_DASHBOARD_FILTERS,
  MAX_DASHBOARD_FILTER_LABEL_LENGTH,
  type TDashboardFilter,
  type TDashboardFilterOperator,
  getDashboardFilterField,
  getDashboardFilterOperators,
} from "../lib/dashboard-filters";

/** Move the filter at `index` one place towards `direction`, or leave the list as it is at an end. */
export const moveDashboardFilter = (
  filters: readonly TDashboardFilter[],
  index: number,
  direction: -1 | 1
): TDashboardFilter[] => {
  const target = index + direction;
  if (target < 0 || target >= filters.length) return [...filters];
  const next = [...filters];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/**
 * How a filter's field reads: an embedded-data key by its own name (from the dashboard's datasets), any
 * other field by its translated label.
 */
const getFieldLabel = (
  field: string,
  embeddedFields: readonly TEmbeddedChartField[],
  t: TFunction
): string => {
  const embedded = embeddedFields.find(({ name }) => name === field);
  if (embedded) return embedded.key;
  return getDashboardFilterField(field) ? getTranslatedFieldLabel(field, t) : field;
};

interface DashboardFilterFormProps {
  initial: TDashboardFilter | null;
  /** The embedded-data keys of the dashboard's datasets, offered after the shared fields. */
  embeddedFields: readonly TEmbeddedChartField[];
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onSave: (filter: TDashboardFilter) => void;
  onRemove?: () => void;
  onMove?: (direction: -1 | 1) => void;
}

/**
 * One filter's definition: the field and operator, picked with the chart builder's own pickers, and the
 * label the top bar shows. The label follows the field until it is edited.
 */
const DashboardFilterForm = ({
  initial,
  embeddedFields,
  canMoveLeft,
  canMoveRight,
  onSave,
  onRemove,
  onMove,
}: Readonly<DashboardFilterFormProps>) => {
  const { t } = useTranslation();
  const [field, setField] = useState(initial?.field ?? "");
  const [operator, setOperator] = useState<TDashboardFilterOperator | "">(initial?.operator ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [labelEdited, setLabelEdited] = useState(Boolean(initial));

  // The chart builder's field picker, less measures and answer rules: a dashboard filter narrows records,
  // not groups, and an answer rule names one dataset's question.
  const fieldOptions = getFilterFieldOptions(t, { embeddedFields, answerQuestions: [] }).filter(
    (group) => group.value === "dimensions" || group.value === "embeddedData"
  );
  const operators = field ? getDashboardFilterOperators(field) : [];
  const trimmedLabel = label.trim();
  const canSave = Boolean(field && operator && trimmedLabel);

  return (
    <form
      className="flex w-80 flex-col gap-3 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave || !operator) return;
        onSave({ id: initial?.id ?? createId(), field, operator, label: trimmedLabel });
      }}>
      <div className="flex flex-col gap-1">
        <Label>{t("workspace.analysis.charts.field")}</Label>
        <InputCombobox
          id="dashboard-filter-field"
          aria-label={t("workspace.analysis.charts.field")}
          showSearch
          searchPlaceholder={t("common.search")}
          groupedOptions={fieldOptions}
          value={field || null}
          onChangeValue={(value) => {
            const next = String(value);
            setField(next);
            setOperator(getDashboardFilterOperators(next)[0] ?? "");
            if (!labelEdited) setLabel(getFieldLabel(next, embeddedFields, t));
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label>{t("workspace.analysis.dashboards.filter_operator")}</Label>
        <InputCombobox
          id="dashboard-filter-operator"
          aria-label={t("workspace.analysis.dashboards.filter_operator")}
          showSearch={false}
          options={operators.map((value) => ({ value, label: getFilterOperatorLabel(value, t) }))}
          value={operator || null}
          disabled={!field}
          onChangeValue={(value) => setOperator(value as TDashboardFilterOperator)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="dashboard-filter-label">{t("common.label")}</Label>
        <Input
          id="dashboard-filter-label"
          value={label}
          maxLength={MAX_DASHBOARD_FILTER_LABEL_LENGTH}
          onChange={(event) => {
            setLabel(event.target.value);
            setLabelEdited(true);
          }}
          className="bg-white"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {onMove && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!canMoveLeft}
                aria-label={t("workspace.analysis.dashboards.filter_move_left")}
                onClick={() => onMove(-1)}>
                <ArrowLeftIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!canMoveRight}
                aria-label={t("workspace.analysis.dashboards.filter_move_right")}
                onClick={() => onMove(1)}>
                <ArrowRightIcon />
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onRemove && (
            <Button type="button" variant="secondary" size="sm" onClick={onRemove}>
              {t("common.remove")}
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!canSave}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </form>
  );
};

/** One pinned filter in edit mode: a chip that opens its definition. */
const EditableFilterChip = ({
  filter,
  index,
  filters,
  embeddedFields,
  onFiltersChange,
}: Readonly<{
  filter: TDashboardFilter;
  index: number;
  filters: readonly TDashboardFilter[];
  embeddedFields: readonly TEmbeddedChartField[];
  onFiltersChange: (filters: TDashboardFilter[]) => void;
}>) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const fieldLabel = getFieldLabel(filter.field, embeddedFields, t);
  const remove = () => onFiltersChange(filters.filter((candidate) => candidate.id !== filter.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FilterChip
          className="h-10"
          label={filter.label}
          value={`${fieldLabel} ${getFilterOperatorLabel(filter.operator, t)}`}
          accessibleName={filter.label}
          onRemove={remove}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <DashboardFilterForm
          initial={filter}
          embeddedFields={embeddedFields}
          canMoveLeft={index > 0}
          canMoveRight={index < filters.length - 1}
          onMove={(direction) => onFiltersChange(moveDashboardFilter(filters, index, direction))}
          onRemove={() => {
            remove();
            setOpen(false);
          }}
          onSave={(next) => {
            onFiltersChange(filters.map((candidate) => (candidate.id === next.id ? next : candidate)));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

/**
 * The dashboard filters as editors change them, in edit mode: each pinned filter as a chip that opens its
 * field, operator and label, with reorder and remove there, and "Add filter" until the dashboard holds the
 * most it may. Changes are drafts until the dashboard is saved.
 */
export const DashboardFilterEditor = ({
  filters,
  embeddedFields = [],
  onFiltersChange,
}: Readonly<{
  filters: readonly TDashboardFilter[];
  /** The embedded-data keys of the dashboard's datasets (`useDashboardEmbeddedFields`). */
  embeddedFields?: readonly TEmbeddedChartField[];
  onFiltersChange: (filters: TDashboardFilter[]) => void;
}>) => {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const isFull = filters.length >= MAX_DASHBOARD_FILTERS;

  return (
    <>
      {filters.map((filter, index) => (
        <EditableFilterChip
          key={filter.id}
          filter={filter}
          index={index}
          filters={filters}
          embeddedFields={embeddedFields}
          onFiltersChange={onFiltersChange}
        />
      ))}
      <Popover open={isAdding} onOpenChange={setIsAdding}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            disabled={isFull}
            title={
              isFull
                ? t("workspace.analysis.dashboards.filter_limit_reached", { max: MAX_DASHBOARD_FILTERS })
                : undefined
            }>
            <PlusIcon />
            {t("common.add_filter")}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <DashboardFilterForm
            initial={null}
            embeddedFields={embeddedFields}
            onSave={(filter) => {
              onFiltersChange([...filters, filter]);
              setIsAdding(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {isFull && (
        <span className="text-xs text-slate-500">
          {t("workspace.analysis.dashboards.filter_limit_reached", { max: MAX_DASHBOARD_FILTERS })}
        </span>
      )}
    </>
  );
};
