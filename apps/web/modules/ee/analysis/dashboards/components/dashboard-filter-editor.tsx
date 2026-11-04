"use client";

import { createId } from "@paralleldrive/cuid2";
import type { TFunction } from "i18next";
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon } from "lucide-react";
import { useId, useState } from "react";
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
import { Input } from "@/modules/ui/components/input";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";
import { Label } from "@/modules/ui/components/label";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { FilterChip } from "@/modules/ui/components/table-toolbar/components/filter-chip";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { saveDashboardFilterAt } from "../lib/dashboard-filter-editing";
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

/**
 * How a filter's field reads: an embedded-data key by its own name (from the dashboard's datasets), any
 * other field by its translated label. An embedded key not (yet) in the catalogs has no name to show, so it
 * reads as `undefined` rather than as its member name.
 */
const getFieldLabel = (
  field: string,
  embeddedFields: readonly TEmbeddedChartField[],
  t: TFunction
): string | undefined => {
  if (isEmbeddedMemberName(field)) return embeddedFields.find(({ name }) => name === field)?.key;
  return getDashboardFilterField(field) ? getTranslatedFieldLabel(field, t) : undefined;
};

interface DashboardFilterFormProps {
  initial: TDashboardFilter | null;
  /** Where the filter sits in the bar, and how many places there are (the filter's own included). */
  position: number;
  slots: number;
  fields: TDashboardFilterFields;
  /** Every change — field, operator, label and position — is applied together, on Save. */
  onSave: (filter: TDashboardFilter, position: number) => void;
  onRemove?: () => void;
}

/**
 * One filter's definition: the field and operator, picked with the chart builder's own pickers, the label
 * the top bar shows, and its place in the bar. The label follows the field until it is edited. Nothing is
 * applied until Save.
 */
const DashboardFilterForm = ({
  initial,
  position: initialPosition,
  slots,
  fields,
  onSave,
  onRemove,
}: Readonly<DashboardFilterFormProps>) => {
  const { t } = useTranslation();
  const fieldId = useId();
  const operatorId = useId();
  const labelId = useId();
  const [field, setField] = useState(initial?.field ?? "");
  const [operator, setOperator] = useState<TDashboardFilterOperator | "">(initial?.operator ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [labelEdited, setLabelEdited] = useState(Boolean(initial));
  const [position, setPosition] = useState(initialPosition);

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

  // The chart builder's field picker, less measures and answer rules: a dashboard filter narrows records,
  // not groups, and an answer rule names one dataset's question.
  const fieldOptions = getFilterFieldOptions(t, {
    embeddedFields: fields.embeddedFields,
    answerQuestions: [],
  }).filter((group) => group.value === "dimensions" || group.value === "embeddedData");
  const operators = field ? getDashboardFilterOperators(field) : [];
  const trimmedLabel = label.trim();
  const canSave = Boolean(field && operator && trimmedLabel);

  return (
    <form
      className="flex w-80 flex-col gap-3 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave || !operator) return;
        onSave({ id: initial?.id ?? createId(), field, operator, label: trimmedLabel }, position);
      }}>
      <div className="flex flex-col gap-1">
        <Label id={`${fieldId}-label`} htmlFor={fieldId}>
          {t("workspace.analysis.charts.field")}
        </Label>
        <InputCombobox
          id={fieldId}
          aria-labelledby={`${fieldId}-label`}
          showSearch
          searchPlaceholder={t("common.search")}
          groupedOptions={fieldOptions}
          value={field || null}
          onChangeValue={(value) => {
            const next = String(value);
            setField(next);
            setOperator(getDashboardFilterOperators(next)[0] ?? "");
            if (!labelEdited) setLabel(getFieldLabel(next, fields.embeddedFields, t) ?? "");
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label id={`${operatorId}-label`} htmlFor={operatorId}>
          {t("workspace.analysis.dashboards.filter_operator")}
        </Label>
        <InputCombobox
          id={operatorId}
          aria-labelledby={`${operatorId}-label`}
          showSearch={false}
          options={operators.map((value) => ({ value, label: getFilterOperatorLabel(value, t) }))}
          value={operator || null}
          disabled={!field}
          onChangeValue={(value) => setOperator(value as TDashboardFilterOperator)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={labelId}>{t("common.label")}</Label>
        <Input
          id={labelId}
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
          {slots > 1 && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={position === 0}
                aria-label={t("workspace.analysis.dashboards.filter_move_left")}
                onClick={() => setPosition(position - 1)}>
                <ArrowLeftIcon />
              </Button>
              <span className="text-xs text-slate-500">
                {t("workspace.analysis.dashboards.filter_position", {
                  position: position + 1,
                  count: slots,
                })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={position >= slots - 1}
                aria-label={t("workspace.analysis.dashboards.filter_move_right")}
                onClick={() => setPosition(position + 1)}>
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

/** One pinned filter in edit mode: the view mode's chip, opening its definition. */
const EditableFilterChip = ({
  filter,
  index,
  filters,
  fields,
  onFiltersChange,
}: Readonly<{
  filter: TDashboardFilter;
  index: number;
  filters: readonly TDashboardFilter[];
  fields: TDashboardFilterFields;
  onFiltersChange: (filters: TDashboardFilter[]) => void;
}>) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const fieldLabel = getFieldLabel(filter.field, fields.embeddedFields, t);
  const remove = () => onFiltersChange(filters.filter((candidate) => candidate.id !== filter.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FilterChip
          size="md"
          label={filter.label}
          // The field shows once it can be named; never its member name.
          value={fieldLabel ? `${fieldLabel} ${getFilterOperatorLabel(filter.operator, t)}` : ""}
          accessibleName={filter.label}
          onRemove={remove}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <DashboardFilterForm
          initial={filter}
          position={index}
          slots={filters.length}
          fields={fields}
          onRemove={() => {
            remove();
            setOpen(false);
          }}
          onSave={(next, position) => {
            onFiltersChange(saveDashboardFilterAt(filters, next, position));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

/**
 * The dashboard filters as editors change them, in edit mode: each pinned filter as the chip view mode
 * shows, opening its field, operator, label and place, with remove there, and "Add filter" until the
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

  return (
    <>
      {filters.map((filter, index) => (
        <EditableFilterChip
          key={filter.id}
          filter={filter}
          index={index}
          filters={filters}
          fields={fields}
          onFiltersChange={onFiltersChange}
        />
      ))}
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
            position={filters.length}
            slots={filters.length + 1}
            fields={fields}
            onSave={(filter, position) => {
              onFiltersChange(saveDashboardFilterAt(filters, filter, position));
              setIsAdding(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
};
