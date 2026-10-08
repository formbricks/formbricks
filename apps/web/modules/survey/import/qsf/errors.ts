import type { InvalidParam } from "@/app/api/v3/lib/response";
import type { TQsfImportLimit } from "../types";

/** One problem with a refused file, coded for the dialog (see `TQsfImportRefusalCode`). */
export type TQsfInputInvalidParam = InvalidParam &
  ({ code: "qsf_not_recognized" } | { code: "qsf_limit_exceeded"; identifier: TQsfImportLimit });

/**
 * The file is not a Qualtrics survey export the import can read, or it is past one of the reader's
 * limits. Answered as a 422 before the stream opens, so no AI is spent on it.
 *
 * Each invalid param names where (`qsf.SurveyElements.3`), a fixed reason — never text from the file
 * — and a `code`: `qsf_not_recognized`, or `qsf_limit_exceeded` with the limit in `identifier`.
 */
export class QsfImportInputError extends Error {
  readonly invalidParams: TQsfInputInvalidParam[];

  constructor(invalidParams: TQsfInputInvalidParam[]) {
    super("The file is not a Qualtrics survey export (.qsf).");
    this.name = "QsfImportInputError";
    this.invalidParams = invalidParams;
  }
}

/** The file is not a Qualtrics export the import can read. */
export const qsfNotRecognized = (name: string, reason: string): QsfImportInputError =>
  new QsfImportInputError([{ name, reason, code: "qsf_not_recognized" }]);

/** The file is a Qualtrics export past one of the import's limits. */
export const qsfLimitExceeded = (limit: TQsfImportLimit, name: string, reason: string): QsfImportInputError =>
  new QsfImportInputError([{ name, reason, code: "qsf_limit_exceeded", identifier: limit }]);

/**
 * The import could not produce a survey: no question survived, the survey's data cannot fit the
 * prompt budget at any limits, or the assembled draft failed the create check twice. Streamed as `import_failed`. The message is fixed
 * on purpose: the route logs an error's name and frames only, and nothing here quotes the file.
 */
export class QsfImportFailedError extends Error {
  readonly reason: "no_questions" | "prompt_budget" | "draft_invalid";

  constructor(reason: QsfImportFailedError["reason"]) {
    super(`The QSF import failed: ${reason}`);
    this.name = "QsfImportFailedError";
    this.reason = reason;
  }
}

/**
 * The plan ran out of time before any question was planned: the AI calls that fit before the deadline
 * ran past their own timeout (the AI SDK's `timeout`, which spans the SDK's retries), split chunks
 * included, or the deadline left too little time to send one. One slow call never ends the import — its chunk is split, then its questions are
 * dropped. Streamed as `import_timed_out`, like the route's own deadline: to the user both mean "it
 * took too long", and neither is an incident.
 */
export class QsfImportTimeoutError extends Error {
  constructor() {
    super("An AI call of the QSF import timed out");
    this.name = "QsfImportTimeoutError";
  }
}
