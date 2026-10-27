import type { TFunction } from "i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type {
  DateRange,
  FilterValue,
  SelectedFilterValue,
  TResponseStatus,
} from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import {
  type ElementOptions,
  OptionsType,
} from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/components/response-filter-options";
import type { ElementFilterOptions } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/components/response-filter-options";
import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { resolveDateFilterBounds } from "@/modules/ui/components/table-toolbar/lib/date-filter";
import type {
  TFilterOption,
  TFilterProperty,
  TFilterValueType,
  TRuleOperator,
  TTableFilter,
} from "@/modules/ui/components/table-toolbar/lib/types";

// Responses keep their filter in the page URL like every other table (ADR 0003), shared by the
// Responses and Summary tabs. The response filter pipeline underneath stays as it was: these helpers
// translate table filters to the `SelectedFilterValue` / `DateRange` pair `getFormattedFilters` reads,
// and back, so the server query, the download and the Summary's click-to-filter are unchanged.
//
// Property ids follow the v3 syntax: `status`, `createdAt`, `tag`, `language` (the quick filters,
// ENG-6703), then `question.<id>`, `question.<id>.<rowId>`, `attribute.<key>`, `hiddenField.<key>`,
// `variable.<key>`, `meta.<name>` and `quota.<id>` for Advanced filter.

export const STATUS_PROPERTY = "status";
export const CREATED_AT_PROPERTY = "createdAt";
export const TAG_PROPERTY = "tag";
export const LANGUAGE_PROPERTY = "language";

type TResponseFieldKind =
  | "question"
  | "matrixRow"
  | "attribute"
  | "hiddenField"
  | "variable"
  | "meta"
  | "quota";

/** What a rule property points at, so a rule can be turned back into the filter row it stands for. */
export type TResponseFilterField = {
  kind: TResponseFieldKind;
  /** The question, attribute key, storage key, catalog name or quota id. */
  id: string;
  label: string;
  elementType?: TSurveyElementTypeEnum;
  /** Matrix rows: the row label the filter row carries. */
  rowLabel?: string;
};

export type TResponseFilterModel = {
  properties: TFilterProperty[];
  fields: Map<string, TResponseFilterField>;
};

const PRESENCE_TYPES = new Set<string>([
  TSurveyElementTypeEnum.OpenText,
  TSurveyElementTypeEnum.Address,
  TSurveyElementTypeEnum.ContactInfo,
  TSurveyElementTypeEnum.Ranking,
]);
const EQUALS_TYPES = new Set<string>([TSurveyElementTypeEnum.CTA, TSurveyElementTypeEnum.Consent]);
const SCALE_TYPES = new Set<string>([
  TSurveyElementTypeEnum.NPS,
  TSurveyElementTypeEnum.Rating,
  TSurveyElementTypeEnum.CSAT,
  TSurveyElementTypeEnum.CES,
]);

/** Question operator labels ↔ table operators, for the scale and choice questions. */
const QUESTION_OPERATORS: Record<string, TRuleOperator> = {
  "Includes either": "includesOneOf",
  "Includes all": "includesAllOf",
  "Is equal to": "equals",
  "Is less than": "lessThan",
  "Is more than": "greaterThan",
  Submitted: "isSet",
  Skipped: "isNotSet",
};

/** Typed field (hidden field, variable, meta) and attribute operator labels ↔ table operators. */
const FIELD_OPERATORS: Record<string, TRuleOperator> = {
  Equals: "equals",
  "Not equals": "notEquals",
  Contains: "contains",
  "Does not contain": "doesNotContain",
  "Starts with": "startsWith",
  "Does not start with": "doesNotStartWith",
  "Ends with": "endsWith",
  "Does not end with": "doesNotEndWith",
  "Is greater than": "greaterThan",
  "Is less than": "lessThan",
  "Is before": "isBefore",
  "Is after": "isAfter",
  "Is set": "isSet",
  "Is not set": "isNotSet",
};

const invert = (map: Record<string, TRuleOperator>): Partial<Record<TRuleOperator, string>> =>
  Object.fromEntries(Object.entries(map).map(([label, operator]) => [operator, label]));

const QUESTION_LABELS = invert(QUESTION_OPERATORS);
const FIELD_LABELS = invert(FIELD_OPERATORS);

const toOptions = (values: readonly unknown[]): TFilterOption[] =>
  values
    .map((value) => (typeof value === "string" ? value : getLocalizedValue(value as never, "default")))
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => ({ label: value, value }));

const mapOperators = (labels: readonly unknown[], map: Record<string, TRuleOperator>): TRuleOperator[] => [
  ...new Set(labels.map((label) => map[String(label)]).filter((operator) => operator !== undefined)),
];

