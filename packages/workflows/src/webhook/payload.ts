import { hasNullByte } from "../contracts/postgres-text";
import type { TWorkflowWebhookPayload } from "../types/triggers/webhook";
import { WEBHOOK_PAYLOAD_MAX_BYTES, WEBHOOK_PAYLOAD_MAX_DEPTH } from "./limits";

/**
 * Why a payload was refused. The reasons are fixed strings so an error answer never echoes any part
 * of the payload back to the caller (ENG-7167).
 */
export type TWebhookPayloadRefusal = "invalid_json" | "not_object" | "too_deep" | "too_large" | "null_byte";

export type TWebhookPayloadCheck =
  | { ok: true; payload: TWorkflowWebhookPayload }
  | { ok: false; reason: TWebhookPayloadRefusal };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The deepest container nesting in a parsed JSON value, stopping as soon as it passes `limit`.
 * Iterative on purpose: `JSON.parse` accepts documents tens of thousands of levels deep, and a
 * recursive walk over one would overflow the stack.
 */
const exceedsDepth = (root: unknown, limit: number): boolean => {
  const stack: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 1 }];

  while (stack.length > 0) {
    const { value, depth } = stack.pop()!;
    if (depth > limit) return true;

    if (typeof value !== "object" || value === null) continue;
    const children: unknown[] = Array.isArray(value) ? value : Object.values(value);
    for (const child of children) {
      if (typeof child === "object" && child !== null) stack.push({ value: child, depth: depth + 1 });
    }
  }

  return false;
};

/**
 * Whether any key or string value holds U+0000, which a `jsonb` column refuses (the write would fail
 * with a 500). Iterative like `exceedsDepth`; run after it, so the walk is bounded.
 */
const containsNullByte = (root: unknown): boolean => {
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const value = stack.pop();
    if (typeof value === "string") {
      if (hasNullByte(value)) return true;
      continue;
    }
    if (typeof value !== "object" || value === null) continue;
    if (Array.isArray(value)) {
      stack.push(...(value as unknown[]));
      continue;
    }
    for (const [key, child] of Object.entries(value)) {
      if (hasNullByte(key)) return true;
      stack.push(child);
    }
  }
  return false;
};

/**
 * Size and shape rules for a value that is already a parsed object, such as a pasted Sample payload:
 * a JSON object of at most `WEBHOOK_PAYLOAD_MAX_BYTES` once serialized, nested at most
 * `WEBHOOK_PAYLOAD_MAX_DEPTH` levels.
 */
export const checkWebhookPayloadShape = (value: unknown): TWebhookPayloadCheck => {
  if (!isPlainObject(value)) return { ok: false, reason: "not_object" };
  if (exceedsDepth(value, WEBHOOK_PAYLOAD_MAX_DEPTH)) return { ok: false, reason: "too_deep" };
  if (containsNullByte(value)) return { ok: false, reason: "null_byte" };
  // TextEncoder rather than Buffer: the editor runs this same check in the browser.
  if (new TextEncoder().encode(JSON.stringify(value)).length > WEBHOOK_PAYLOAD_MAX_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  return { ok: true, payload: value };
};

/**
 * Parse the body of a Webhook Secret URL call. The caller has already bounded the body to
 * `WEBHOOK_PAYLOAD_MAX_BYTES` while reading it, so only JSON validity and shape are checked here.
 */
export const parseWebhookPayload = (text: string): TWebhookPayloadCheck => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  if (!isPlainObject(value)) return { ok: false, reason: "not_object" };
  if (exceedsDepth(value, WEBHOOK_PAYLOAD_MAX_DEPTH)) return { ok: false, reason: "too_deep" };
  if (containsNullByte(value)) return { ok: false, reason: "null_byte" };
  return { ok: true, payload: value };
};
