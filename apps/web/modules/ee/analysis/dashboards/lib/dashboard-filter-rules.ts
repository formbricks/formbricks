import {
  DASHBOARD_FILTER_OPERATORS,
  type TDashboardFilter,
  type TDashboardFilterOperator,
  findDashboardFilterIssues,
} from "./dashboard-filters";

/**
 * The filters a person puts on a dashboard (ADR-0026): a field and an operator each, with the values
 * picked beside them under the same id. They travel with every read as `filter[<id>]=<operator>:<field>`
 * next to `picks[<id>]=<value>`, so the server holds no list of them: any dimension of the charts'
 * datasets, or an embedded-data field, can be filtered by. An id only names a filter within one request;
 * the page numbers them `f1`, `f2`, …
 */

/** What an id may be: short, and safe in a query-parameter name. */
export const FILTER_RULE_ID = /^[A-Za-z0-9_-]{1,24}$/;

const FILTER_RULE_PARAM = /^filter\[([^\]]+)\]$/;

/** The filters of one request, by id: `<operator>:<field>`. */
export type TFilterRules = Record<string, string>;

/** The query parameter a filter's definition travels in, on the API and in the dashboard page's URL. */
export const filterRuleParamName = (id: string): string => `filter[${id}]`;

/** The id a `filter[<id>]` parameter names, or `null` for any other parameter. */
export const filterRuleIdOf = (paramName: string): string | null =>
  FILTER_RULE_PARAM.exec(paramName)?.[1] ?? null;

export const encodeFilterRule = ({ field, operator }: Pick<TDashboardFilter, "field" | "operator">): string =>
  `${operator}:${field}`;

const isOperator = (value: string): value is TDashboardFilterOperator =>
  (DASHBOARD_FILTER_OPERATORS as readonly string[]).includes(value);

/** A filter from its `<operator>:<field>` form, or `null` when that is not what it holds. */
export const decodeFilterRule = (id: string, encoded: string): TDashboardFilter | null => {
  const separator = encoded.indexOf(":");
  if (separator < 1) return null;
  const operator = encoded.slice(0, separator);
  const field = encoded.slice(separator + 1);
  if (!isOperator(operator) || field === "") return null;
  return { id, field, operator, label: field };
};

/** One filter as a caller states it: a field, an operator and, once picked, its values. */
export type TFilterSpec = Pick<TDashboardFilter, "field" | "operator"> & { values?: readonly string[] };

/**
 * Filters stated as a list, as the request's `filter[<id>]` and `picks[<id>]` parameters: numbered `f1`,
 * `f2`, … in the order given. A filter without values is named but picks nothing.
 */
export const toRequestFilters = (
  specs: readonly TFilterSpec[]
): { rules: TFilterRules; picks: Record<string, string[]> } => {
  const rules: TFilterRules = {};
  const picks: Record<string, string[]> = {};
  specs.forEach((spec, index) => {
    const id = `f${index + 1}`;
    rules[id] = encodeFilterRule(spec);
    const values = (spec.values ?? []).filter((value) => value.trim() !== "");
    if (values.length > 0) picks[id] = [...values];
  });
  return { rules, picks };
};

/** A problem with a request's filters, shaped as a v3 `invalid_params` entry. */
export type TFilterRuleIssue = { name: string; reason: string };

/**
 * The filters a request names, in the order given, and what is wrong with them: a definition that is not
 * `<operator>:<field>`, a field that is not a dimension of the catalog or an embedded-data field, or an
 * operator the field does not allow. Each problem is named by its parameter.
 */
export const resolveFilterRules = (
  rules: TFilterRules | undefined
): { filters: TDashboardFilter[]; issues: TFilterRuleIssue[] } => {
  const filters: TDashboardFilter[] = [];
  const issues: TFilterRuleIssue[] = [];
  for (const [id, encoded] of Object.entries(rules ?? {})) {
    const filter = decodeFilterRule(id, encoded);
    if (filter) filters.push(filter);
    else {
      issues.push({
        name: filterRuleParamName(id),
        reason: `Must be <operator>:<field>, with an operator of ${DASHBOARD_FILTER_OPERATORS.join(", ")}.`,
      });
    }
  }
  for (const issue of findDashboardFilterIssues(filters)) {
    const filter = typeof issue.path[0] === "number" ? filters[issue.path[0]] : undefined;
    if (filter) issues.push({ name: filterRuleParamName(filter.id), reason: issue.message });
  }
  return { filters, issues };
};
