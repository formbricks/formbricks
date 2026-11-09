import type { TTableFilter } from "./types";

// Pure edits on a table's active filters. Each returns a new list; the toolbar writes it to the URL.

const isQuickFilter = (filter: TTableFilter) =>
  filter.operator === "in" || filter.operator === "preset" || filter.operator === "between";

export const getQuickFilter = (
  filters: readonly TTableFilter[],
  property: string
): TTableFilter | undefined =>
  filters.find((filter) => filter.property === property && isQuickFilter(filter));

/** The values a property's locked quick filters already tick: one list, each value once. */
export const getLockedQuickValues = (locked: readonly TTableFilter[], property: string): string[] => [
  ...new Set(
    locked
      .filter((filter) => filter.property === property && filter.operator === "in")
      .flatMap((f) => f.values)
  ),
];

/**
 * Ticks or unticks one value of an enum quick filter. Unticking the last value removes the filter.
 * Ticking every value keeps it: one tick too many is undone with one untick, not by rebuilding it.
 */
export const toggleQuickFilterValue = (
  filters: readonly TTableFilter[],
  property: string,
  value: string
): TTableFilter[] => {
  const current = getQuickFilter(filters, property);
  const previous = current?.values ?? [];
  const values = previous.includes(value)
    ? previous.filter((existing) => existing !== value)
    : [...previous, value];
  const rest = filters.filter((filter) => filter !== current);
  if (values.length === 0) return rest;
  if (!current) return [...filters, { property, operator: "in", values }];
  return filters.map((filter) => (filter === current ? { ...filter, values } : filter));
};

/** Sets a property's date quick filter to a preset or a range, replacing the one it had. */
export const setDateQuickFilter = (
  filters: readonly TTableFilter[],
  property: string,
  next: { operator: "preset"; preset: string } | { operator: "between"; from: string; to: string } | null
): TTableFilter[] => {
  const rest = filters.filter((filter) => !(filter.property === property && isQuickFilter(filter)));
  if (!next) return rest;
  const filter: TTableFilter =
    next.operator === "preset"
      ? { property, operator: "preset", values: [next.preset] }
      : { property, operator: "between", values: [next.from, next.to] };
  return [...rest, filter];
};

export const removeFilterAt = (filters: readonly TTableFilter[], index: number): TTableFilter[] =>
  filters.filter((_, i) => i !== index);

/** Puts `filter` in place of the one at `index`, keeping the rest and their order. */
export const replaceFilterAt = (
  filters: readonly TTableFilter[],
  index: number,
  filter: TTableFilter
): TTableFilter[] => filters.map((existing, i) => (i === index ? filter : existing));

/** Rules are the filters Advanced filter owns: every filter that is not a quick filter. */
export const getRules = (filters: readonly TTableFilter[]): TTableFilter[] =>
  filters.filter((filter) => !isQuickFilter(filter));

/** Replaces every Advanced filter rule at once, keeping the quick filters and their order. */
export const replaceRules = (
  filters: readonly TTableFilter[],
  rules: readonly TTableFilter[]
): TTableFilter[] => [...filters.filter(isQuickFilter), ...rules.filter((rule) => !isQuickFilter(rule))];

export { isQuickFilter };
