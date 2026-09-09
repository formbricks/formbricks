import type { z } from "zod";
import type { DeepPartial } from "@formbricks/ai";
import type { ZGeneratedSurveyDraftForAI } from "@/app/api/v3/surveys/generate/schemas";
import type { TV3SurveyGenerateValidation } from "@/app/api/v3/surveys/generate/service";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import {
  SURVEY_STREAM_CONTENT_TYPE,
  SURVEY_STREAM_ERROR_CODES,
  SURVEY_STREAM_SNAPSHOT_THROTTLE_MS,
  type TSurveyStreamErrorEvent,
} from "../../lib/stream-events";

// Framing, throttle and error mapping are shared with the import stream (../../lib/stream-events).
export { encodeStreamEvent, shouldEmitSnapshot } from "../../lib/stream-events";

/**
 * Snapshot of a draft mid-generation. Whole-object, not a delta, and **unvalidated** — the AI SDK
 * runs no schema check on partials, so a headline can be half-written and a range can hold a value
 * that is not yet a legal enum member. Display-only; the review step reads the `done` payload.
 */
export type TSurveyGenerationDraftSnapshot = DeepPartial<z.infer<typeof ZGeneratedSurveyDraftForAI>>;

/** Codes that can only be raised mid-stream. Everything else is a pre-stream problem+json. */
export const SURVEY_GENERATION_STREAM_ERROR_CODES = SURVEY_STREAM_ERROR_CODES;

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
  | TSurveyStreamErrorEvent;

export const SURVEY_GENERATION_STREAM_CONTENT_TYPE = SURVEY_STREAM_CONTENT_TYPE;
export const SURVEY_GENERATION_SNAPSHOT_THROTTLE_MS = SURVEY_STREAM_SNAPSHOT_THROTTLE_MS;
