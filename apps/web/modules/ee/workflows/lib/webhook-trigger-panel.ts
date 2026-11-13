import {
  type TWebhookPayloadRefusal,
  type TWorkflowSampleVariables,
  checkWebhookPayloadShape,
  parseWebhookPayload,
} from "@formbricks/workflows";
import { getVariableDisplayName } from "@/modules/ee/workflows/lib/variable-name";

/** What the masked Webhook Secret URL shows in place of its token. */
export const WEBHOOK_TOKEN_MASK = "••••••••••••••••";

/**
 * The Webhook Secret URL with its token hidden: everything after `/webhook/` is the credential (ADR
 * 0041), so only that part is masked and the author still sees which workflow the URL belongs to.
 */
export const maskWebhookSecretUrl = (url: string): string => {
  const marker = "/webhook/";
  const index = url.lastIndexOf(marker);
  if (index < 0) return WEBHOOK_TOKEN_MASK;
  return `${url.slice(0, index + marker.length)}${WEBHOOK_TOKEN_MASK}`;
};

/** A pasted Sample payload, checked by the same rules the Secret URL applies to a call. */
export type TPastedSampleCheck =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; reason: TWebhookPayloadRefusal };

export const parsePastedSample = (text: string): TPastedSampleCheck => {
  const parsed = parseWebhookPayload(text);
  if (!parsed.ok) return parsed;
  return checkWebhookPayloadShape(parsed.payload);
};

/**
 * Whether the sample is the last call's payload (a call saves both at once) rather than one pasted
 * in later, so the panel can say "Received … from <IP>" or "Pasted …".
 */
export const isSampleFromLastCall = (sampleUpdatedAt: string, lastCalledAt: string | null): boolean =>
  lastCalledAt !== null && Math.abs(Date.parse(sampleUpdatedAt) - Date.parse(lastCalledAt)) < 5_000;

/** Pretty JSON as the editor shows a payload. */
export const formatPayload = (payload: Record<string, unknown>): string => JSON.stringify(payload, null, 2);

// ---------------------------------------------------------------------------------------------------
// Test payload, kept in this browser per workflow (ED6). Storage can be missing or throw (private
// windows, blocked site data), so every access is guarded and the panel works without it.
// ---------------------------------------------------------------------------------------------------

type TStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const getTestPayloadStorageKey = (workflowId: string): string =>
  `formbricks-workflow-test-payload:${workflowId}`;

const getBrowserStorage = (): TStorage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

/** The edited test payload for this workflow, or null when there is none (or no storage). */
export const readStoredTestPayload = (
  workflowId: string,
  storage: TStorage | null = getBrowserStorage()
): string | null => {
  try {
    return storage?.getItem(getTestPayloadStorageKey(workflowId)) ?? null;
  } catch {
    return null;
  }
};

/** Keeps the edited test payload; returns false when the browser would not store it. */
export const writeStoredTestPayload = (
  workflowId: string,
  text: string,
  storage: TStorage | null = getBrowserStorage()
): boolean => {
  try {
    if (!storage) return false;
    storage.setItem(getTestPayloadStorageKey(workflowId), text);
    return true;
  } catch {
    return false;
  }
};

export const clearStoredTestPayload = (
  workflowId: string,
  storage: TStorage | null = getBrowserStorage()
): void => {
  try {
    storage?.removeItem(getTestPayloadStorageKey(workflowId));
  } catch {
    // Nothing to clear when storage is unavailable.
  }
};

export type TTestPayloadSource = "edited" | "received" | "empty";

/**
 * What the test payload editor starts from: the author's edit kept in this browser, else the last
 * received (or pasted) sample, else nothing yet.
 */
export const resolveTestPayload = ({
  stored,
  sample,
}: {
  stored: string | null;
  sample: Record<string, unknown> | null;
}): { text: string; source: TTestPayloadSource } => {
  if (stored !== null) return { text: stored, source: "edited" };
  if (sample) return { text: formatPayload(sample), source: "received" };
  return { text: "", source: "empty" };
};

// ---------------------------------------------------------------------------------------------------
// Variable list
// ---------------------------------------------------------------------------------------------------

export type TVariableTypeLabel =
  | "text"
  | "number"
  | "true_false"
  | "object"
  | "empty"
  | "list"
  | "unsupported";

export interface TVariableListRow {
  path: string;
  /** How the editor names it: payload Variables without their `payload.` prefix. */
  name: string;
  typeLabel: TVariableTypeLabel;
  /** Lists (and keys a path cannot carry) are shown greyed as "not supported yet". */
  isSupported: boolean;
}

const TYPE_LABELS: Record<TWorkflowSampleVariables["variables"][number]["valueType"], TVariableTypeLabel> = {
  string: "text",
  number: "number",
  boolean: "true_false",
  object: "object",
  null: "empty",
};

/**
 * The rows of a Variable list: the usable Variables first, in document order, then the paths that
 * can't be used yet. Objects are left out of the usable rows: their fields are listed one by one, and
 * the list is about what a later step can insert.
 */
export const toVariableListRows = (variables: TWorkflowSampleVariables): TVariableListRow[] => [
  ...variables.variables
    .filter((variable) => variable.valueType !== "object")
    .map((variable) => ({
      path: variable.path,
      name: getVariableDisplayName(variable.path),
      typeLabel: TYPE_LABELS[variable.valueType],
      isSupported: true,
    })),
  ...variables.notSupported.map(
    (entry): TVariableListRow => ({
      path: entry.path,
      name: getVariableDisplayName(entry.path),
      typeLabel: entry.reason === "list" ? "list" : "unsupported",
      isSupported: false,
    })
  ),
];

/** How many Variables a sample offers, as the trigger card counts them. */
export const countUsableVariables = (variables: TWorkflowSampleVariables): number =>
  toVariableListRows(variables).filter((row) => row.isSupported).length;
