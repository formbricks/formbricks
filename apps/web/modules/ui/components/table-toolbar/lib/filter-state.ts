import type { TTableFilter } from "./types";

// Pure edits on a table's active filters. Each returns a new list; the toolbar writes it to the URL.

const isQuickFilter = (filter: TTableFilter) =>
  filter.operator === "in" || filter.operator === "preset" || filter.operator === "between";

export const getQuickFilter = (
  filters: readonly TTableFilter[],
  property: string
): TTableFilter | undefined =>
  filters.find((filter) => filter.property === property && isQuickFilter(filter));

/** Ticks or unticks one value of an enum quick filter; unticking the last value removes the filter. */
export const toggleQuickFilterValue = (
  filters: readonly TTableFilter[],
  property: string,
  value: string
): TTableFilter[] => {
  const current = getQuickFilter(filters, property);
  if (!current) return [...filters, { property, operator: "in", values: [value] }];

  const values = current.values.includes(value)
    ? current.values.filter((existing) => existing !== value)
    : [...current.values, value];
  return values.length === 0
    ? filters.filter((filter) => filter !== current)
    : filters.map((filter) => (filter === current ? { ...filter, values } : filter));
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

/** Rules are the filters Advanced filter owns: every filter that is not a quick filter. */
export const getRules = (filters: readonly TTableFilter[]): TTableFilter[] =>
  filters.filter((filter) => !isQuickFilter(filter));

/** Replaces every Advanced filter rule at once, keeping the quick filters and their order. */
export const replaceRules = (
  filters: readonly TTableFilter[],
  rules: readonly TTableFilter[]
): TTableFilter[] => [...filters.filter(isQuickFilter), ...rules.filter((rule) => !isQuickFilter(rule))];

export { isQuickFilter };
