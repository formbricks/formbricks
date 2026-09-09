import { AIOutputTokenLimitError } from "@formbricks/ai";
import { TooManyRequestsError } from "@formbricks/types/errors";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { V3SurveyGeneratedPayloadValidationError } from "@/app/api/v3/surveys/generate/service";

/**
 * NDJSON plumbing shared by the survey generation and survey import streams. Both routes emit the
 * same `partial`/`done`/`error` grammar; the event unions live next to each route, the framing,
 * throttle and error mapping live here so the two cannot drift.
 */

export const SURVEY_STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

/** Minimum gap between partial snapshots. ~10fps reads as live without the per-token flood. */
export const SURVEY_STREAM_SNAPSHOT_THROTTLE_MS = 100;

/**
 * no-transform is the RFC 9111 signal that forbids an intermediary coalescing or re-encoding the
 * body; X-Accel-Buffering is for self-hosters fronting Formbricks with nginx-ingress, where
 * proxy_buffering is on by default and would hold the whole response.
 */
export const SURVEY_STREAM_RESPONSE_HEADERS = {
  "Content-Type": SURVEY_STREAM_CONTENT_TYPE,
  "Cache-Control": "no-cache, no-store, no-transform",
  "X-Accel-Buffering": "no",
} as const;

/** Codes that can only be raised mid-stream. Everything else is a pre-stream problem+json. */
export const SURVEY_STREAM_ERROR_CODES = {
  QUOTA_EXCEEDED: "ai_quota_exceeded",
  OUTPUT_TOO_LONG: "ai_output_too_long",
  PAYLOAD_INVALID: "ai_generated_payload_invalid",
  GENERATION_FAILED: "ai_generation_failed",
} as const;

export type TSurveyStreamErrorCode =
  (typeof SURVEY_STREAM_ERROR_CODES)[keyof typeof SURVEY_STREAM_ERROR_CODES];

export type TSurveyStreamErrorEvent = {
  type: "error";
  code: TSurveyStreamErrorCode;
  detail: string;
  invalid_params?: InvalidParam[];
  retryAfter?: number;
  /** A support handle the UI prints under the message (the import run id); the server log carries the same value. */
  reference?: string;
};

const encoder = new TextEncoder();

/**
 * NDJSON framing: one JSON object, one trailing newline, nothing else. Framing is safe for any
 * model output because `JSON.stringify` escapes newlines inside strings — the single assumption
 * this protocol rests on, and the one `events.test.ts` asserts directly.
 */
export function encodeStreamEvent<TEvent extends { type: string }>(event: TEvent): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

/**
 * Whether a partial snapshot is worth putting on the wire.
 *
 * `partialOutputStream` emits a whole-object snapshot per token, so relaying every one is O(n²) on
 * the wire — roughly 8MB for a 4KB draft. Throttling by time keeps it live-looking; dropping
 * byte-identical repeats absorbs the tail of a model stall for free.
 *
 * Pure so the policy is testable without a stream.
 */
export function shouldEmitSnapshot({
  now,
  lastEmittedAt,
  serialized,
  lastSerialized,
}: {
  now: number;
  lastEmittedAt: number | null;
  serialized: string;
  lastSerialized: string | null;
}): boolean {
  if (serialized === lastSerialized) return false;
  if (lastEmittedAt === null) return true;

  return now - lastEmittedAt >= SURVEY_STREAM_SNAPSHOT_THROTTLE_MS;
}

/**
 * Fixed detail strings, one per code.
 *
 * Never interpolate the caught error's message: an in-band error event is rendered to the user, and
 * provider errors routinely echo fragments of the prompt back in their message.
 */
const STREAM_ERROR_DETAILS = {
  [SURVEY_STREAM_ERROR_CODES.QUOTA_EXCEEDED]:
    "The AI provider is temporarily rate-limited. Try again shortly.",
  [SURVEY_STREAM_ERROR_CODES.OUTPUT_TOO_LONG]:
    "The generated survey exceeded the AI output token limit. Simplify the prompt or split it into smaller surveys.",
  [SURVEY_STREAM_ERROR_CODES.PAYLOAD_INVALID]: "The generated survey draft could not be validated.",
  [SURVEY_STREAM_ERROR_CODES.GENERATION_FAILED]:
    "The AI provider could not finish the survey draft. Try again or add more detail.",
} as const;

/**
 * Whether a failure is the client hanging up rather than a generation problem.
 *
 * Checked *before* classification, and the signal of record is the request signal rather than the
 * error: on abort the AI SDK rejects with a DOMException whose shape varies by runtime, while
 * `signal.aborted` is unambiguous. Getting this order wrong logs every user pressing Stop as a
 * generation failure.
 */
export function isClientAbort(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;

  return error instanceof Error && error.name === "AbortError";
}

/**
 * Map a mid-generation failure to the in-band event the client renders.
 *
 * Only failures that can happen *after* the response body has opened belong here — entitlement,
 * auth, rate limiting and body validation are all guarded before the first byte and answer with a
 * proper RFC 9457 problem response instead.
 */
export function toStreamErrorEvent(error: unknown): TSurveyStreamErrorEvent {
  if (error instanceof TooManyRequestsError) {
    return {
      type: "error",
      code: SURVEY_STREAM_ERROR_CODES.QUOTA_EXCEEDED,
      detail: STREAM_ERROR_DETAILS[SURVEY_STREAM_ERROR_CODES.QUOTA_EXCEEDED],
      retryAfter: error.retryAfter,
    };
  }

  if (error instanceof AIOutputTokenLimitError) {
    return {
      type: "error",
      code: SURVEY_STREAM_ERROR_CODES.OUTPUT_TOO_LONG,
      detail: STREAM_ERROR_DETAILS[SURVEY_STREAM_ERROR_CODES.OUTPUT_TOO_LONG],
    };
  }

  if (error instanceof V3SurveyGeneratedPayloadValidationError) {
    return {
      type: "error",
      code: SURVEY_STREAM_ERROR_CODES.PAYLOAD_INVALID,
      detail: STREAM_ERROR_DETAILS[SURVEY_STREAM_ERROR_CODES.PAYLOAD_INVALID],
      invalid_params: error.invalidParams,
    };
  }

  return {
    type: "error",
    code: SURVEY_STREAM_ERROR_CODES.GENERATION_FAILED,
    detail: STREAM_ERROR_DETAILS[SURVEY_STREAM_ERROR_CODES.GENERATION_FAILED],
  };
}

/**
 * Wires the client's disconnect into an abort the provider call honours, and returns the controller
 * plus a detach function. An abort that already happened is never replayed to a listener added
 * afterwards, so a client that disconnected during the guards would otherwise get a full run billed.
 */
export function chainRequestAbort(req: Request): { controller: AbortController; detach: () => void } {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (req.signal.aborted) abort();
  else req.signal.addEventListener("abort", abort, { once: true });
  return { controller, detach: () => req.signal.removeEventListener("abort", abort) };
}
