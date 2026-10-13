import { classifyAIStreamFailure } from "@/app/api/internal/lib/ai-stream-errors";
import { QSF_IMPORT_STREAM_ERROR_CODES, type TQsfImportStreamEvent } from "./events";

/**
 * Fixed detail strings, one per code. Never interpolate the caught error's message: provider errors
 * can echo the prompt, and the prompt carries the file's questions.
 */
const STREAM_ERROR_DETAILS = {
  [QSF_IMPORT_STREAM_ERROR_CODES.QUOTA_EXCEEDED]:
    "The AI provider is temporarily rate-limited. Try again shortly.",
  [QSF_IMPORT_STREAM_ERROR_CODES.AUTH_FAILED]:
    "The AI provider rejected this instance's credentials. Ask your administrator to check the AI provider configuration.",
  [QSF_IMPORT_STREAM_ERROR_CODES.OUTPUT_TOO_LONG]:
    "The survey is too long to import in one go. Split it in Qualtrics and import each part.",
  [QSF_IMPORT_STREAM_ERROR_CODES.TIMED_OUT]: "The import took too long and was stopped. Try again.",
  [QSF_IMPORT_STREAM_ERROR_CODES.FAILED]: "The file could not be imported. Try again.",
} as const;

type TQsfImportErrorEvent = Extract<TQsfImportStreamEvent, { type: "error" }>;

/** The in-band event for an import that hit its deadline. */
export function importTimedOutEvent(): TQsfImportErrorEvent {
  return {
    type: "error",
    code: QSF_IMPORT_STREAM_ERROR_CODES.TIMED_OUT,
    detail: STREAM_ERROR_DETAILS[QSF_IMPORT_STREAM_ERROR_CODES.TIMED_OUT],
  };
}

/**
 * Map a failure after the stream opened to the event the dialog renders. Failures before it — access,
 * the AI gate, a file that is not a QSF — are problem responses, not events.
 */
export function toQsfImportStreamErrorEvent(error: unknown): TQsfImportErrorEvent {
  const aiFailure = classifyAIStreamFailure(error);
  if (aiFailure) {
    return { type: "error", ...aiFailure, detail: STREAM_ERROR_DETAILS[aiFailure.code] };
  }

  return {
    type: "error",
    code: QSF_IMPORT_STREAM_ERROR_CODES.FAILED,
    detail: STREAM_ERROR_DETAILS[QSF_IMPORT_STREAM_ERROR_CODES.FAILED],
  };
}
