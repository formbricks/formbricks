import type { TFunction } from "i18next";
import { getFilterFieldOptions } from "@/modules/ee/analysis/charts/lib/filter-conditions";
import type { TChartDateRangeInput } from "@/modules/ee/analysis/lib/api-client";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";
import {
  EMOTIONS_DIMENSION_ID,
  SENTIMENT_DIMENSION_ID,
  SENTIMENT_VALUE_ORDER,
  VALUE_BAND_DIMENSION_ID,
  VALUE_BAND_VALUES,
  getTranslatedDimensionValueLabel,
} from "@/modules/ee/analysis/lib/schema-definition";
import type {
  TFilterOption,
  TFilterProperty,
  TRuleOperator,
  TTableFilter,
  TTableFilterOperator,
} from "@/modules/ui/components/table-toolbar/lib/types";
import type { TDashboardFilterState } from "./dashboard-filter-state";
import { getDashboardFieldAvailableValues, getDashboardFieldValueProperty } from "./dashboard-filter-values";
import {
  NO_VALUE_PICK,
  type TDashboardFilterOperator,
  type TLockedDashboardFilter,
  dashboardFilterTakesValues,
  getDashboardFilterField,
  getDashboardFilterOperators,
  isListDashboardFilter,
} from "./dashboard-filters";

/**
 * A dashboard's filters in the table toolbar's terms (ADR 0015), so the Filter menu, Advanced filter and
 * the chips of the responses page work the same here. The properties are the dimensions of the charts'
 * datasets and their embedded-data keys. A field whose values are a fixed set the app already knows
 * (sentiment, value band) is a quick filter in the Filter menu; every other field, whose values would have
 * to be looked up in the data, is filtered in Advanced filter, which lists them when a rule on the field is
 * written. On a field that holds one of a list of values (a list filter, `isListDashboardFilter`) "is" /
 * "is not" take one value or several (`multiValueEquals`), so a rule holds every value a quick filter
 * would; such a list also offers "(No value)" (`NO_VALUE_PICK`). Every field can be "is set" / "is not
 * set". A fixed-option field greys the options the charts do not have (`availableValues`).
 */

/**
 * Fields of one record's question rather than of the feedback: which question type and which question id
 * a record answers. A chart builder groups by them; a dashboard reader does not filter by them.
 */
/**
 * The fields AI enrichment fills together with the sentiment label. Without a sentiment on the dashboard's
 * records none of them has a value either, so each is listed disabled beside Sentiment, with its hint.
 */
const ENRICHED_WITH_SENTIMENT: ReadonlySet<string> = new Set([
  "FeedbackRecords.sentimentScore",
  EMOTIONS_DIMENSION_ID,
]);

const RECORD_LEVEL_FIELDS: ReadonlySet<string> = new Set([
  "FeedbackRecords.fieldType",
  "FeedbackRecords.fieldId",
]);

/** The values of a field that has a fixed set of them, as the toolbar lists them; `undefined` for any other. */
const getFixedValueOptions = (field: string, t: TFunction): TFilterOption[] | undefined => {
  const translated = (values: readonly string[]) =>
    values.map((value) => ({ value, label: getTranslatedDimensionValueLabel(field, value, t) ?? value }));
  if (field === SENTIMENT_DIMENSION_ID) return translated(SENTIMENT_VALUE_ORDER);
  if (field === VALUE_BAND_DIMENSION_ID) return translated(VALUE_BAND_VALUES);
  if (getDashboardFilterField(field)?.type === "boolean") {
    return [
      { value: "true", label: t("common.yes") },
      { value: "false", label: t("common.no") },
    ];
  }
  return undefined;
};

/** How the toolbar takes a catalog field's values: a number, a day, or text. */
const TOOLBAR_VALUE_TYPE: Partial<Record<string, TFilterProperty["valueType"]>> = {
  number: "number",
  time: "date",
};

/** The fields whose values are a fixed set: quick filters of the Filter menu. */
const QUICK_FIELDS: ReadonlySet<string> = new Set([SENTIMENT_DIMENSION_ID, VALUE_BAND_DIMENSION_ID]);

const isQuickField = (field: string): boolean => QUICK_FIELDS.has(field);

