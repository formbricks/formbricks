import { writeDashboardCookie } from "./dashboard-cookies";
import { exceedsPicksBudget } from "./dashboard-filter-picks";
import {
  type TFilterSpec,
  decodeFilterRule,
  filterRuleIdOf,
  filterRuleParamName,
  resolveFilterRules,
  toRequestFilters,
} from "./dashboard-filter-rules";
import { MAX_DASHBOARD_FILTERS } from "./dashboard-filters";

/**
 * The filters a person has put on a dashboard (ADR-0026): an ordered list, kept in the page URL so the view
 * can be shared and in a per-dashboard cookie so a revisit starts from it. The URL and every read carry
 * them the same way, as `filter[f1]=<operator>:<field>` with the values in `picks[f1]`, numbered in order.
 */

/** A filter with the values it is set to: nothing to apply without one. */
export type TDashboardFilterState = TFilterSpec & { values: string[] };

const PICK_PARAM = /^picks\[([^\]]+)\]$/;

/** The filters worth keeping: at most `MAX_DASHBOARD_FILTERS`, each valid and holding a value. */
export const keepValidFilters = (filters: readonly TFilterSpec[]): TDashboardFilterState[] => {
  const withValues = filters
    .map((filter) => ({ ...filter, values: (filter.values ?? []).filter((value) => value.trim() !== "") }))
    .filter((filter) => filter.values.length > 0)
    .slice(0, MAX_DASHBOARD_FILTERS);
  const { rules } = toRequestFilters(withValues);
  const { issues } = resolveFilterRules(rules);
  const invalid = new Set(issues.map(({ name }) => name));
  return withValues.filter((_, index) => !invalid.has(filterRuleParamName(`f${index + 1}`)));
};

/** Whether the filters' values take more than a read's URL may carry (`MAX_DASHBOARD_FILTER_PICKS_CHARS`). */
export const exceedsFiltersBudget = (filters: readonly TFilterSpec[]): boolean =>
  exceedsPicksBudget(toRequestFilters(filters).picks);

/** The filters as the `filter[<id>]` and `picks[<id>]` parameters of a read or of the page's URL. */
export const appendFilterParams = (
  params: URLSearchParams,
  filters: readonly TFilterSpec[]
): URLSearchParams => {
  const { rules, picks } = toRequestFilters(filters);
  for (const [id, rule] of Object.entries(rules)) {
    params.append(filterRuleParamName(id), rule);
    for (const value of picks[id] ?? []) params.append(`picks[${id}]`, value);
  }
  return params;
};

/** The filters pinned in a page URL, or `null` when the URL pins none, so remembered ones apply. */
export const readFiltersFromUrl = (searchParams: URLSearchParams): TDashboardFilterState[] | null => {
  const ids = [...new Set(searchParams.keys())].flatMap((name) => {
    const id = filterRuleIdOf(name);
    return id === null ? [] : [id];
  });
  if (ids.length === 0 && ![...searchParams.keys()].some((name) => PICK_PARAM.test(name))) return null;
  const filters = ids.flatMap((id) => {
    const rule = decodeFilterRule(id, searchParams.get(filterRuleParamName(id)) ?? "");
    return rule
      ? [{ field: rule.field, operator: rule.operator, values: searchParams.getAll(`picks[${id}]`) }]
      : [];
  });
  return keepValidFilters(filters);
};

/** Replace the filters in a page URL's parameters, leaving every other parameter as it was. */
export const writeFiltersToUrl = (
  searchParams: URLSearchParams,
  filters: readonly TFilterSpec[]
): URLSearchParams => {
  const next = new URLSearchParams();
  for (const [name, value] of searchParams.entries()) {
    if (filterRuleIdOf(name) === null && !PICK_PARAM.test(name)) next.append(name, value);
  }
  return appendFilterParams(next, filters);
};

/** The cookie a dashboard remembers a person's filters in. */
export const getFiltersCookieName = (dashboardId: string): string => `fb_dashboard_filters_${dashboardId}`;

/** Remembered filters live as long as a remembered date range: 30 days, refreshed on every change. */
const FILTERS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const isFilterShape = (value: unknown): value is TFilterSpec & { values: string[] } => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.field === "string" &&
    typeof candidate.operator === "string" &&
    Array.isArray(candidate.values) &&
    candidate.values.every((item) => typeof item === "string")
  );
};

/**
 * The stored JSON, whether it comes still percent-encoded (`document.cookie`) or already decoded (the
 * server's cookie store decodes values). Decoding twice would lose a value holding `%`, so a value that
 * already parses as JSON is taken as it is.
 */
const parseStoredJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(decodeURIComponent(raw));
  }
};

/** Filters read back from storage, encoded or not, or `[]` for anything malformed. */
export const deserializeFilters = (raw: string | null | undefined): TDashboardFilterState[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = parseStoredJson(raw);
    return Array.isArray(parsed) ? keepValidFilters(parsed.filter(isFilterShape)) : [];
  } catch {
    return [];
  }
};

/**
 * Remember (or forget, when none) a person's filters on one dashboard, in a cookie scoped to the dashboard's
 * page. Filters too long for a cookie are kept in the URL only. Client-only; a no-op on the server.
 */
export const writeStoredFilters = (dashboardId: string, filters: readonly TFilterSpec[]): void =>
  writeDashboardCookie(
    getFiltersCookieName(dashboardId),
    filters.length === 0
      ? null
      : encodeURIComponent(
          JSON.stringify(
            filters.map(({ field, operator, values }) => ({ field, operator, values: values ?? [] }))
          )
        ),
    FILTERS_COOKIE_MAX_AGE_SECONDS
  );
