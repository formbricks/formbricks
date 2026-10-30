import { AI_STREAM_FAILURE_CODES } from "@/app/api/internal/lib/ai-stream-errors";
import type { TFormbricksFileReferences } from "@/modules/survey/formbricks-file/envelope";
import type { TSurveyImportPayload } from "@/modules/survey/import/core/draft";
import type {
  TSurveyImportMatch,
  TSurveyImportReport,
  TSurveyImportStage,
} from "@/modules/survey/import/types";

/** Codes that can only be raised after the stream opened. Everything else is a pre-stream problem+json. */
export const SURVEY_IMPORT_STREAM_ERROR_CODES = {
  ...AI_STREAM_FAILURE_CODES,
  TIMED_OUT: "import_timed_out",
  FAILED: "import_failed",
} as const;

export type TSurveyImportStreamErrorCode =
  (typeof SURVEY_IMPORT_STREAM_ERROR_CODES)[keyof typeof SURVEY_IMPORT_STREAM_ERROR_CODES];

/**
 * The NDJSON events of `POST /api/internal/surveys/import/stream`, in order: start, progress…, done or
 * error.
 */
export type TSurveyImportStreamEvent =
  /**
   * Written before any work starts. Next only flushes response headers on the first chunk, so without
   * it the client's `fetch()` would not resolve until the import had produced something.
   */
  | { type: "start"; requestId: string }
  /** A new stage, or the current one repeated as a heartbeat while a stage runs long. */
  | { type: "progress"; stage: TSurveyImportStage }
  /**
   * The draft to review, as the create request body takes it — locale-keyed, before parsing — and its
   * report. Without `references` the dialog creates it with `POST /api/v3/surveys?createdFrom=import`;
   * with them (a Formbricks file) it sends both to `POST /api/internal/surveys/imports`, which resolves
   * the references again and creates them with the survey.
   */
  | {
      type: "done";
      payload: TSurveyImportPayload;
      report: TSurveyImportReport;
      references?: TFormbricksFileReferences;
      /**
       * The survey the file was exported from, in this workspace and editable by the user (ENG-6851):
       * the dialog offers Update or Create new. Absent when there is none.
       */
      match?: TSurveyImportMatch;
    }
  | { type: "error"; code: TSurveyImportStreamErrorCode; detail: string; retryAfter?: number };
