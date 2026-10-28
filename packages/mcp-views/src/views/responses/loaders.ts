import { type DetailModel, parseDetail } from "./detail";
import { type Filters, buildListArguments } from "./filters";
import { parseListPage } from "./parse";
import type { ListAction } from "./state";
import type { ListPage, ListQuery, Parsed, RawToolResult } from "./types";

/**
 * A tool call the view makes through its host (`app.callServerTool`). Injected so the flows below run
 * without one. What it returns comes back to the view alone: the host answers the iframe's `tools/call`,
 * it does not put the result in the model's context, and nothing here sends it there. That is why these
 * results may hold answers and contact data, which `show_responses`' own `structuredContent` may not.
 */
export type CallTool = (params: {
  name: string;
  arguments: Record<string, unknown>;
}) => Promise<RawToolResult>;

const LIST_TOOL = "list_responses";
const DETAIL_TOOL = "get_response";

const failureMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : "The request failed.";

/** One page through `list_responses`: the result as a table page, or the reason there is none. */
export const loadListPage = async (
  callTool: CallTool,
  query: ListQuery,
  filters: Filters,
  timeZone: string,
  cursor?: string
): Promise<Parsed<ListPage>> => {
  try {
    return parseListPage(
      await callTool({ name: LIST_TOOL, arguments: buildListArguments(query, filters, timeZone, cursor) })
    );
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
};

/** One response in full through `get_response`. */
export const loadResponseDetail = async (
  callTool: CallTool,
  responseId: string
): Promise<Parsed<DetailModel>> => {
  try {
    return parseDetail(await callTool({ name: DETAIL_TOOL, arguments: { responseId } }));
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
};

/**
 * Hands out a ticket per request and says whether a ticket is still the newest, so an answer that
 * arrives after a newer request started (a slow page for old filters) is dropped.
 */
export interface LatestGate {
  begin: () => number;
  isLatest: (ticket: number) => boolean;
}

export const createLatestGate = (): LatestGate => {
  let latest = 0;
  return {
    begin: () => {
      latest += 1;
      return latest;
    },
    isLatest: (ticket) => ticket === latest,
  };
};

/** What a settled page request means for the list, or `undefined` when a newer request superseded it. */
const settle = (
  gate: LatestGate,
  ticket: number,
  page: Parsed<ListPage>,
  kind: "refresh" | "more"
): ListAction | undefined => {
  if (!gate.isLatest(ticket)) return undefined;
  if (page.ok) return { type: kind === "refresh" ? "refreshDone" : "moreDone", page: page.value };
  return { type: kind === "refresh" ? "refreshFailed" : "moreFailed", message: page.message };
};

/** Re-query from the first page with new filters; the action to dispatch once it settles. */
export const refreshList = async (
  gate: LatestGate,
  callTool: CallTool,
  query: ListQuery,
  filters: Filters,
  timeZone: string
): Promise<ListAction | undefined> => {
  const ticket = gate.begin();
  return settle(gate, ticket, await loadListPage(callTool, query, filters, timeZone), "refresh");
};

/** The next page after `cursor` under the same filters; the action to dispatch once it settles. */
export const loadMoreList = async (
  gate: LatestGate,
  callTool: CallTool,
  query: ListQuery,
  filters: Filters,
  timeZone: string,
  cursor: string
): Promise<ListAction | undefined> => {
  const ticket = gate.begin();
  return settle(gate, ticket, await loadListPage(callTool, query, filters, timeZone, cursor), "more");
};
