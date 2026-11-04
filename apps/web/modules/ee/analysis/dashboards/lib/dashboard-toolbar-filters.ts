import type { TFunction } from "i18next";
import { getFilterFieldOptions } from "@/modules/ee/analysis/charts/lib/filter-conditions";
import type { TChartDateRangeInput } from "@/modules/ee/analysis/lib/api-client";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";
import {
  SENTIMENT_DIMENSION_ID,
  SENTIMENT_VALUE_ORDER,
  VALUE_BAND_DIMENSION_ID,
  VALUE_BAND_VALUES,
  getTranslatedDimensionValueLabel,
} from "@/modules/ee/analysis/lib/schema-definition";
import { formatFieldTypeLabel } from "@/modules/ee/unify-feedback/lib/utils";
import type {
  TFilterOption,
  TFilterProperty,
  TRuleOperator,
  TTableFilter,
  TTableFilterOperator,
} from "@/modules/ui/components/table-toolbar/lib/types";
import type { TDashboardFilterState } from "./dashboard-filter-state";
import { getDashboardFieldValueProperty } from "./dashboard-filter-values";
import {
  type TDashboardFilterOperator,
  type TLockedDashboardFilter,
  getDashboardFilterField,
  getDashboardFilterOperators,
  isListDashboardFilter,
} from "./dashboard-filters";

/**
 * A dashboard's filters in the table toolbar's terms (ADR 0015), so the Filter menu, Advanced filter and
 * the chips of the responses page work the same here. The properties are the dimensions of the charts'
 * datasets and their embedded-data keys. A field whose values are a fixed set the app already knows
 * (sentiment, value band, field type) is a quick filter in the Filter menu; every other field, whose
 * values would have to be looked up in the data, is filtered in Advanced filter, which lists them when a
 * rule on the field is written.
 */

const FIELD_TYPE_DIMENSION_ID = "FeedbackRecords.fieldType";

/** The stored field types: Hub's vocabulary. */
const FIELD_TYPE_VALUES = [
  "text",
  "categorical",
  "nps",
  "csat",
  "ces",
  "rating",
  "number",
  "boolean",
  "date",
] as const;

/** The values of a field that has a fixed set of them, as the toolbar lists them; `undefined` for any other. */
const getFixedValueOptions = (field: string, t: TFunction): TFilterOption[] | undefined => {
  const translated = (values: readonly string[]) =>
    values.map((value) => ({ value, label: getTranslatedDimensionValueLabel(field, value, t) ?? value }));
  if (field === SENTIMENT_DIMENSION_ID) return translated(SENTIMENT_VALUE_ORDER);
  if (field === VALUE_BAND_DIMENSION_ID) return translated(VALUE_BAND_VALUES);
  if (field === FIELD_TYPE_DIMENSION_ID) {
    return FIELD_TYPE_VALUES.map((value) => ({ value, label: formatFieldTypeLabel(value, t) }));
  }
  return undefined;
};

/** How the toolbar takes a catalog field's values: a number, a day, or text. */
const TOOLBAR_VALUE_TYPE: Partial<Record<string, TFilterProperty["valueType"]>> = {
  number: "number",
  time: "date",
};

/** The fields whose values are a fixed set: quick filters of the Filter menu. */
const QUICK_FIELDS: ReadonlySet<string> = new Set([
  SENTIMENT_DIMENSION_ID,
  VALUE_BAND_DIMENSION_ID,
  FIELD_TYPE_DIMENSION_ID,
]);

const isQuickField = (field: string): boolean => QUICK_FIELDS.has(field);

const RULE_OPERATOR: Record<TDashboardFilterOperator, TRuleOperator> = {
  equals: "equals",
  notEquals: "notEquals",
  contains: "contains",
  notContains: "doesNotContain",
  gt: "greaterThan",
  gte: "greaterEqual",
  lt: "lessThan",
  lte: "lessEqual",
};

/** A time field is compared with the toolbar's date operators: after and before. */
const TIME_RULE_OPERATOR: Partial<Record<TDashboardFilterOperator, TRuleOperator>> = {
  gt: "isAfter",
  lt: "isBefore",
};

const isTimeField = (field: string): boolean => getDashboardFilterField(field)?.type === "time";

const toRuleOperator = (field: string, operator: TDashboardFilterOperator): TRuleOperator | undefined =>
  isTimeField(field) ? TIME_RULE_OPERATOR[operator] : RULE_OPERATOR[operator];

