import { arrayMove } from "@dnd-kit/sortable";
import { countPickChars, exceedsPicksBudget, keepCurrentPicks } from "./dashboard-filter-picks";
import type { TDashboardFilter, TDashboardFilterPicks } from "./dashboard-filters";

/**
 * The filters after one is dragged onto another's place in edit mode: the dragged filter takes the
 * drop target's index and the rest shift. A drop on itself, or on anything that is not a filter, leaves
 * the order as it is.
 */
export const reorderDashboardFilters = (
  filters: readonly TDashboardFilter[],
  activeId: string,
  overId: string
): TDashboardFilter[] => {
  const from = filters.findIndex(({ id }) => id === activeId);
  const to = filters.findIndex(({ id }) => id === overId);
  if (from === -1 || to === -1 || from === to) return [...filters];
  return arrayMove([...filters], from, to);
};

/**
 * The filters after one filter's form is saved: the filter replaces its earlier version (or is added)
 * and lands at `position`, clamped to the list.
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
 * it; clearing or shrinking a pick is always allowed.
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

/**
 * What an editable filter's chip shows in edit mode: its field and operator. The field of an
 * embedded-data key is only named once the dashboard's datasets have loaded, so until then the chip
 * shows the operator alone rather than an empty pill that then jumps wider.
 */
export const getEditableFilterChipValue = (fieldLabel: string | undefined, operatorLabel: string): string =>
  fieldLabel ? `${fieldLabel} ${operatorLabel}` : operatorLabel;
