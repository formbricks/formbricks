import { type ToolResult, getResultText } from "../../shared/tool-result";
import {
  type RunDetail,
  type RunSummary,
  type WorkflowInfo,
  isRecord,
  readRunDetail,
  readRunsPage,
} from "./model";

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

/**
 * The chat message behind "Ask the agent to run a test": the agent owns the test, the view only asks.
 * It names the workflow by id and not by name: the name is text a teammate typed, and it must not travel
 * into the conversation as if the person had written it.
 */
export const buildTestRequestMessage = (workflow: Pick<WorkflowInfo, "id">): string =>
  `Run a test of the workflow with id ${workflow.id} and tell me whether it would run as intended.`;
