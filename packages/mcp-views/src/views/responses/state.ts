import { mergeColumns, mergeRows } from "./cells";
import type { ListPage, ShowResponsesData, ViewColumn, ViewRow, ViewTotal } from "./types";

/** The list the table renders. `phase` says what is in flight; rows stay on screen while it is. */
export interface ListState {
  rows: ViewRow[];
  columns: ViewColumn[];
  nextCursor: string | null;
  total: ViewTotal | undefined;
  phase: "idle" | "refreshing" | "loadingMore";
  /** The last failed refresh or page load, shown inline next to a retry. */
  error: string | undefined;
}

export type ListAction =
  | { type: "refreshStart" }
  | { type: "refreshDone"; page: ListPage }
  | { type: "moreStart" }
  | { type: "moreDone"; page: ListPage }
  | { type: "moreFailed"; message: string }
  | { type: "refreshFailed"; message: string };

export const createListState = (data: ShowResponsesData): ListState => ({
  rows: data.rows,
  columns: data.columns,
  nextCursor: data.nextCursor,
  total: data.total,
  phase: "idle",
  error: undefined,
});

export const listReducer = (state: ListState, action: ListAction): ListState => {
  switch (action.type) {
    case "refreshStart":
      return { ...state, phase: "refreshing", error: undefined };
    case "refreshDone":
      return {
        rows: action.page.rows,
        // Columns only grow: a narrower filter must not make questions vanish from under the reader.
        columns: mergeColumns(state.columns, action.page.columns),
        nextCursor: action.page.nextCursor,
        total: action.page.total,
        phase: "idle",
        error: undefined,
      };
    case "moreStart":
      return { ...state, phase: "loadingMore", error: undefined };
    case "moreDone":
      return {
        rows: mergeRows(state.rows, action.page.rows),
        columns: mergeColumns(state.columns, action.page.columns),
        nextCursor: action.page.nextCursor,
        total: action.page.total ?? state.total,
        phase: "idle",
        error: undefined,
      };
    case "moreFailed":
      return { ...state, phase: "idle", error: action.message };
    case "refreshFailed":
      // The rows on screen belong to the previous filters; showing them next to an error would pass them
      // off as the answer to the new ones.
      return { ...state, rows: [], nextCursor: null, total: undefined, phase: "idle", error: action.message };
  }
};

/** "20 of 134 responses", with a plus when the total is a lower bound. Plain text; the view formats it. */
export const describeCount = (
  shown: number,
  total: ViewTotal | undefined,
  format: (n: number) => string
): string => {
  const noun = (count: number) => (count === 1 ? "response" : "responses");
  if (!total) return `${format(shown)} ${noun(shown)}`;
  const totalText = total.relation === "gte" ? `${format(total.count)}+` : format(total.count);
  return shown >= total.count && total.relation === "eq"
    ? `${format(total.count)} ${noun(total.count)}`
    : `${format(shown)} of ${totalText} ${noun(total.count)}`;
};

/**
 * Identity of a `show_responses` result, for the `key` that remounts the browser (and so resets its
 * filters, selection and pages) when the host delivers a different one.
 */
export const resultKey = (data: ShowResponsesData): string =>
  [
    data.survey.id,
    JSON.stringify(data.query),
    data.rows.length,
    data.rows[0]?.id ?? "",
    data.nextCursor ?? "",
  ].join("|");
