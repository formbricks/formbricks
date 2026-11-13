import {
  type TCreateWorkflowTestRunInput,
  type TWorkflowStatus,
  type TWorkflowTriggerType,
  WORKFLOW_TRIGGERS,
  parseWebhookPayload,
} from "@formbricks/workflows";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import type { TWorkflowRunListFilters } from "@/modules/ee/workflows/lib/api-client";

/**
 * A Test run from the editor header (ED6, ADR 0049): which payload it sends, what stops it before it
 * starts, and how a refusal is explained. Pure so the hook and the drawer only wire it up.
 */

// ---------------------------------------------------------------------------------------------------
// The test payload the Webhook trigger panel keeps in this browser, per workflow.
// TODO(ENG-7182 merge): the trigger panel (part A) owns this key and reader in
// `lib/webhook-trigger-panel.ts`; import them from there once both parts are merged.
// ---------------------------------------------------------------------------------------------------

type TStorageReader = Pick<Storage, "getItem">;

export const getTestPayloadStorageKey = (workflowId: string): string =>
  `formbricks-workflow-test-payload:${workflowId}`;

const getBrowserStorage = (): TStorageReader | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

/** The edited test payload for this workflow, or null when there is none (or no storage). */
export const readStoredTestPayload = (
  workflowId: string,
  storage: TStorageReader | null = getBrowserStorage()
): string | null => {
  try {
    return storage?.getItem(getTestPayloadStorageKey(workflowId)) ?? null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------------------------------

export type TTestRunInputResult =
  | { ok: true; input: TCreateWorkflowTestRunInput }
  | { ok: false; reason: "invalid_payload" };

/**
 * The request body: the payload kept in this browser, else none, and the server falls back to the
 * workflow's Sample payload. A kept payload that isn't a JSON object stops the run here rather than
 * silently testing with the Sample payload instead.
 */
export const buildTestRunInput = (storedText: string | null): TTestRunInputResult => {
  if (storedText === null || storedText.trim() === "") return { ok: true, input: {} };
  const parsed = parseWebhookPayload(storedText);
  if (!parsed.ok) return { ok: false, reason: "invalid_payload" };
  return { ok: true, input: { payload: parsed.payload } };
};

export type TTestRunBlocker = "not_webhook" | "archived";

/** What stops a Test run before it is sent: the server refuses both, so the editor says so at once. */
export const getTestRunBlocker = ({
  triggerType,
  status,
}: {
  triggerType: TWorkflowTriggerType | null;
  status: TWorkflowStatus;
}): TTestRunBlocker | null => {
  if (status === "archived") return "archived";
  if (triggerType !== WORKFLOW_TRIGGERS.WEBHOOK) return "not_webhook";
  return null;
};

export type TTestRunFailure =
  | TTestRunBlocker
  | "no_payload"
  | "not_executable"
  | "payload_too_large"
  | "invalid_payload"
  | "other";

/**
 * Why the server refused a Test run. The trigger type and archived state are checked before
 * sending (`getTestRunBlocker`), so a refused state on a request without a payload can only mean
 * there was no Sample payload to fall back to.
 */
export const classifyTestRunError = (
  error: unknown,
  { sentPayload }: { sentPayload: boolean }
): TTestRunFailure => {
  if (!(error instanceof V3ApiError)) return "other";
  if (error.status === 422 && error.code === "workflow_not_executable") return "not_executable";
  if (error.status === 422 && error.code === "invalid_workflow_state" && !sentPayload) return "no_payload";
  if (error.status === 413) return "payload_too_large";
  if (error.status === 400 && sentPayload) return "invalid_payload";
  return "other";
};

/**
 * The runs list's "Hide test runs" switch (on by default): real runs only, through the list's
 * `filter[isDryRun][eq]=false`, or every run.
 */
export const withTestRunsHidden = (
  filters: TWorkflowRunListFilters | undefined,
  hideTestRuns: boolean
): TWorkflowRunListFilters => {
  const { isDryRun: _isDryRun, ...rest } = filters ?? {};
  return hideTestRuns ? { ...rest, isDryRun: false } : rest;
};