/**
 * The kinds of field a dashboard filters by, each with its own operators: a fixed set of options
 * (sentiment, value band), yes/no, values looked up in the data (source, language, embedded data…), free
 * text (response text, user id), a number, and a date.
 */
type TFieldKind = "fixed" | "boolean" | "list" | "text" | "number" | "time";

/**
 * The operators each kind offers, in the order the toolbar lists them. "is" / "is not" on a field with a
 * value list take one value or several (any of / none of); on free text, one typed value.
 */
const KIND_OPERATORS: Record<TFieldKind, readonly TDashboardFilterOperator[]> = {
  fixed: ["equals", "notEquals", "set", "notSet"],
  boolean: ["equals", "set", "notSet"],
  list: ["equals", "notEquals", "contains", "notContains", "set", "notSet"],
  text: ["contains", "notContains", "equals", "notEquals", "set", "notSet"],
  number: ["equals", "notEquals", "gt", "gte", "lt", "lte", "set", "notSet"],
  time: ["lt", "gt", "set", "notSet"],
};

const fieldKindOf = (field: string): TFieldKind | undefined => {
  const definition = getDashboardFilterField(field);
  if (!definition) return undefined;
  if (isQuickField(field)) return "fixed";
  if (definition.type === "boolean" || definition.type === "time" || definition.type === "number") {
    return definition.type;
  }
  return isListDashboardFilter({ field, operator: "equals" }) ? "list" : "text";
};

const RULE_OPERATOR: Record<TDashboardFilterOperator, TRuleOperator> = {
  equals: "equals",
  notEquals: "notEquals",
  contains: "contains",
  notContains: "doesNotContain",
  gt: "greaterThan",
  gte: "greaterEqual",
  lt: "lessThan",
  lte: "lessEqual",
  set: "isSet",
  notSet: "isNotSet",
};

/** A time field is compared with the toolbar's date operators: after and before, set and not set. */
const TIME_RULE_OPERATOR: Partial<Record<TDashboardFilterOperator, TRuleOperator>> = {
  gt: "isAfter",
  lt: "isBefore",
  set: "isSet",
  notSet: "isNotSet",
};

const toRuleOperator = (field: string, operator: TDashboardFilterOperator): TRuleOperator | undefined =>
  getDashboardFilterField(field)?.type === "time" ? TIME_RULE_OPERATOR[operator] : RULE_OPERATOR[operator];

const fromRuleOperator = (operator: TTableFilterOperator): TDashboardFilterOperator | undefined => {
  if (operator === "in") return "equals";
  if (operator === "isAfter") return "gt";
  if (operator === "isBefore") return "lt";
  return (Object.entries(RULE_OPERATOR).find(([, rule]) => rule === operator)?.[0] ?? undefined) as
    | TDashboardFilterOperator
    | undefined;
};

/** The toolbar rule operators a field offers: its kind's, as far as the field allows them. */
export const getToolbarRuleOperators = (field: string): TRuleOperator[] => {
  const kind = fieldKindOf(field);
  if (!kind) return [];
  const allowed = getDashboardFilterOperators(field);
  return KIND_OPERATORS[kind].flatMap((operator) => {
    const rule = allowed.includes(operator) ? toRuleOperator(field, operator) : undefined;
    return rule ? [rule] : [];
  });
};

/** A dashboard's locked filters as the filters a person states: field, operator and values. */
export const toStatedFilters = (filters: readonly TLockedDashboardFilter[]): TDashboardFilterState[] =>
  filters.map(({ field, operator, values }) => ({ field, operator, values: [...values] }));

/**
 * The filters as the toolbar holds them: equals on a quick field is its quick filter, a list field's
 * equals and not-equals keep every value, `set` / `notSet` hold none and any other filter its one value.
 * One it cannot show (an operator it has no name for) is left out.
 */
export const toToolbarFilters = (filters: readonly TDashboardFilterState[]): TTableFilter[] =>
  filters.flatMap<TTableFilter>((filter) => {
    const takesValues = dashboardFilterTakesValues(filter.operator);
    if (takesValues && filter.values.length === 0) return [];
    if (filter.operator === "equals" && isQuickField(filter.field)) {
      return [{ property: filter.field, operator: "in" as const, values: [...filter.values] }];
    }
    const operator = toRuleOperator(filter.field, filter.operator);
    if (!operator) return [];
    let values: string[] = [];
    if (takesValues) values = isListDashboardFilter(filter) ? [...filter.values] : [filter.values[0]];
    return [{ property: filter.field, operator, values }];
  });

