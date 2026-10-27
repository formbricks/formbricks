import type { TFilterProperty, TTableFilter } from "./types";

// Pure edits on a table's active filters. Each returns a new list; the toolbar writes it to the URL.

const isQuickFilter = (filter: TTableFilter) =>
  filter.operator === "in" || filter.operator === "preset" || filter.operator === "between";

export const getQuickFilter = (
  filters: readonly TTableFilter[],
  property: string
): TTableFilter | undefined =>
  filters.find((filter) => filter.property === property && isQuickFilter(filter));

/**
 * Every value a property can hold, when its list is fixed and has a choice in it; undefined for lists
 * loaded on demand, single-value switches and hidden view switches (Show archived), where "all" still
 * means something.
 */
export const getFixedValues = (property: TFilterProperty): string[] | undefined => {
  if (!property.options || property.loadOptions || property.hidden || property.options.length < 2) {
    return undefined;
  }
  return property.options.map((option) => option.value);
};

/** Whether ticked values cover a fixed list completely: a filter that keeps every row filters nothing. */
export const coversAllValues = (values: readonly string[], allValues: readonly string[] | undefined) =>
  !!allValues && allValues.length > 0 && allValues.every((value) => values.includes(value));

/**
 * Ticks or unticks one value of an enum quick filter. Unticking the last value removes the filter, and so
 * does ticking every value of a fixed list: "any status" is no filter, and should page like none.
 */
export const toggleQuickFilterValue = (
  filters: readonly TTableFilter[],
  property: string,
  value: string,
  allValues?: readonly string[]
): TTableFilter[] => {
  const current = getQuickFilter(filters, property);
  const previous = current?.values ?? [];
  const values = previous.includes(value)
    ? previous.filter((existing) => existing !== value)
    : [...previous, value];
  const rest = filters.filter((filter) => filter !== current);
  if (values.length === 0 || coversAllValues(values, allValues)) return rest;
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

/** Rules are the filters Advanced filter owns: every filter that is not a quick filter. */
export const getRules = (filters: readonly TTableFilter[]): TTableFilter[] =>
  filters.filter((filter) => !isQuickFilter(filter));

/** Replaces every Advanced filter rule at once, keeping the quick filters and their order. */
export const replaceRules = (
  filters: readonly TTableFilter[],
  rules: readonly TTableFilter[]
): TTableFilter[] => [...filters.filter(isQuickFilter), ...rules.filter((rule) => !isQuickFilter(rule))];

export { isQuickFilter };
