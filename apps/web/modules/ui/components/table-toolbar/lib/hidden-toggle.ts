import type { TTableFilter } from "./types";

/**
 * A gear switch kept as a hidden filter, so the URL carries it like the other filters: "Show archived"
 * on the Workflows list, "Hide test runs" (stored as its opposite) on the Runs lists. On means the
 * property holds `"true"`.
 */
export const isHiddenToggleOn = (filters: readonly TTableFilter[], property: string): boolean =>
  filters.some((filter) => filter.property === property && filter.values.includes("true"));

export const setHiddenToggle = (
  filters: readonly TTableFilter[],
  property: string,
  on: boolean
): TTableFilter[] => {
  const rest = filters.filter((filter) => filter.property !== property);
  return on ? [...rest, { property, operator: "in", values: ["true"] }] : rest;
};
