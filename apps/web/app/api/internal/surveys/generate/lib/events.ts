import type { z } from "zod";
import type { DeepPartial } from "@formbricks/ai";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import type { ZGeneratedSurveyDraftForAI } from "@/app/api/v3/surveys/generate/schemas";
import type { TV3SurveyGenerateValidation } from "@/app/api/v3/surveys/generate/service";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";

/**
 * Snapshot of a draft mid-generation. Whole-object, not a delta, and **unvalidated** — the AI SDK
 * runs no schema check on partials, so a headline can be half-written and a range can hold a value
 * that is not yet a legal enum member. Display-only; the review step reads the `done` payload.
 */
export type TSurveyGenerationDraftSnapshot = DeepPartial<z.infer<typeof ZGeneratedSurveyDraftForAI>>;

/** Codes that can only be raised mid-stream. Everything else is a pre-stream problem+json. */
export const SURVEY_GENERATION_STREAM_ERROR_CODES = {
  QUOTA_EXCEEDED: "ai_quota_exceeded",
  OUTPUT_TOO_LONG: "ai_output_too_long",
  PAYLOAD_INVALID: "ai_generated_payload_invalid",
  GENERATION_FAILED: "ai_generation_failed",
} as const;

export type TSurveyGenerationStreamErrorCode =
  (typeof SURVEY_GENERATION_STREAM_ERROR_CODES)[keyof typeof SURVEY_GENERATION_STREAM_ERROR_CODES];

export type TSurveyGenerationStreamEvent =
  /**
   * Emitted before the model is reached. Next only flushes response headers on the first chunk, so
   * without this the client's `fetch()` would not resolve until the first token — and a stream that
   * silently buffers would be indistinguishable from a slow model.
   */
  | { type: "start"; requestId: string }
  | { type: "partial"; seq: number; draft: TSurveyGenerationDraftSnapshot }
  /** Mirrors the public endpoint's result shape, so the client reuses its existing create path. */
  | {
      type: "done";
      language: string;
      payload: TV3CreateSurveyBody;
      validation: TV3SurveyGenerateValidation;
    }
  | {
      type: "error";
      code: TSurveyGenerationStreamErrorCode;
      detail: string;
      invalid_params?: InvalidParam[];
      retryAfter?: number;
    };

export const SURVEY_GENERATION_STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

/** Minimum gap between partial snapshots. ~10fps reads as live without the per-token flood. */
export const SURVEY_GENERATION_SNAPSHOT_THROTTLE_MS = 100;

const encoder = new TextEncoder();

/**
 * NDJSON framing: one JSON object, one trailing newline, nothing else. Framing is safe for any
 * model output because `JSON.stringify` escapes newlines inside strings — the single assumption
 * this protocol rests on, and the one `events.test.ts` asserts directly.
 */
export function encodeStreamEvent(event: TSurveyGenerationStreamEvent): Uint8Array {
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

  return now - lastEmittedAt >= SURVEY_GENERATION_SNAPSHOT_THROTTLE_MS;
}
