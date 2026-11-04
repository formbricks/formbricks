import { z } from "zod";
import { zPostgresText } from "@/lib/utils/postgres-text";
import { isEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-data-fields";
import {
  FILTER_ONLY_FIELDS,
  type TChartField,
  getChartField,
  toEmbeddedChartField,
} from "@/modules/ee/analysis/lib/field-catalog";
import type { FilterOperator } from "@/modules/ee/analysis/lib/schema-definition";

/**
 * Dashboard filters (ADR-0024, glossary "Dashboard filter"): a field and an operator a dashboard's editors pin
 * to its top bar, in order. Everyone who opens the dashboard picks or enters the value; the pick narrows every
 * chart, never widens one.
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
 * The operators a dashboard filter may use: every operator that compares against a value. `set` and
 * `notSet` take none, so there would be nothing for a person to pick.
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
] as const satisfies readonly FilterOperator[];

export type TDashboardFilterOperator = (typeof DASHBOARD_FILTER_OPERATORS)[number];

export const ZDashboardFilter = z
  .object({
    id: z.cuid2(),
    field: z.string().min(1).max(255),
    operator: z.enum(DASHBOARD_FILTER_OPERATORS),
    label: zPostgresText().trim().min(1).max(MAX_DASHBOARD_FILTER_LABEL_LENGTH),
  })
  .strict();

export type TDashboardFilter = z.infer<typeof ZDashboardFilter>;

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

/** The operators a field allows as a dashboard filter: the catalog's, less those that take no value. */
export const getDashboardFilterOperators = (fieldName: string): TDashboardFilterOperator[] => {
  const field = getDashboardFilterField(fieldName);
  if (!field) return [];
  return DASHBOARD_FILTER_OPERATORS.filter((operator) => field.filterOperators.includes(operator));
};

/**
 * Whether the filter picks from a list of values that occur (is, is not — each of any of several values)
 * rather than taking one typed value. Lists exist only for categorical fields: those the catalog has a
 * value lookup for (`valueLookup`), and embedded-data keys. A free-text field (`valueText`, `userId`, a
 * page URL) can still be a filter, but its value is typed: listing its values would hand every reader
 * of the dashboard the raw text of every record the charts read.
 */
export const isListDashboardFilter = (filter: Pick<TDashboardFilter, "field" | "operator">): boolean => {
  if (filter.operator !== "equals" && filter.operator !== "notEquals") return false;
  const field = getDashboardFilterField(filter.field);
  return field?.type === "string" && field.valueLookup;
};

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

/** A dashboard's saved filters, read defensively: a JSON column could hold anything. */
export const parseStoredDashboardFilters = (value: unknown): TDashboardFilter[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = ZDashboardFilter.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
};
