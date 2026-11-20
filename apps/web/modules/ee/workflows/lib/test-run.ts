import {
  type TCreateWorkflowTestRunInput,
  type TWorkflowStatus,
  type TWorkflowTriggerType,
  WORKFLOW_TRIGGERS,
  parseWebhookPayload,
} from "@formbricks/workflows";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  type TTestPayloadSource,
  resolveTestPayload,
} from "@/modules/ee/workflows/lib/webhook-trigger-panel";

/**
 * A Test run from the editor header (ED6, ADR 0049): which payload it sends, what stops it before it
 * starts, and how a refusal is explained. Pure so the hook and the drawer only wire it up. The test
 * payload itself is kept by the Webhook trigger panel (`readStoredTestPayload` in
 * `webhook-trigger-panel.ts`).
 */

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

/**
 * The test payload as the Test run drawer's Webhook step edits it: the same text the Webhook trigger
 * panel shows (the edit kept in this browser, else the last received payload), whether Run again can
 * send it (the rule `buildTestRunInput` applies), and whether there is a received payload to reset to.
 */
export const getTestRunDrawerPayload = ({
  stored,
  sample,
}: {
  stored: string | null;
  sample: Record<string, unknown> | null;
}): { text: string; source: TTestPayloadSource; canRunAgain: boolean; canReset: boolean } => {
  const { text, source } = resolveTestPayload({ stored, sample });
  return {
    text,
    source,
    canRunAgain: buildTestRunInput(stored).ok,
    canReset: source === "edited" && sample !== null,
  };
};

export type TTestRunBlocker = "no_trigger" | "archived";

/**
 * What stops a Test run before it is sent: the server refuses both, so the editor says so at once.
 * Every trigger type can be test-run (a Webhook with a payload, a Response completed with a response).
 */
export const getTestRunBlocker = ({
  triggerType,
  status,
}: {
  triggerType: TWorkflowTriggerType | null;
  status: TWorkflowStatus;
}): TTestRunBlocker | null => {
  if (status === "archived") return "archived";
  if (triggerType !== WORKFLOW_TRIGGERS.WEBHOOK && triggerType !== WORKFLOW_TRIGGERS.RESPONSE_COMPLETED) {
    return "no_trigger";
  }
  return null;
};

export type TTestRunFailure =
  | TTestRunBlocker
  | "no_payload"
  | "not_executable"
  | "payload_too_large"
  | "invalid_payload"
  | "response_unavailable"
  | "other";

/**
 * Why the server refused a Test run. The trigger type and archived state are checked before
 * sending (`getTestRunBlocker`), so a refused state on a request without a payload can only mean
 * there was no Sample payload to fall back to. Write access is checked before the editor offers a
 * Test run, so a 403 for a picked response means it is gone or no longer the trigger survey's.
 */
export const classifyTestRunError = (
  error: unknown,
  { sentPayload, sentResponseId = false }: { sentPayload: boolean; sentResponseId?: boolean }
): TTestRunFailure => {
  if (!(error instanceof V3ApiError)) return "other";
  if (error.status === 403 && sentResponseId) return "response_unavailable";
  if (error.status === 422 && error.code === "workflow_not_executable") return "not_executable";
  if (error.status === 422 && error.code === "invalid_workflow_state" && !sentPayload && !sentResponseId) {
    return "no_payload";
  }
  if (error.status === 413) return "payload_too_large";
  if (error.status === 400 && sentPayload) return "invalid_payload";
  return "other";
};
