import { classifyAIStreamFailure } from "@/app/api/internal/lib/ai-stream-errors";
import { SurveyImportFailedError } from "@/modules/survey/import/core/errors";
import { SURVEY_IMPORT_STREAM_ERROR_CODES, type TSurveyImportStreamEvent } from "./events";

/**
 * Fixed detail strings, one per code. Never interpolate the caught error's message: provider errors
 * can echo the prompt, and the prompt carries the file's questions.
 */
const STREAM_ERROR_DETAILS = {
  [SURVEY_IMPORT_STREAM_ERROR_CODES.QUOTA_EXCEEDED]:
    "The AI provider is temporarily rate-limited. Try again shortly.",
  [SURVEY_IMPORT_STREAM_ERROR_CODES.AUTH_FAILED]:
    "The AI provider rejected this instance's credentials. Ask your administrator to check the AI provider configuration.",
  [SURVEY_IMPORT_STREAM_ERROR_CODES.OUTPUT_TOO_LONG]:
    "The survey is too long to import in one go. Split it into parts and import each one.",
  [SURVEY_IMPORT_STREAM_ERROR_CODES.TIMED_OUT]: "The import took too long and was stopped. Try again.",
  [SURVEY_IMPORT_STREAM_ERROR_CODES.TOO_LARGE]:
    "The survey has more questions than one import takes. Import it through MCP with an AI assistant instead.",
  [SURVEY_IMPORT_STREAM_ERROR_CODES.FAILED]: "The file could not be imported. Try again.",
} as const;

type TSurveyImportErrorEvent = Extract<TSurveyImportStreamEvent, { type: "error" }>;

/** The in-band event for an import that hit its deadline. */
export function importTimedOutEvent(): TSurveyImportErrorEvent {
  return {
    type: "error",
    code: SURVEY_IMPORT_STREAM_ERROR_CODES.TIMED_OUT,
    detail: STREAM_ERROR_DETAILS[SURVEY_IMPORT_STREAM_ERROR_CODES.TIMED_OUT],
  };
}

/**
 * Map a failure after the stream opened to the event the dialog renders. Failures before it — access,
 * the AI gate, a file that is not a QSF — are problem responses, not events.
 */
export function toSurveyImportStreamErrorEvent(error: unknown): TSurveyImportErrorEvent {
  if (error instanceof SurveyImportFailedError && error.reason === "too_many_questions") {
    return {
      type: "error",
      code: SURVEY_IMPORT_STREAM_ERROR_CODES.TOO_LARGE,
      detail: STREAM_ERROR_DETAILS[SURVEY_IMPORT_STREAM_ERROR_CODES.TOO_LARGE],
    };
  }

  const aiFailure = classifyAIStreamFailure(error);
  if (aiFailure) {
    return { type: "error", ...aiFailure, detail: STREAM_ERROR_DETAILS[aiFailure.code] };
  }

  return {
    type: "error",
    code: SURVEY_IMPORT_STREAM_ERROR_CODES.FAILED,
    detail: STREAM_ERROR_DETAILS[SURVEY_IMPORT_STREAM_ERROR_CODES.FAILED],
  };
}
