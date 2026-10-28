import { isRecord } from "../../shared/guards";
import { type ToolContentBlock, type ToolResult, getResultText } from "../../shared/tool-result";
import { type RunDetail, type RunSummary, type WorkflowInfo, readRunDetail, readRunsPage } from "./model";

/** How many runs the view lists, on open and on refresh. The server's first page uses the same bound. */
export const RECENT_RUNS_LIMIT = 10;

export type Loaded<T> = { ok: true; value: T } | { ok: false; error: string };

/** The message to show when the host rejected a call or the connection dropped. */
export const describeCallError = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : "The request could not be completed.";

/**
 * Why a tool call failed, or `undefined` when it did not. A failed Formbricks tool answers
 * `{ error: { detail, ... } }` in `structuredContent` with `isError` set; `detail` is the sentence meant
 * for people. (`getToolError` in the shared module reads a top-level `detail`, which these results lack.)
 */
export const describeToolFailure = (result: ToolResult): string | undefined => {
  if (!result.isError) return undefined;
  const error = result.structuredContent?.error;
  if (isRecord(error) && typeof error.detail === "string" && error.detail) return error.detail;
  return getResultText(result) ?? "The request failed.";
};

/** `list_workflow_runs` answers the same page the first load did, so a refresh can swap it in whole. */
export const interpretRunList = (result: ToolResult): Loaded<RunSummary[]> => {
  const failure = describeToolFailure(result);
  if (failure) return { ok: false, error: failure };
  const runs = readRunsPage(result.structuredContent);
  return runs ? { ok: true, value: runs } : { ok: false, error: "The runs could not be read." };
};

export const interpretRunDetail = (result: ToolResult): Loaded<RunDetail> => {
  const failure = describeToolFailure(result);
  if (failure) return { ok: false, error: failure };
  const detail = readRunDetail(result.structuredContent);
  return detail ? { ok: true, value: detail } : { ok: false, error: "The run could not be read." };
};

export const buildRunListArguments = (workflow: Pick<WorkflowInfo, "id" | "workspaceId">) => ({
  workspaceId: workflow.workspaceId,
  workflowId: workflow.id,
  limit: RECENT_RUNS_LIMIT,
});

export const buildRunDetailArguments = (runId: string) => ({ runId });

/** A cuid2, what workflow ids are. A value of any other shape is never put into a chat message. */
const ID_SHAPE = /^[a-z0-9]{20,32}$/;

/**
 * The chat message behind "Ask the agent to run a test": the agent owns the test, the view only asks.
 * A fixed template over the workflow's id and nothing else. The name and description are text a teammate
 * typed, and they must not travel into the conversation as if the person had written them; an id that is
 * not shaped like one yields no message at all rather than a vague one.
 */
export const buildTestRequestMessage = (workflow: Pick<WorkflowInfo, "id">): string | undefined =>
  ID_SHAPE.test(workflow.id)
    ? `Run a test of the workflow with id ${workflow.id} and tell me whether it would run as intended.`
    : undefined;

/**
 * What `app.callServerTool` resolves to. The SDK types `structuredContent` as `unknown`, so it is narrowed
 * with a guard before the readers see it.
 */
export interface RawToolResult {
  content?: ToolContentBlock[];
  structuredContent?: unknown;
  isError?: boolean;
}

const toToolResult = (raw: RawToolResult): ToolResult => ({
  content: raw.content,
  isError: raw.isError,
  ...(isRecord(raw.structuredContent) ? { structuredContent: raw.structuredContent } : {}),
});

/** A tool call the view makes through its host (`app.callServerTool`), injected so the flows below run without one. */
export type CallTool = (params: {
  name: string;
  arguments: Record<string, unknown>;
}) => Promise<RawToolResult>;

/** `app.sendMessage`, injected for the same reason. */
export type SendMessage = (params: {
  role: "user";
  content: { type: "text"; text: string }[];
}) => Promise<{ isError?: boolean }>;

/** One run in full through `get_workflow_run`. A refused or thrown call is an error value, never an exception. */
export const loadRunDetail = async (callTool: CallTool, runId: string): Promise<Loaded<RunDetail>> => {
  try {
    return interpretRunDetail(
      toToolResult(await callTool({ name: "get_workflow_run", arguments: buildRunDetailArguments(runId) }))
    );
  } catch (error) {
    return { ok: false, error: describeCallError(error) };
  }
};

export type RunsRefresh =
  | {
      ok: true;
      runs: RunSummary[];
      /** The open run to load again, or `null` when it is gone from the new page and its panel should close. */
      reloadRunId: string | null;
    }
  | { ok: false; error: string };

/** The newest runs through `list_workflow_runs`, and what to do with the run panel that was open. */
export const refreshRuns = async (
  callTool: CallTool,
  workflow: Pick<WorkflowInfo, "id" | "workspaceId">,
  openRunId: string | null
): Promise<RunsRefresh> => {
  try {
    const loaded = interpretRunList(
      toToolResult(await callTool({ name: "list_workflow_runs", arguments: buildRunListArguments(workflow) }))
    );
    if (!loaded.ok) return loaded;
    const stillListed = openRunId !== null && loaded.value.some((run) => run.id === openRunId);
    return { ok: true, runs: loaded.value, reloadRunId: stillListed ? openRunId : null };
  } catch (error) {
    return { ok: false, error: describeCallError(error) };
  }
};

/** Asks the agent, in the chat, to test the workflow. `failed` covers a refusing or throwing host and a workflow id that cannot be named safely. */
export const requestTestRun = async (
  sendMessage: SendMessage,
  workflow: Pick<WorkflowInfo, "id">
): Promise<"sent" | "failed"> => {
  const text = buildTestRequestMessage(workflow);
  if (text === undefined) return "failed";
  try {
    const response = await sendMessage({ role: "user", content: [{ type: "text", text }] });
    return response.isError ? "failed" : "sent";
  } catch {
    return "failed";
  }
};