const fieldValueType = (dataType: ElementFilterOptions["fieldDataType"]): TFilterValueType => {
  if (dataType === "number") return "number";
  if (dataType === "date") return "date";
  if (dataType === "boolean") return "enum";
  return "string";
};

const questionProperty = (
  id: string,
  label: string,
  elementType: TSurveyElementTypeEnum,
  filterOption: ElementFilterOptions
): TFilterProperty => {
  if (PRESENCE_TYPES.has(elementType)) {
    return { id, label, valueType: "string", ruleOperators: ["isSet", "isNotSet"] };
  }
  const options = toOptions(filterOption.filterComboBoxOptions);
  if (EQUALS_TYPES.has(elementType)) {
    return { id, label, valueType: "enum", options, ruleOperators: ["equals"] };
  }
  const ruleOperators = mapOperators(filterOption.filterOptions, QUESTION_OPERATORS);
  if (SCALE_TYPES.has(elementType)) return { id, label, valueType: "number", options, ruleOperators };
  return { id, label, valueType: "enum", options, ruleOperators };
};

const TYPED_KINDS: Partial<Record<OptionsType, Exclude<TResponseFieldKind, "question" | "matrixRow">>> = {
  [OptionsType.ATTRIBUTES]: "attribute",
  [OptionsType.HIDDEN_FIELDS]: "hiddenField",
  [OptionsType.VARIABLES]: "variable",
  [OptionsType.META]: "meta",
  [OptionsType.QUOTAS]: "quota",
};

// Literal `t()` calls, so the translation scanner sees every heading.
const groupLabel = (kind: TResponseFieldKind, t: TFunction): string => {
  switch (kind) {
    case "attribute":
      return t("common.attributes");
    case "hiddenField":
      return t("common.hidden_fields");
    case "variable":
      return t("common.variables");
    case "meta":
      return t("common.meta");
    case "quota":
      return t("common.quotas");
    default:
      return t("common.elements");
  }
};

/** Every filter property the Responses table offers, from the survey and its filter options. */
export const buildResponseFilterModel = ({
  survey,
  elementOptions,
  elementFilterOptions,
  tagNames,
  t,
}: {
  survey: TSurvey;
  elementOptions: readonly ElementOptions[];
  elementFilterOptions: readonly ElementFilterOptions[];
  tagNames: readonly string[];
  t: TFunction;
}): TResponseFilterModel => {
  const fields = new Map<string, TResponseFilterField>();
  const properties: TFilterProperty[] = [
    {
      id: STATUS_PROPERTY,
      label: t("common.status"),
      valueType: "enum",
      quick: true,
      options: [
        { value: "complete", label: t("workspace.surveys.filter.complete_responses") },
        { value: "partial", label: t("workspace.surveys.filter.partial_responses") },
      ],
    },
    {
      id: CREATED_AT_PROPERTY,
      label: t("common.date"),
      valueType: "date",
      quick: true,
      datePresets: DATE_RANGE_PRESETS,
    },
    {
      id: TAG_PROPERTY,
      label: t("common.tags"),
      valueType: "enum",
      quick: true,
      options: tagNames.map((name) => ({ value: name, label: name })),
      // Tags arrive after the page does; a tag in a shared link must survive until they have.
      loadOptions: async () => tagNames.map((name) => ({ value: name, label: name })),
      ruleOperators: ["equals", "notEquals"],
      group: t("common.other_filters"),
    },
  ];

  if (survey.languages?.length > 0) {
    const codes = survey.languages.map((language) => language.language.code);
    properties.push({
      id: LANGUAGE_PROPERTY,
      label: t("common.language"),
      valueType: "enum",
      quick: true,
      options: codes.map((code) => ({ value: code, label: code })),
      ruleOperators: ["equals", "notEquals"],
      group: t("common.other_filters"),
    });
  }

  const filterOptionFor = (type: string, id: string) =>
    elementFilterOptions.find((option) => option.type === type && option.id === id);
  const surveyElements = getElementsFromBlocks(survey.blocks);

  for (const group of elementOptions) {
    for (const option of group.option) {
      const id = String(option.id ?? "");
      const label = String(option.label ?? id);
      if (!id) continue;

      if (option.type === OptionsType.ELEMENTS && option.elementType) {
        const elementType = option.elementType as TSurveyElementTypeEnum;
        const filterOption = filterOptionFor(elementType, id);
        if (!filterOption) continue;
        if (elementType === TSurveyElementTypeEnum.Matrix) {
          const element = surveyElements.find((item) => item.id === id);
          if (element?.type !== TSurveyElementTypeEnum.Matrix) continue;
          const columns = toOptions(filterOption.filterComboBoxOptions);
          for (const row of element.rows) {
            const rowLabel = getLocalizedValue(row.label, "default");
            const propertyId = `question.${id}.${row.id}`;
            properties.push({
              id: propertyId,
              group: t("common.elements"),
              label: `${label} · ${rowLabel}`,
              valueType: "enum",
              options: columns,
              ruleOperators: ["equals"],
            });
            fields.set(propertyId, { kind: "matrixRow", id, label, elementType, rowLabel });
          }
          continue;
        }
        const propertyId = `question.${id}`;
        properties.push({
          ...questionProperty(propertyId, label, elementType, filterOption),
          group: t("common.elements"),
        });
        fields.set(propertyId, { kind: "question", id, label, elementType });
        continue;
      }

      const typed = TYPED_KINDS[option.type as OptionsType];
      if (!typed) continue;
      const filterOption = filterOptionFor(option.type as string, id);
      if (!filterOption) continue;
      const propertyId = `${typed}.${id}`;
      const valueType =
        typed === "attribute" || typed === "quota" ? "enum" : fieldValueType(filterOption.fieldDataType);
      const ruleOperators =
        typed === "quota"
          ? (["equals"] as TRuleOperator[])
          : mapOperators(filterOption.filterOptions, FIELD_OPERATORS);
      const options = toOptions(filterOption.filterComboBoxOptions);
      properties.push({
        id: propertyId,
        label,
        group: groupLabel(typed, t),
        valueType,
        // Observed values are suggestions for a free-text field, not the only values it may hold.
        ...(valueType === "enum" ? { options, loadOptions: async () => options } : {}),
        ruleOperators,
      });
      fields.set(propertyId, { kind: typed, id, label });
    }
  }

  return { properties, fields };
};

