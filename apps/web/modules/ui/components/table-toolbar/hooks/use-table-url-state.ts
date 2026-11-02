"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { TFilterProperty, TTableFilter } from "../lib/types";
import { SEARCH_PARAM, SORT_PARAM, buildTableSearchParams, parseTableFilters } from "../lib/url-codec";

type TTableUrlState = {
  filters: TTableFilter[];
  search: string;
  sortBy: string;
};

/**
 * A table's filters, search and sort, read from and written to the page URL (ADR 0015). Writes use
 * `history.replaceState`, which Next.js syncs into `useSearchParams` without a navigation, so typing in
 * search or ticking a value does not refetch the page or pile up history entries.
 */
export const useTableUrlState = ({
  properties,
  sortOptions,
  defaultSortBy,
}: {
  properties: readonly TFilterProperty[];
  sortOptions: readonly string[];
  defaultSortBy: string;
}) => {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  // Property lists are rebuilt each render (labels are translated), so key the parse on their ids.
  const propertyKey = properties
    .map((property) => `${property.id}:${property.options?.length ?? ""}`)
    .join("|");

  const sortKey = sortOptions.join("|");

  const state = useMemo<TTableUrlState>(() => {
    const params = new URLSearchParams(queryString);
    const requestedSort = params.get(SORT_PARAM);
    return {
      filters: parseTableFilters(params, properties),
      search: params.get(SEARCH_PARAM) ?? "",
      sortBy: requestedSort && sortOptions.includes(requestedSort) ? requestedSort : defaultSortBy,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `propertyKey` stands in for `properties`, rebuilt every render
  }, [queryString, propertyKey, sortKey, defaultSortBy]);

  // Writes start from the live URL, not the last render, so two writes in one tick both land.
  const propertiesRef = useRef(properties);
  useEffect(() => {
    propertiesRef.current = properties;
  });

  const write = useCallback(
    (next: Partial<TTableUrlState>) => {
      const current = new URLSearchParams(globalThis.window.location.search);
      const currentSort = current.get(SORT_PARAM);
      const merged = {
        filters: parseTableFilters(current, propertiesRef.current),
        search: current.get(SEARCH_PARAM) ?? "",
        // A sort the table does not offer (a hand-edited link) is not written back.
        sortBy: currentSort && sortKey.split("|").includes(currentSort) ? currentSort : defaultSortBy,
        ...next,
      };
      const params = buildTableSearchParams(current, {
        filters: merged.filters,
        search: merged.search,
        sortBy: merged.sortBy === defaultSortBy ? null : merged.sortBy,
      });
      const query = params.toString();
      // The live pathname, not `usePathname()`: that one drops `BASE_PATH`, and writing it back would
      // move a self-hosted instance served under a sub-path off its own prefix.
      const { pathname } = globalThis.window.location;
      globalThis.window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    },
    [defaultSortBy, sortKey]
  );

  const setFilters = useCallback((filters: TTableFilter[]) => write({ filters }), [write]);
  const setSearch = useCallback((search: string) => write({ search }), [write]);
  const setSortBy = useCallback((sortBy: string) => write({ sortBy }), [write]);
  const clearFilters = useCallback(() => write({ filters: [], search: "" }), [write]);

  return { ...state, setFilters, setSearch, setSortBy, clearFilters };
};
