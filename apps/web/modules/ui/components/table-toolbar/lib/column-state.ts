import type { VisibilityState } from "@tanstack/react-table";

/**
 * A saved column order brought up to date with the table's current columns: saved ids that still exist
 * keep their place, ids that are gone drop out, new ids are appended in their default position order.
 */
export const reconcileColumnOrder = (saved: unknown, columnIds: readonly string[]): string[] => {
  if (!Array.isArray(saved)) return [...columnIds];
  const known = new Set(columnIds);
  const kept = [...new Set(saved.filter((id): id is string => typeof id === "string" && known.has(id)))];
  const keptSet = new Set(kept);
  return [...kept, ...columnIds.filter((id) => !keptSet.has(id))];
};

/** Saved visibility for known columns, the default for the rest. */
export const reconcileColumnVisibility = (
  saved: unknown,
  columnIds: readonly string[],
  defaults: VisibilityState = {}
): VisibilityState => {
  const savedState = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  const visibility: VisibilityState = {};
  for (const id of columnIds) {
    const value = (savedState as Record<string, unknown>)[id];
    visibility[id] = typeof value === "boolean" ? value : (defaults[id] ?? true);
  }
  return visibility;
};
