import { z } from "zod";
import { zPostgresText } from "@/lib/utils/postgres-text";
import { isEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-data-fields";
import {
  FILTER_ONLY_FIELDS,
  type TChartField,
  getChartField,
  toEmbeddedChartField,
} from "@/modules/ee/analysis/lib/field-catalog";
import {
  EMOTIONS_DIMENSION_ID,
  EMOTION_VALUES,
  type FilterOperator,
} from "@/modules/ee/analysis/lib/schema-definition";

/**
 * Dashboard filters (ADR-0026, glossary "Dashboard filter"): a field, an operator and the values compared
 * against. A person's own filters travel with each read; the ones an editor locks are saved on the
 * dashboard and apply to everyone who opens it, on top of their own. Either kind narrows every chart,
 * never widens one.
 */

/** Most filters one dashboard holds. */
export const MAX_DASHBOARD_FILTERS = 10;

/** Longest label a filter shows in the top bar. */
export const MAX_DASHBOARD_FILTER_LABEL_LENGTH = 100;

/** Most values one pick holds — the size of one value list, and of a chart filter's `values`. */
export const MAX_DASHBOARD_FILTER_PICK_VALUES = 100;

/** Longest picked or typed value, as a chart filter value is bounded. */
export const MAX_DASHBOARD_FILTER_PICK_VALUE_LENGTH = 1000;

/**
 * The operators a dashboard filter may use: every operator that compares against values, and `set` /
 * `notSet` ("is set", "is not set"), which compare against none.
 */
export const DASHBOARD_FILTER_OPERATORS = [
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "gt",
  "gte",
  "lt",
  "lte",
  "set",
  "notSet",
] as const satisfies readonly FilterOperator[];

export type TDashboardFilterOperator = (typeof DASHBOARD_FILTER_OPERATORS)[number];

/** The operators that compare against no value: such a filter applies with no values at all. */
const NO_VALUE_OPERATORS: ReadonlySet<TDashboardFilterOperator> = new Set(["set", "notSet"]);

/** Whether a filter with this operator compares against values; `set` and `notSet` take none. */
export const dashboardFilterTakesValues = (operator: TDashboardFilterOperator): boolean =>
  !NO_VALUE_OPERATORS.has(operator);

/**
 * The value a list filter's "(No value)" option stands for: a record without a value for the field. A
 * control character starts it, so no stored value can be it, and it never reaches Cube: picked with
 * values, "is" matches any of them or no value, "is not" a value that is none of them
 * (`toPickRule`). Only list filters take it (`findPickIssues`).
 */
export const NO_VALUE_PICK = "\u001Fnone";

/** Why a locked filter's values do not suit its operator, or `null` when they do. */
export const lockedValuesProblem = (
  filter: Pick<TDashboardFilter, "operator"> & { values: readonly string[] }
): string | null => {
  if (!dashboardFilterTakesValues(filter.operator)) {
    return filter.values.length === 0 ? null : "set and notSet compare against no value: leave values empty.";
  }
  return filter.values.length > 0 ? null : "Needs at least one value.";
};

export const ZDashboardFilter = z
  .object({
    id: z.cuid2(),
    field: z.string().min(1).max(255),
    operator: z.enum(DASHBOARD_FILTER_OPERATORS),
    label: zPostgresText().trim().min(1).max(MAX_DASHBOARD_FILTER_LABEL_LENGTH),
  })
  .strict();

export type TDashboardFilter = z.infer<typeof ZDashboardFilter>;

/**
 * A filter locked on the dashboard by an editor: saved with its values, so it applies to every read of the
 * dashboard, whoever reads it, and a viewer cannot take it off. A `set` / `notSet` filter holds no values;
 * every other one at least one.
 */
export const ZLockedDashboardFilter = ZDashboardFilter.extend({
  values: z
    .array(zPostgresText().trim().min(1).max(MAX_DASHBOARD_FILTER_PICK_VALUE_LENGTH))
    .max(MAX_DASHBOARD_FILTER_PICK_VALUES),
})
  .strict()
  .superRefine((filter, ctx) => {
    const problem = lockedValuesProblem(filter);
    if (problem) ctx.addIssue({ code: "custom", message: problem, path: ["values"] });
  });

export type TLockedDashboardFilter = z.infer<typeof ZLockedDashboardFilter>;

/** A person's picks: the values entered or chosen per filter id. A filter with no values is not applied. */
export type TDashboardFilterPicks = Record<string, string[]>;

/**
 * A field a dashboard filter can use: a dimension from the field catalog, or an embedded-data key
 * (`FeedbackRecords.ed_…`). Measures are left out: a filter on one is a condition on each chart's
 * own groups, which means something different on every chart. Filter-only fields (the answer filter) are
 * left out too: their values are `<questionId>:<valueKey>` rules authored in the chart builder, not
 * something a person picks or types in a top bar. An embedded key's member name is the same in
 * every dataset that has the key, so the filter matches each chart whose dataset has it; which datasets do
 * is the server's to say, so this only knows it is a text dimension and labels it by its member name until
 * a dataset's catalog names the key (`getDashboardFilterFieldLabel`).
 */
export const getDashboardFilterField = (name: string): TChartField | undefined => {
  if (isEmbeddedMemberName(name)) return toEmbeddedChartField({ name, key: name });
  const field = getChartField(name);
  return field && field.kind !== "measure" && !FILTER_ONLY_FIELDS.has(field.name) ? field : undefined;
};

/** The operators a field allows as a dashboard filter: the catalog's that a dashboard filter may use. */
export const getDashboardFilterOperators = (fieldName: string): TDashboardFilterOperator[] => {
  const field = getDashboardFilterField(fieldName);
  if (!field) return [];
  return DASHBOARD_FILTER_OPERATORS.filter((operator) => field.filterOperators.includes(operator));
};

/**
 * Whether the filter picks from a list of values that occur (is, is not — each of any of several values)
 * rather than taking one typed value. Lists exist only for categorical fields: those the catalog has a
 * value lookup for (`valueLookup`), embedded-data keys, and yes/no fields. A free-text field
 * (`valueText`, `userId`, a page URL) can still be a filter, but its value is typed: listing its values
 * would hand every reader of the dashboard the raw text of every record the charts read.
 */
export const isListDashboardFilter = (filter: Pick<TDashboardFilter, "field" | "operator">): boolean => {
  if (filter.operator !== "equals" && filter.operator !== "notEquals") return false;
  const field = getDashboardFilterField(filter.field);
  return field?.type === "boolean" || (field?.type === "string" && field.valueLookup);
};

/**
 * Fields whose value is a set of labels from a fixed list, stored joined into one text ("joy, surprise"):
 * the AI-detected emotions. "is" would match only records holding exactly the picked set, so such a field
 * is filtered by single labels with `contains` / `notContains`, each taking several: "contains any of"
 * is Cube's `contains` with several values, which ORs them, and "contains none of" its `notContains`,
 * which ANDs them (records without a value pass it, as they pass `notEquals`). A label matches as a
 * substring, which is exact only because no label is part of another — joy, anger, sadness, fear,
 * surprise and disgust are not; a label added to the list must keep that true.
 */
const MULTI_LABEL_FIELDS: ReadonlyMap<string, readonly string[]> = new Map([
  [EMOTIONS_DIMENSION_ID, EMOTION_VALUES],
]);

/** The labels a multi-label field picks from, or `undefined` for any other field. */
export const getMultiLabelValues = (field: string): readonly string[] | undefined =>
  MULTI_LABEL_FIELDS.get(field);

/** Whether the filter picks labels of a multi-label field: "contains any of" / "contains none of". */
export const isMultiLabelDashboardFilter = (filter: Pick<TDashboardFilter, "field" | "operator">): boolean =>
  (filter.operator === "contains" || filter.operator === "notContains") &&
  MULTI_LABEL_FIELDS.has(filter.field);

/**
 * Whether the filter takes several values: a list filter (any of / none of the values that occur) or a
 * multi-label filter (contains any of / none of the labels). Every other filter takes one value or none.
 */
export const dashboardFilterTakesSeveralValues = (
  filter: Pick<TDashboardFilter, "field" | "operator">
): boolean => isListDashboardFilter(filter) || isMultiLabelDashboardFilter(filter);

export type TDashboardFilterIssue = { path: (string | number)[]; message: string };

/**
 * What makes a list of dashboard filters unsavable: more than `MAX_DASHBOARD_FILTERS`, a field not in the
 * catalog, an operator the field does not allow, or an id used twice. Every problem is reported, each at
 * its position.
 */
export const findDashboardFilterIssues = (filters: readonly TDashboardFilter[]): TDashboardFilterIssue[] => {
  const issues: TDashboardFilterIssue[] = [];
  if (filters.length > MAX_DASHBOARD_FILTERS) {
    issues.push({ path: [], message: `A dashboard holds at most ${MAX_DASHBOARD_FILTERS} filters.` });
  }

  const seen = new Set<string>();
  filters.forEach((filter, index) => {
    if (seen.has(filter.id)) {
      issues.push({ path: [index, "id"], message: "Each filter id may appear once." });
    }
    seen.add(filter.id);

    if (!getDashboardFilterField(filter.field)) {
      issues.push({
        path: [index, "field"],
        message: "Must be a dimension from the field catalog or an embedded-data field.",
      });
      return;
    }
    if (!getDashboardFilterOperators(filter.field).includes(filter.operator)) {
      issues.push({ path: [index, "operator"], message: "This field does not allow this operator." });
    }
  });

  return issues;
};

/**
 * A dashboard's locked filters as stored, with how many entries could not be read: a JSON column could
 * hold anything. Nothing stored (`null`) is no filters; anything but a list is one unreadable entry.
 */
export const readStoredDashboardFilters = (
  value: unknown
): { filters: TLockedDashboardFilter[]; unreadable: number } => {
  if (value === null || value === undefined) return { filters: [], unreadable: 0 };
  if (!Array.isArray(value)) return { filters: [], unreadable: 1 };
  const filters: TLockedDashboardFilter[] = [];
  let unreadable = 0;
  for (const item of value) {
    const parsed = ZLockedDashboardFilter.safeParse(item);
    if (parsed.success) filters.push(parsed.data);
    else unreadable += 1;
  }
  return { filters, unreadable };
};

/**
 * The locked filters that can be read, for showing them (the dashboard resource, the editor). Never for
 * narrowing a read: a locked filter left out there would widen what readers see — chart data and value
 * lists go through `withLockedFilters`, which refuses instead.
 */
export const parseStoredDashboardFilters = (value: unknown): TLockedDashboardFilter[] =>
  readStoredDashboardFilters(value).filters;
