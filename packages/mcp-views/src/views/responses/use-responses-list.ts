import type { App } from "@modelcontextprotocol/ext-apps";
import { useCallback, useReducer, useState } from "react";
import { type Filters, defaultFilters, filtersFromQuery, validateFilters } from "./filters";
import { type CallTool, createLatestGate, loadMoreList, refreshList } from "./loaders";
import { type ListState, createListState, listReducer } from "./state";
import type { ShowResponsesData } from "./types";

export interface ResponsesList {
  state: ListState;
  filters: Filters;
  /** Why the filters cannot be applied (a reversed date range, say), if they cannot. */
  filterProblem: string | undefined;
  changeFilters: (next: Filters) => void;
  clearFilters: () => void;
  loadMore: () => void;
  retry: () => void;
}

/**
 * The table's data (mount it with a `key` that changes with the tool result): the first page the tool
 * returned, then every follow-up page and filter change through the existing `list_responses` tool (the host forwards the call; the view never talks to the
 * server itself). The call-and-interpret flow, including dropping answers that arrive after a newer
 * request started, lives in `loaders.ts`; this hook only wires it to React state.
 */
export const useResponsesList = (
  app: App | null,
  initial: ShowResponsesData,
  timeZone: string
): ResponsesList => {
  const [state, dispatch] = useReducer(listReducer, initial, createListState);
  const [filters, setFilters] = useState<Filters>(() => filtersFromQuery(initial.query, timeZone));
  const [gate] = useState(createLatestGate);

  const callTool = useCallback<CallTool>(
    (params) => app?.callServerTool(params) ?? Promise.reject(new Error("The host is not connected.")),
    [app]
  );

  const refresh = useCallback(
    async (nextFilters: Filters) => {
      if (!app) return;
      dispatch({ type: "refreshStart" });
      const action = await refreshList(gate, callTool, initial.query, nextFilters, timeZone);
      if (action) dispatch(action);
    },
    [app, callTool, gate, initial.query, timeZone]
  );

  const changeFilters = useCallback(
    (next: Filters) => {
      setFilters(next);
      if (validateFilters(next, timeZone) === undefined) void refresh(next);
    },
    [refresh, timeZone]
  );

  const clearFilters = useCallback(() => {
    const cleared = defaultFilters(filters.sortBy);
    setFilters(cleared);
    void refresh(cleared);
  }, [filters.sortBy, refresh]);

  const loadMore = useCallback(async () => {
    const cursor = state.nextCursor;
    if (!app || !cursor || state.phase !== "idle") return;
    dispatch({ type: "moreStart" });
    const action = await loadMoreList(gate, callTool, initial.query, filters, timeZone, cursor);
    if (action) dispatch(action);
  }, [app, callTool, filters, gate, initial.query, state.nextCursor, state.phase, timeZone]);

  const retry = useCallback(() => {
    if (state.rows.length === 0) void refresh(filters);
    else void loadMore();
  }, [filters, loadMore, refresh, state.rows.length]);

  return {
    state,
    filters,
    filterProblem: validateFilters(filters, timeZone),
    changeFilters,
    clearFilters,
    loadMore: () => void loadMore(),
    retry,
  };
};
