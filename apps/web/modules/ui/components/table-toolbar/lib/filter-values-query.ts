import type { QueryKey } from "@tanstack/react-query";
import type { TFilterOptionsPage, TFilterProperty } from "./types";

const EMPTY_PAGE: TFilterOptionsPage = { options: [], hasMore: false };

/**
 * The query that loads one search of a property's value list. A property that brings its own key is
 * cached where its owner can invalidate it; the query's abort signal reaches the loader, so a search
 * superseded by the next keystroke stops instead of finishing for nothing.
 */
export const getFilterValuesQuery = (
  property: TFilterProperty,
  search: string
): { queryKey: QueryKey; queryFn: (context: { signal: AbortSignal }) => Promise<TFilterOptionsPage> } => ({
  queryKey: property.queryKey?.(search) ?? ["table-filter-values", property.id, search],
  queryFn: ({ signal }) => property.loadOptions?.(search, signal) ?? Promise.resolve(EMPTY_PAGE),
});
