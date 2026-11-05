import type { TFunction } from "i18next";
import { getFilterFieldOptions } from "@/modules/ee/analysis/charts/lib/filter-conditions";
import type { TChartDateRangeInput } from "@/modules/ee/analysis/lib/api-client";
import { isEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-data-fields";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";
import {
  EMOTIONS_DIMENSION_ID,
  EMOTION_VALUES,
  LANGUAGE_DIMENSION_ID,
  SENTIMENT_DIMENSION_ID,
  SENTIMENT_VALUE_ORDER,
  VALUE_BAND_DIMENSION_ID,
  VALUE_BAND_VALUES,
  getTranslatedDimensionValueLabel,
} from "@/modules/ee/analysis/lib/schema-definition";
import type {
  TAvailableValues,
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
  dashboardFilterTakesSeveralValues,
  dashboardFilterTakesValues,
  getDashboardFilterField,
  getDashboardFilterOperators,
  getMultiLabelValues,
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
 * would; such a list also offers "(No value)" (`NO_VALUE_PICK`). A multi-label field (emotions) picks
 * several of its labels with "contains any of" / "contains none of" (`multiValueContains`). Every field can
 * be "is set" / "is not set". A fixed-option field greys the options the charts do not have
 * (`availableValues`).
 */

/** The sentiment score runs from -1 (negative) to 1 (positive): its typed value says so. */
const SENTIMENT_SCORE_FIELD = "FeedbackRecords.sentimentScore";

/**
 * The typed fields AI enrichment fills together with the sentiment label. Without a sentiment on the
 * dashboard's records none of them has a value either, so each is listed disabled beside Sentiment, with
 * its hint. Emotions, filled with it too, is a multi-label field and gets the same (`labelAvailability`).
 */
const ENRICHED_WITH_SENTIMENT: ReadonlySet<string> = new Set([SENTIMENT_SCORE_FIELD]);

/**
 * Fields of one record's question rather than of the feedback: which question type and which question id
 * a record answers. A chart builder groups by them; a dashboard reader does not filter by them.
 */
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
  if (field === EMOTIONS_DIMENSION_ID) return translated(EMOTION_VALUES);
  if (getDashboardFilterField(field)?.type === "boolean") {
    return [
      { value: "true", label: t("common.yes") },
      { value: "false", label: t("common.no") },
    ];
  }
  return undefined;
};

/**
 * What "(No value)" reads for a field. A record without a language was answered in its survey's default
 * language (transform.ts stores none then), so for Language it reads "Default".
 */
const noValueOptionOf = (field: string, t: TFunction): TFilterOption => ({
  value: NO_VALUE_PICK,
  label:
    field === LANGUAGE_DIMENSION_ID
      ? t("workspace.analysis.dashboards.filter_no_value_language")
      : t("workspace.analysis.dashboards.filter_no_value"),
});

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
 * (sentiment, value band), a set of labels from a fixed list (emotions), yes/no, values looked up in the
 * data (source, language, embedded data…), an embedded-data key that is a number on the dashboard (its
 * values looked up for is / is not, compared as a number otherwise), free text (response text, user id), a
 * number, and a date.
 */
type TFieldKind = "fixed" | "labels" | "boolean" | "list" | "numberList" | "text" | "number" | "time";

/**
 * The operators each kind offers, in the order the toolbar lists them. "is" / "is not" on a field with a
 * value list take one value or several (any of / none of); on free text, one typed value.
 */
const KIND_OPERATORS: Record<TFieldKind, readonly TDashboardFilterOperator[]> = {
  fixed: ["equals", "notEquals", "set", "notSet"],
  labels: ["contains", "notContains", "set", "notSet"],
  boolean: ["equals", "set", "notSet"],
  list: ["equals", "notEquals", "contains", "notContains", "set", "notSet"],
  numberList: ["equals", "notEquals", "gt", "gte", "lt", "lte", "set", "notSet"],
  text: ["contains", "notContains", "equals", "notEquals", "set", "notSet"],
  number: ["equals", "notEquals", "gt", "gte", "lt", "lte", "set", "notSet"],
  time: ["lt", "gt", "set", "notSet"],
};

const fieldKindOf = (field: string, numeric: boolean): TFieldKind | undefined => {
  const definition = getDashboardFilterField(field);
  if (!definition) return undefined;
  if (numeric && isEmbeddedMemberName(field)) return "numberList";
  if (isQuickField(field)) return "fixed";
  if (getMultiLabelValues(field)) return "labels";
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

/**
 * The toolbar rule operators a field offers: its kind's, as far as the field allows them. `numeric` says an
 * embedded-data key is a number on the dashboard (`TV3DashboardFilterFields` `type`).
 */
export const getToolbarRuleOperators = (field: string, numeric = false): TRuleOperator[] => {
  const kind = fieldKindOf(field, numeric);
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
 * equals and not-equals and a multi-label field's contains and not-contains keep every value, `set` /
 * `notSet` hold none and any other filter its one value.
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
    if (takesValues) {
      values = dashboardFilterTakesSeveralValues(filter) ? [...filter.values] : [filter.values[0]];
    }
    return [{ property: filter.field, operator, values }];
  });

/** The toolbar's filters as the dashboard takes them. One with an operator it has no name for is left out. */
export const fromToolbarFilters = (filters: readonly TTableFilter[]): TDashboardFilterState[] =>
  filters.flatMap((filter) => {
    const operator = fromRuleOperator(filter.operator);
    if (!operator) return [];
    if (!dashboardFilterTakesValues(operator)) return [{ field: filter.property, operator, values: [] }];
    const values = dashboardFilterTakesSeveralValues({ field: filter.property, operator })
      ? [...filter.values]
      : filter.values.slice(0, 1);
    return values.length > 0 ? [{ field: filter.property, operator, values }] : [];
  });

/**
 * The filters a field's value list is narrowed by: every one but the field's own several-value filters
 * and its set / not set, so more of its values can be chosen, and the ones a "none of" rule leaves out
 * stay there to untick.
 */
const otherFiltersOf = (field: string, filters: readonly TDashboardFilterState[]): TDashboardFilterState[] =>
  filters.filter(
    (filter) =>
      !(
        filter.field === field &&
        (dashboardFilterTakesSeveralValues(filter) || !dashboardFilterTakesValues(filter.operator))
      )
  );

type TPropertyScope = Readonly<{
  t: TFunction;
  dashboardId: string;
  filters: readonly TDashboardFilterState[];
  dateRange: TChartDateRangeInput | null;
}>;

/**
 * Whether a field enriched with sentiment has values, asked of the sentiment list itself: without a
 * sentiment on the dashboard's records it has none either, so it is listed disabled with Sentiment's hint.
 * The field's own filters are left out of the lookup, so they never disable the field they are on.
 */
const sentimentAvailability = (field: string, { t, dashboardId, filters, dateRange }: TPropertyScope) =>
  getDashboardFieldAvailableValues({
    dashboardId,
    dateRange,
    field: SENTIMENT_DIMENSION_ID,
    otherFilters: otherFiltersOf(SENTIMENT_DIMENSION_ID, otherFiltersOf(field, filters)),
    emptyHint: t("workspace.analysis.dashboards.filter_no_sentiment_yet"),
    narrowedHint: t("workspace.analysis.dashboards.filter_no_values_in_view"),
  });

/**
 * A multi-label field's availability: disabled, with the sentiment hint, while no record has a sentiment;
 * otherwise every label is offered. The lookup returns sentiment values, so they are not passed on as the
 * labels that occur, which would grey every label; it is cached apart from Sentiment's for that reason.
 */
const labelAvailability = (
  field: string,
  labels: readonly string[],
  scope: TPropertyScope
): TAvailableValues => {
  const sentiment = sentimentAvailability(field, scope);
  return {
    ...sentiment,
    queryKey: [...sentiment.queryKey, field],
    load: async (signal) => {
      const result = await sentiment.load(signal);
      return result.values.length > 0 ? { values: [...labels] } : result;
    },
  };
};

/** A field with a fixed set of values, picked from them; a multi-label field picks several labels. */
const fixedValueProperty = (
  field: string,
  fixed: TFilterOption[],
  noValueOption: TFilterOption,
  scope: TPropertyScope
): Pick<
  TFilterProperty,
  "valueType" | "options" | "quick" | "multiValueEquals" | "multiValueContains" | "availableValues"
> => {
  const { t, dashboardId, filters, dateRange } = scope;
  const labels = getMultiLabelValues(field);
  if (labels) {
    return {
      valueType: "enum",
      options: fixed,
      multiValueContains: true,
      availableValues: labelAvailability(field, labels, scope),
    };
  }
  return {
    valueType: "enum",
    options: [noValueOption, ...fixed],
    quick: isQuickField(field),
    multiValueEquals: true,
    availableValues: getDashboardFieldAvailableValues({
      dashboardId,
      field,
      otherFilters: otherFiltersOf(field, filters),
      dateRange,
      emptyHint:
        field === SENTIMENT_DIMENSION_ID
          ? t("workspace.analysis.dashboards.filter_no_sentiment_yet")
          : t("workspace.analysis.dashboards.filter_no_values_yet"),
      narrowedHint: t("workspace.analysis.dashboards.filter_no_values_in_view"),
    }),
  };
};

/**
 * An embedded-data key is named as collected, so it can read like a dimension ("Channel"). Where its label
 * is also another property's, it is named "Channel · Embedded data", in the Filter menu and on its chip, so
 * the two read apart; every other label is kept.
 */
export const disambiguateEmbeddedLabels = (
  properties: readonly TFilterProperty[],
  isEmbedded: (property: TFilterProperty) => boolean,
  embeddedLabel: (label: string) => string
): TFilterProperty[] => {
  const counts = new Map<string, number>();
  for (const { label } of properties) {
    const key = label.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return properties.map((property) =>
    isEmbedded(property) && (counts.get(property.label.trim().toLowerCase()) ?? 0) > 1
      ? { ...property, label: embeddedLabel(property.label) }
      : property
  );
};

/**
 * The toolbar's properties for a dashboard: every dimension of the catalog and every embedded-data key of
 * its datasets a person can filter by. A field with a fixed set of values is a quick filter and picks from
 * them in Advanced filter too (a multi-label field only there); a categorical field lists the values the
 * charts let through there, and the rest take a typed value. An embedded-data key that is a number on the
 * dashboard (`numericFields`) also compares with > / ≥ / < / ≤, on a typed number. An embedded-data key whose label is also a
 * dimension's is told apart (`disambiguateEmbeddedLabels`).
 */
export const buildToolbarProperties = ({
  t,
  embeddedFields,
  numericFields = new Set(),
  dashboardId,
  filters,
  dateRange,
}: Readonly<{
  t: TFunction;
  embeddedFields: readonly TEmbeddedChartField[];
  /** The embedded-data keys that are numbers on this dashboard, by member. */
  numericFields?: ReadonlySet<string>;
  dashboardId: string;
  filters: readonly TDashboardFilterState[];
  dateRange: TChartDateRangeInput | null;
}>): TFilterProperty[] => {
  const propertyScope: TPropertyScope = { t, dashboardId, filters, dateRange };
  const properties = getFilterFieldOptions(t, { embeddedFields: [...embeddedFields], answerQuestions: [] })
    .filter((group) => group.value === "dimensions" || group.value === "embeddedData")
    .flatMap((group) =>
      (group.options ?? []).flatMap<TFilterProperty>((option) => {
        const field = String(option.value);
        if (RECORD_LEVEL_FIELDS.has(field)) return [];
        const definition = getDashboardFilterField(field);
        const numeric = numericFields.has(field);
        const ruleOperators = getToolbarRuleOperators(field, numeric);
        if (!definition || ruleOperators.length === 0) return [];
        const shared = { id: field, label: option.label, group: group.label, ruleOperators };
        const noValueOption = noValueOptionOf(field, t);

        const fixed = getFixedValueOptions(field, t);
        if (fixed) return [{ ...shared, ...fixedValueProperty(field, fixed, noValueOption, propertyScope) }];
        if (isListDashboardFilter({ field, operator: "equals" })) {
          const scope = { dashboardId, field, otherFilters: otherFiltersOf(field, filters), dateRange };
          return [
            {
              ...getDashboardFieldValueProperty({ ...scope, label: option.label, noValueOption }),
              ...shared,
              multiValueEquals: true,
              // A numeric key picks is / is not from its values, and takes a typed number for > and <.
              ...(numeric ? { valueType: "number" as const } : {}),
            },
          ];
        }
        const valueType = TOOLBAR_VALUE_TYPE[definition.type] ?? "string";
        if (ENRICHED_WITH_SENTIMENT.has(field)) {
          // This property has no values of its own to grey, only the menu's disabled state reads it.
          return [
            {
              ...shared,
              valueType,
              availableValues: sentimentAvailability(field, propertyScope),
              ...(field === SENTIMENT_SCORE_FIELD
                ? { placeholder: t("workspace.analysis.dashboards.filter_sentiment_score_placeholder") }
                : {}),
            },
          ];
        }
        return [{ ...shared, valueType }];
      })
    );
  const embedded = new Set(embeddedFields.map(({ name }) => name));
  return disambiguateEmbeddedLabels(
    properties,
    (property) => embedded.has(property.id),
    (label) => t("workspace.analysis.dashboards.filter_embedded_field_label", { field: label })
  );
};
