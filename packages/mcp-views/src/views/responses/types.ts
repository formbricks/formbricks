/** One question of the survey, as a table column. `position` is the question's order in the survey. */
export interface ViewColumn {
  id: string;
  label: string;
  type: string;
  position: number;
}

/**
 * One response, reduced to what the table shows. `cells` maps a question id to a short display string
 * (already flattened and capped, see `cells.ts`); a missing key means the respondent did not answer.
 */
export interface ViewRow {
  id: string;
  createdAt: string;
  finished: boolean;
  language: string | null;
  tags: string[];
  cells: Record<string, string>;
}

export interface ViewTotal {
  count: number;
  /** `gte` when the count hit its ceiling and is a lower bound. */
  relation: "eq" | "gte";
}

export type SortBy = "-createdAt" | "createdAt";

/** The effective `list_responses` arguments of the first page, minus paging. */
export interface ListQuery {
  workspaceId: string;
  surveyId: string;
  limit: number;
  sortBy: SortBy;
  contactId?: string;
  language?: string[];
  createdAtGte?: string;
  createdAtLte?: string;
  finished?: boolean;
}

/** `structuredContent` of `show_responses`. */
export interface ShowResponsesData {
  survey: { id: string; name: string };
  query: ListQuery;
  columns: ViewColumn[];
  rows: ViewRow[];
  nextCursor: string | null;
  total?: ViewTotal;
}

/** A page returned by `list_responses`, already reduced for the table. */
export interface ListPage {
  rows: ViewRow[];
  columns: ViewColumn[];
  nextCursor: string | null;
  total?: ViewTotal;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * The slice of a tool result this view reads. Looser than the shared `ToolResult` on purpose: the SDK
 * types `structuredContent` as `unknown`, and every reader here narrows it before use.
 */
export interface RawToolResult {
  content?: { type: string; text?: string }[];
  structuredContent?: unknown;
  isError?: boolean;
}