const KIND_OPTIONS_TYPE: Record<TResponseFieldKind, OptionsType> = {
  question: OptionsType.ELEMENTS,
  matrixRow: OptionsType.ELEMENTS,
  attribute: OptionsType.ATTRIBUTES,
  hiddenField: OptionsType.HIDDEN_FIELDS,
  variable: OptionsType.VARIABLES,
  meta: OptionsType.META,
  quota: OptionsType.QUOTAS,
};

const questionFilterType = (
  field: TResponseFilterField,
  filter: TTableFilter
): FilterValue["filterType"] | null => {
  const type = field.elementType ?? "";
  if (PRESENCE_TYPES.has(type)) {
    if (filter.operator === "isSet") return { filterValue: "is", filterComboBoxValue: "Filled out" };
    if (filter.operator === "isNotSet") return { filterValue: "is", filterComboBoxValue: "Skipped" };
    return null;
  }
  if (EQUALS_TYPES.has(type)) {
    return filter.operator === "equals" ? { filterValue: "is", filterComboBoxValue: filter.values[0] } : null;
  }
  const label = QUESTION_LABELS[filter.operator as TRuleOperator];
  if (!label) return null;
  if (filter.operator === "includesOneOf" || filter.operator === "includesAllOf") {
    return { filterValue: label, filterComboBoxValue: [...filter.values] };
  }
  return { filterValue: label, filterComboBoxValue: filter.values[0] };
};

/** One rule as the filter row the response pipeline reads, or null when it cannot be one. */
const ruleToFilterValue = (field: TResponseFilterField, filter: TTableFilter): FilterValue | null => {
  const elementType: FilterValue["elementType"] = {
    type: KIND_OPTIONS_TYPE[field.kind],
    id: field.id,
    label: field.label,
    ...(field.elementType ? { elementType: field.elementType } : {}),
  };

  if (field.kind === "matrixRow") {
    if (filter.operator !== "equals") return null;
    return {
      elementType,
      filterType: { filterValue: field.rowLabel, filterComboBoxValue: filter.values[0] },
    };
  }
  if (field.kind === "question") {
    const filterType = questionFilterType(field, filter);
    return filterType ? { elementType, filterType } : null;
  }
  if (field.kind === "quota") {
    if (filter.operator !== "equals") return null;
    return { elementType, filterType: { filterValue: "Status", filterComboBoxValue: filter.values[0] } };
  }
  const label = FIELD_LABELS[filter.operator as TRuleOperator];
  if (!label) return null;
  return { elementType, filterType: { filterValue: label, filterComboBoxValue: filter.values[0] } };
};

const tagFilterValue = (name: string, applied: boolean): FilterValue => ({
  elementType: { type: OptionsType.TAGS, id: name, label: name },
  filterType: { filterValue: "is", filterComboBoxValue: applied ? "Applied" : "Not applied" },
});

