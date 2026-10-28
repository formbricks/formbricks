import type { App } from "@modelcontextprotocol/ext-apps";
import { useCallback, useReducer, useRef, useState } from "react";
import {
  type Filters,
  buildListArguments,
  defaultFilters,
  filtersFromQuery,
  validateFilters,
} from "./filters";
import { parseListPage } from "./parse";
import { type ListState, createListState, listReducer } from "./state";
import type { ListPage, Parsed, ShowResponsesData } from "./types";

const LIST_TOOL = "list_responses";

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
 * The table's data (mount it with a `key` that changes with the tool result): the first page the tool returned, then every follow-up page and filter change
 * through the existing `list_responses` tool (the host forwards the call; the view never talks to the
 * server itself). A counter drops answers that arrive after a newer request was started, so a slow
 * response for old filters cannot overwrite the list for new ones.
 */
export const useResponsesList = (
  app: App | null,
  initial: ShowResponsesData,
  timeZone: string
): ResponsesList => {
  const [state, dispatch] = useReducer(listReducer, initial, createListState);
  const [filters, setFilters] = useState<Filters>(() => filtersFromQuery(initial.query, timeZone));
  const latest = useRef(0);

  const fetchPage = useCallback(
    async (nextFilters: Filters, cursor?: string): Promise<Parsed<ListPage> | undefined> => {
      if (!app) return undefined;
      latest.current += 1;
      const ticket = latest.current;
      let page: Parsed<ListPage>;
      try {
        const result = await app.callServerTool({
          name: LIST_TOOL,
          arguments: buildListArguments(initial.query, nextFilters, timeZone, cursor),
        });
        page = parseListPage(result);
      } catch (error) {
        page = {
          ok: false,
          message: error instanceof Error && error.message ? error.message : "The request failed.",
        };
      }
      return ticket === latest.current ? page : undefined;
    },
    [app, initial.query, timeZone]
  );

  const refresh = useCallback(
    async (nextFilters: Filters) => {
      dispatch({ type: "refreshStart" });
      const page = await fetchPage(nextFilters);
      if (!page) return;
      dispatch(
        page.ok ? { type: "refreshDone", page: page.value } : { type: "refreshFailed", message: page.message }
      );
    },
    [fetchPage]
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
    if (!cursor || state.phase !== "idle") return;
    dispatch({ type: "moreStart" });
    const page = await fetchPage(filters, cursor);
    if (!page) return;
    dispatch(
      page.ok ? { type: "moreDone", page: page.value } : { type: "moreFailed", message: page.message }
    );
  }, [fetchPage, filters, state.nextCursor, state.phase]);

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