/** The toolbar's filters as the dashboard takes them. One with an operator it has no name for is left out. */
export const fromToolbarFilters = (filters: readonly TTableFilter[]): TDashboardFilterState[] =>
  filters.flatMap((filter) => {
    const operator = fromRuleOperator(filter.operator);
    if (!operator) return [];
    if (!dashboardFilterTakesValues(operator)) return [{ field: filter.property, operator, values: [] }];
    const values = isListDashboardFilter({ field: filter.property, operator })
      ? [...filter.values]
      : filter.values.slice(0, 1);
    return values.length > 0 ? [{ field: filter.property, operator, values }] : [];
  });

/**
 * The filters a field's value list is narrowed by: every one but the field's own list filters and its
 * set / not set, so more of its values can be chosen, and the ones a "none of" rule leaves out stay
 * there to untick.
 */
const otherFiltersOf = (field: string, filters: readonly TDashboardFilterState[]): TDashboardFilterState[] =>
  filters.filter(
    (filter) =>
      !(
        filter.field === field &&
        (isListDashboardFilter(filter) || !dashboardFilterTakesValues(filter.operator))
      )
  );

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
}>): TFilterProperty[] => {
  const noValueOption: TFilterOption = {
    value: NO_VALUE_PICK,
    label: t("workspace.analysis.dashboards.filter_no_value"),
  };
  return getFilterFieldOptions(t, { embeddedFields: [...embeddedFields], answerQuestions: [] })
    .filter((group) => group.value === "dimensions" || group.value === "embeddedData")
    .flatMap((group) =>
      (group.options ?? []).flatMap<TFilterProperty>((option) => {
        const field = String(option.value);
        if (RECORD_LEVEL_FIELDS.has(field)) return [];
        const definition = getDashboardFilterField(field);
        const ruleOperators = getToolbarRuleOperators(field);
        if (!definition || ruleOperators.length === 0) return [];
        const shared = { id: field, label: option.label, group: group.label, ruleOperators };
        const scope = { dashboardId, field, otherFilters: otherFiltersOf(field, filters), dateRange };

        const fixed = getFixedValueOptions(field, t);
        if (fixed) {
          return [
            {
              ...shared,
              valueType: "enum",
              options: [noValueOption, ...fixed],
              quick: isQuickField(field),
              multiValueEquals: true,
              availableValues: getDashboardFieldAvailableValues({
                ...scope,
                emptyHint:
                  field === SENTIMENT_DIMENSION_ID
                    ? t("workspace.analysis.dashboards.filter_no_sentiment_yet")
                    : t("workspace.analysis.dashboards.filter_no_values_yet"),
                narrowedHint: t("workspace.analysis.dashboards.filter_no_values_in_view"),
              }),
            },
          ];
        }
        if (isListDashboardFilter({ field, operator: "equals" })) {
          return [
            {
              ...getDashboardFieldValueProperty({ ...scope, label: option.label, noValueOption }),
              ...shared,
              multiValueEquals: true,
            },
          ];
        }
        const valueType = TOOLBAR_VALUE_TYPE[definition.type] ?? "string";
        if (ENRICHED_WITH_SENTIMENT.has(field)) {
          // Asked of the sentiment list itself, so it shares that lookup's cache; this property has no
          // values of its own to grey, only the menu's disabled state reads it.
          const availableValues = getDashboardFieldAvailableValues({
            ...scope,
            field: SENTIMENT_DIMENSION_ID,
            otherFilters: otherFiltersOf(SENTIMENT_DIMENSION_ID, filters),
            emptyHint: t("workspace.analysis.dashboards.filter_no_sentiment_yet"),
            narrowedHint: t("workspace.analysis.dashboards.filter_no_values_in_view"),
          });
          return [{ ...shared, valueType, availableValues }];
        }
        return [{ ...shared, valueType }];
      })
    );
};
