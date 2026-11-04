import type { TChartQuery, TCubeFilter, TMemberFilter } from "@formbricks/types/analysis";
import {
  type TDashboardFilter,
  type TDashboardFilterPicks,
  isListDashboardFilter,
} from "./dashboard-filters";

/**
 * How a person's dashboard filter picks reach a chart query (ADR-0024). Pure functions over the Cube query
 * JSON, so any field the catalog lists — embedded-data members included — narrows the same way.
 */

/**
 * AND `filters` onto a query's saved filters. Cube ANDs the entries of the top-level `filters` array, so
 * appending keeps every saved rule exactly as it was, at any depth — a saved top-level OR stays one entry —
 * and a rule on the same field is narrowed further, never replaced.
 */
export const narrowWithFilters = (query: TChartQuery, filters: readonly TCubeFilter[]): TChartQuery =>
  filters.length === 0 ? query : { ...query, filters: [...(query.filters ?? []), ...filters] };

/**
 * The values a pick applies: a list filter takes every chosen value ("is any of"), any other filter its one
 * typed value. Blank values are dropped; `null` when nothing is left, so the filter is not applied.
 */
export const pickValuesOf = (
  filter: Pick<TDashboardFilter, "field" | "operator">,
  values: readonly string[] | undefined
): string[] | null => {
  const kept = (values ?? []).filter((value) => value.trim() !== "");
  if (kept.length === 0) return null;
  return isListDashboardFilter(filter) ? kept : [kept[0]];
};

/** The filter rule one pick adds to a chart query. */
export const toPickRule = (filter: TDashboardFilter, values: string[]): TMemberFilter => ({
  member: filter.field,
  operator: filter.operator,
  values,
});

export type TResolvedPicks = {
  /** The rules to AND onto the chart's query, in the dashboard's filter order. */
  rules: TMemberFilter[];
  /** Picked filters whose field the chart's Feedback Dataset lacks: the chart shows no data. */
  unfilterable: TDashboardFilter[];
};

/**
 * Resolve picks against one chart's Feedback Dataset. Picks for filters the dashboard no longer has are
 * dropped; a picked filter whose field the dataset lacks makes the chart unfilterable rather than being
 * skipped, since skipping it would show the chart wider than the pick.
 */
export const resolvePicksForDataset = (
  filters: readonly TDashboardFilter[],
  picks: TDashboardFilterPicks,
  datasetHasField: (field: string) => boolean,
  { except }: { except?: string } = {}
): TResolvedPicks => {
  const rules: TMemberFilter[] = [];
  const unfilterable: TDashboardFilter[] = [];

  for (const filter of filters) {
    if (filter.id === except) continue;
    const values = pickValuesOf(filter, picks[filter.id]);
    if (!values) continue;
    if (datasetHasField(filter.field)) rules.push(toPickRule(filter, values));
    else unfilterable.push(filter);
  }

  return { rules, unfilterable };
};

const PICK_PARAM = /^picks\[([^\]]+)\]$/;

/**
 * Gather `picks[<filterId>]=value` parameters (repeated for several values) into one `picks` object, and
 * leave every other parameter as it was — the shape the routes' schemas validate, and the page's URL reads.
 */
export const splitPickParams = (params: unknown): unknown => {
  if (typeof params !== "object" || params === null || Array.isArray(params)) return params;
  const rest: Record<string, unknown> = {};
  const picks: Record<string, string[]> = {};
  for (const [name, value] of Object.entries(params)) {
    const match = PICK_PARAM.exec(name);
    if (!match) rest[name] = value;
    else if (typeof value === "string") picks[match[1]] = [value];
    else picks[match[1]] = value as string[];
  }
  return Object.keys(picks).length > 0 ? { ...rest, picks } : rest;
};

/** The query parameter a pick travels in, on the API and in the dashboard page's URL. */
export const pickParamName = (filterId: string): string => `picks[${filterId}]`;

/** Picks as `picks[<id>]` parameters, in the dashboard's filter order, for a stable cache key and URL. */
export const appendPickParams = (
  params: URLSearchParams,
  picks: TDashboardFilterPicks,
  filterOrder?: readonly string[]
): URLSearchParams => {
  const ids = filterOrder ? filterOrder.filter((id) => id in picks) : Object.keys(picks).sort();
  for (const id of ids) {
    for (const value of picks[id] ?? []) params.append(pickParamName(id), value);
  }
  return params;
};

/**
 * Keep only picks for filters the dashboard still has, with at least one value. A remembered value that no
 * longer occurs in the data is kept: the person chose it, and the chart says it is empty.
 */
export const keepCurrentPicks = (
  filters: readonly Pick<TDashboardFilter, "id">[],
  picks: TDashboardFilterPicks
): TDashboardFilterPicks => {
  const current: TDashboardFilterPicks = {};
  for (const { id } of filters) {
    const values = picks[id]?.filter((value) => value !== "");
    if (values && values.length > 0) current[id] = values;
  }
  return current;
};

/** Picks a person made are kept like the dashboard date: in the URL, and in a per-dashboard cookie. */
export const getFilterPicksCookieName = (dashboardId: string): string =>
  `fb_dashboard_filter_picks_${dashboardId}`;

/** Remembered picks live as long as a remembered date range: 30 days, refreshed on every change. */
const FILTER_PICKS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Browsers drop a cookie over 4 KB; picks that would not fit are kept in the URL only. */
const MAX_FILTER_PICKS_COOKIE_LENGTH = 3500;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** Picks read back from storage, or `{}` for anything malformed. */
export const deserializeFilterPicks = (raw: string | null | undefined): TDashboardFilterPicks => {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  const picks: TDashboardFilterPicks = {};
  for (const [id, values] of Object.entries(parsed)) {
    if (isStringArray(values) && values.length > 0) picks[id] = values;
  }
  return picks;
};

/** Remember (or forget, when empty) a person's picks on one dashboard. Client-only; a no-op on the server. */
export const writeStoredFilterPicks = (dashboardId: string, picks: TDashboardFilterPicks): void => {
  if (typeof document === "undefined") return;
  const name = getFilterPicksCookieName(dashboardId);
  const value = encodeURIComponent(JSON.stringify(picks));
  if (Object.keys(picks).length === 0 || value.length > MAX_FILTER_PICKS_COOKIE_LENGTH) {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
    return;
  }
  document.cookie = `${name}=${value}; path=/; max-age=${FILTER_PICKS_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
};

/** The picks pinned in a page URL, or `null` when the URL pins none, so remembered ones apply. */
export const readFilterPicksFromUrl = (searchParams: URLSearchParams): TDashboardFilterPicks | null => {
  let found = false;
  const picks: TDashboardFilterPicks = {};
  for (const name of new Set(searchParams.keys())) {
    const match = PICK_PARAM.exec(name);
    if (!match) continue;
    found = true;
    const values = searchParams.getAll(name).filter((value) => value !== "");
    if (values.length > 0) picks[match[1]] = values;
  }
  return found ? picks : null;
};

/** Replace the picks in a page URL's parameters, leaving every other parameter as it was. */
export const writeFilterPicksToUrl = (
  searchParams: URLSearchParams,
  picks: TDashboardFilterPicks,
  filterOrder: readonly string[]
): URLSearchParams => {
  const next = new URLSearchParams();
  for (const [name, value] of searchParams.entries()) {
    if (!PICK_PARAM.test(name)) next.append(name, value);
  }
  return appendPickParams(next, picks, filterOrder);
};
