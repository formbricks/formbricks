import { AI_STREAM_FAILURE_CODES } from "@/app/api/internal/lib/ai-stream-errors";
import type { TV3CreateSurveyRequestBody } from "@/app/api/v3/surveys/schemas";
import type { TQsfImportReport, TQsfImportStage } from "@/modules/survey/import/types";

/** Codes that can only be raised after the stream opened. Everything else is a pre-stream problem+json. */
export const QSF_IMPORT_STREAM_ERROR_CODES = {
  ...AI_STREAM_FAILURE_CODES,
  TIMED_OUT: "import_timed_out",
  FAILED: "import_failed",
} as const;

export type TQsfImportStreamErrorCode =
  (typeof QSF_IMPORT_STREAM_ERROR_CODES)[keyof typeof QSF_IMPORT_STREAM_ERROR_CODES];

/** The NDJSON events of `POST /api/internal/surveys/import/stream`, in order: start, progress…, done or error. */
export type TQsfImportStreamEvent =
  /**
   * Written before any work starts. Next only flushes response headers on the first chunk, so without
   * it the client's `fetch()` would not resolve until the import had produced something.
   */
  | { type: "start"; requestId: string }
  /** A new stage, or the current one repeated as a heartbeat while a stage runs long. */
  | { type: "progress"; stage: TQsfImportStage }
  /** The draft to review and create with `POST /api/v3/surveys?createdFrom=import`, and its report. */
  | { type: "done"; payload: TV3CreateSurveyRequestBody; report: TQsfImportReport }
  | { type: "error"; code: TQsfImportStreamErrorCode; detail: string; retryAfter?: number };
