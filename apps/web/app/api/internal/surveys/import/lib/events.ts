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
  /** A document whose plan holds more questions than one import takes: the dialog points at MCP. */
  TOO_LARGE: "import_too_large",
  /**
   * A document the AI could not read whole, which with the unread lines might pass the question ceiling:
   * the dialog says to try again rather than pointing at MCP.
   */
  PARTLY_UNREAD: "import_partly_unread",
  /** A file read whole with no question the import can bring over: trying again cannot help. */
  NOTHING_IMPORTABLE: "import_nothing_importable",
  /** No question came back and a call ran past its output tokens: the dialog points at MCP. */
  TOO_LARGE_FOR_AI: "import_too_large_for_ai",
  /** No question came back after calls failed on the way: try again, or import through MCP. */
  NO_QUESTIONS: "import_no_questions",
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
   * report. The dialog sends it back to `POST /api/internal/surveys/imports`, with the `references` a
   * Formbricks file has, which the create resolves again and creates with the survey.
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