const fromRuleOperator = (operator: TTableFilterOperator): TDashboardFilterOperator | undefined => {
  if (operator === "isAfter") return "gt";
  if (operator === "isBefore") return "lt";
  return (Object.entries(RULE_OPERATOR).find(([, rule]) => rule === operator)?.[0] ?? undefined) as
    | TDashboardFilterOperator
    | undefined;
};

/** The toolbar rule operators a field offers: the dashboard's, as the toolbar names them. */
export const getToolbarRuleOperators = (field: string): TRuleOperator[] =>
  getDashboardFilterOperators(field).flatMap((operator) => {
    const rule = toRuleOperator(field, operator);
    return rule ? [rule] : [];
  });

/** A dashboard's locked filters as the filters a person states: field, operator and values. */
export const toStatedFilters = (filters: readonly TLockedDashboardFilter[]): TDashboardFilterState[] =>
  filters.map(({ field, operator, values }) => ({ field, operator, values: [...values] }));

/** The filters as the toolbar holds them. One it cannot show (an operator it has no name for) is left out. */
export const toToolbarFilters = (filters: readonly TDashboardFilterState[]): TTableFilter[] =>
  filters.flatMap<TTableFilter>((filter) => {
    if (filter.operator === "equals" && isQuickField(filter.field)) {
      return [{ property: filter.field, operator: "in" as const, values: [...filter.values] }];
    }
    const operator = toRuleOperator(filter.field, filter.operator);
    const value = filter.values[0];
    return operator && value !== undefined ? [{ property: filter.field, operator, values: [value] }] : [];
  });

/** The toolbar's filters as the dashboard takes them. One that is not a comparison with a value is left out. */
export const fromToolbarFilters = (filters: readonly TTableFilter[]): TDashboardFilterState[] =>
  filters.flatMap((filter) => {
    if (filter.operator === "in") {
      return filter.values.length > 0
        ? [{ field: filter.property, operator: "equals" as const, values: [...filter.values] }]
        : [];
    }
    const operator = fromRuleOperator(filter.operator);
    const value = filter.values[0];
    return operator && value !== undefined ? [{ field: filter.property, operator, values: [value] }] : [];
  });

/**
 * The toolbar's properties for a dashboard: every dimension of the catalog and every embedded-data key of
 * its datasets a person can filter by. A field with a fixed set of values is a quick filter and picks from
 * them in Advanced filter too; a categorical field lists the values the charts let through there, and the
 * rest take a typed value.
 */
export const buildToolbarProperties = ({
  t,
  embeddedFields,
  dashboardId,
  filters,
  dateRange,
}: Readonly<{
  t: TFunction;
  embeddedFields: readonly TEmbeddedChartField[];
  dashboardId: string;
  filters: readonly TDashboardFilterState[];
  dateRange: TChartDateRangeInput | null;
}>): TFilterProperty[] =>
  getFilterFieldOptions(t, { embeddedFields: [...embeddedFields], answerQuestions: [] })
    .filter((group) => group.value === "dimensions" || group.value === "embeddedData")
    .flatMap((group) =>
      (group.options ?? []).flatMap<TFilterProperty>((option) => {
        const field = String(option.value);
        const definition = getDashboardFilterField(field);
        const ruleOperators = getToolbarRuleOperators(field);
        if (!definition || ruleOperators.length === 0) return [];
        const shared = { id: field, label: option.label, group: group.label, ruleOperators };

        const fixed = getFixedValueOptions(field, t);
        if (fixed) return [{ ...shared, valueType: "enum", options: fixed, quick: true }];
        if (definition.type === "boolean") {
          return [
            {
              ...shared,
              valueType: "enum",
              options: [
                { value: "true", label: t("common.yes") },
                { value: "false", label: t("common.no") },
              ],
            },
          ];
        }
        if (isListDashboardFilter({ field, operator: "equals" })) {
          // The list never narrows by this field's own equals filter, so more of its values can be chosen.
          const otherFilters = filters.filter(
            (filter) => !(filter.field === field && filter.operator === "equals")
          );
          return [
            {
              ...getDashboardFieldValueProperty({
                dashboardId,
                field,
                label: option.label,
                otherFilters,
                dateRange,
              }),
              ...shared,
            },
          ];
        }
        return [{ ...shared, valueType: TOOLBAR_VALUE_TYPE[definition.type] ?? "string" }];
      })
    );