const languageFilterValue = (filter: TTableFilter): FilterValue | null => {
  const elementType = { type: OptionsType.OTHERS, id: LANGUAGE_PROPERTY, label: "Language" };
  if (filter.operator === "in") {
    return { elementType, filterType: { filterValue: "Is any of", filterComboBoxValue: [...filter.values] } };
  }
  const label = FIELD_LABELS[filter.operator as TRuleOperator];
  if (filter.operator !== "equals" && filter.operator !== "notEquals") return null;
  return { elementType, filterType: { filterValue: label, filterComboBoxValue: filter.values[0] } };
};

const toResponseStatus = (filters: readonly TTableFilter[]): TResponseStatus => {
  const status = filters.find((filter) => filter.property === STATUS_PROPERTY && filter.operator === "in");
  const values = new Set(status?.values ?? []);
  if (values.size !== 1) return "all";
  return values.has("complete") ? "complete" : "partial";
};

const toDateRange = (filters: readonly TTableFilter[], timeZone: string, now: Date): DateRange => {
  const date = filters.find((filter) => filter.property === CREATED_AT_PROPERTY);
  const bounds = date ? resolveDateFilterBounds(date, timeZone, now) : null;
  if (!bounds?.from || !bounds.to) return { from: undefined, to: undefined };
  return { from: bounds.from, to: bounds.to };
};

/**
 * The table filters as the response pipeline's filter state. A rule whose property is unknown (a
 * question since deleted) or whose operator the field cannot take is left out rather than sent.
 */
export const toResponseFilterState = (
  filters: readonly TTableFilter[],
  fields: ReadonlyMap<string, TResponseFilterField>,
  timeZone: string,
  now: Date = new Date()
): { selectedFilter: SelectedFilterValue; dateRange: DateRange } => {
  const rows: FilterValue[] = [];
  for (const filter of filters) {
    if (filter.property === TAG_PROPERTY) {
      const applied = filter.operator === "in" || filter.operator === "equals";
      if (applied || filter.operator === "notEquals") {
        rows.push(...filter.values.map((name) => tagFilterValue(name, applied)));
      }
      continue;
    }
    if (filter.property === LANGUAGE_PROPERTY) {
      const row = languageFilterValue(filter);
      if (row) rows.push(row);
      continue;
    }
    const field = fields.get(filter.property);
    const row = field ? ruleToFilterValue(field, filter) : null;
    if (row) rows.push(row);
  }
  return {
    selectedFilter: { filter: rows, responseStatus: toResponseStatus(filters) },
    dateRange: toDateRange(filters, timeZone, now),
  };
};

const questionRule = (
  element: FilterValue["elementType"],
  filterType: FilterValue["filterType"]
): TTableFilter | null => {
  const property = `question.${element.id}`;
  const type = String(element.elementType ?? "");
  const value = filterType.filterComboBoxValue;
  if (PRESENCE_TYPES.has(type)) {
    if (value === "Filled out") return { property, operator: "isSet", values: [] };
    if (value === "Skipped") return { property, operator: "isNotSet", values: [] };
    return null;
  }
  if (EQUALS_TYPES.has(type)) {
    return typeof value === "string" ? { property, operator: "equals", values: [value] } : null;
  }
  const operator = QUESTION_OPERATORS[filterType.filterValue ?? ""];
  if (!operator) return null;
  if (operator === "isSet" || operator === "isNotSet") return { property, operator, values: [] };
  const values = (Array.isArray(value) ? value : [value]).filter(
    (item): item is string => typeof item === "string" && item.length > 0
  );
  return values.length > 0 ? { property, operator, values } : null;
};

/**
 * A filter row made outside the toolbar — the Summary's "filter by this answer" links — as the table
 * filter that stands for it. Only question rows are made there; anything else is null.
 */
export const filterValueToTableFilter = (row: FilterValue, survey: TSurvey): TTableFilter | null => {
  const { elementType: element, filterType } = row;
  if (element.type !== OptionsType.ELEMENTS || !element.id) return null;
  if (element.elementType === TSurveyElementTypeEnum.Matrix) {
    const matrix = getElementsFromBlocks(survey.blocks).find((item) => item.id === element.id);
    if (matrix?.type !== TSurveyElementTypeEnum.Matrix) return null;
    const matrixRow = matrix.rows.find(
      (item) => getLocalizedValue(item.label, "default") === filterType.filterValue
    );
    const value = filterType.filterComboBoxValue;
    if (!matrixRow || typeof value !== "string") return null;
    return { property: `question.${element.id}.${matrixRow.id}`, operator: "equals", values: [value] };
  }
  return questionRule(element, filterType);
};

/** Whether a table filter belongs to a question, matrix rows included. */
export const isQuestionFilter = (filter: TTableFilter, questionId: string): boolean =>
  filter.property === `question.${questionId}` || filter.property.startsWith(`question.${questionId}.`);
