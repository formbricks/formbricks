import { countPickChars, exceedsPicksBudget, keepCurrentPicks } from "./dashboard-filter-picks";
import type { TDashboardFilter, TDashboardFilterPicks } from "./dashboard-filters";

/** Move the filter at `index` one place towards `direction`, or leave the list as it is at an end. */
export const moveDashboardFilter = (
  filters: readonly TDashboardFilter[],
  index: number,
  direction: -1 | 1
): TDashboardFilter[] => {
  const target = index + direction;
  if (target < 0 || target >= filters.length) return [...filters];
  const next = [...filters];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/**
 * The filters after one filter's form is saved: the filter replaces its earlier version (or is added) and
 * lands at `position`, clamped to the list. The editor applies a reorder with the rest of the form's
 * changes, on Save, never on its own.
 */
export const saveDashboardFilterAt = (
  filters: readonly TDashboardFilter[],
  filter: TDashboardFilter,
  position: number
): TDashboardFilter[] => {
  const rest = filters.filter((candidate) => candidate.id !== filter.id);
  const at = Math.min(Math.max(position, 0), rest.length);
  return [...rest.slice(0, at), filter, ...rest.slice(at)];
};

/** The picks that narrow one filter's value list: every other filter's, never its own. */
export const withoutOwnPick = (picks: TDashboardFilterPicks, filterId: string): TDashboardFilterPicks =>
  Object.fromEntries(Object.entries(picks).filter(([id]) => id !== filterId));

/** A typed filter's pick: the trimmed value, or nothing when the box is left empty. */
export const toTypedPick = (value: string): string[] => {
  const trimmed = value.trim();
  return trimmed ? [trimmed] : [];
};

/** "A", "A, B", or "A +2": what a picked filter's chip shows. */
export const summarizePickedValues = (values: readonly string[]): string =>
  values.length <= 2 ? values.join(", ") : `${values[0]} +${values.length - 1}`;

/**
 * A person's picks after one filter's values change: only filters the dashboard has, only non-empty picks.
 * A change that adds characters past `MAX_DASHBOARD_FILTER_PICKS_CHARS` is refused, as the API would refuse
 * it (C9); clearing or shrinking a pick is always allowed.
 */
export const applyDashboardFilterPick = (
  filters: readonly Pick<TDashboardFilter, "id">[],
  picks: TDashboardFilterPicks,
  filterId: string,
  values: string[]
): { picks: TDashboardFilterPicks } | { exceedsBudget: true } => {
  const current = keepCurrentPicks(filters, picks);
  const next = keepCurrentPicks(filters, { ...current, [filterId]: values });
  if (exceedsPicksBudget(next) && countPickChars(next) > countPickChars(current)) {
    return { exceedsBudget: true };
  }
  return { picks: next };
};

/** Filter labels as one phrase in the app's language ("Plan, Tier, and Region"). */
export const formatFilterLabels = (labels: readonly string[], locale: string): string =>
  new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(labels);
