import type { InvalidParam } from "@/app/api/v3/lib/response";
import type { TSurveyImportFileLimit, TSurveyImportLimit, TSurveyImportUnsupportedFile } from "../types";

/** One problem with a refused file, coded for the dialog (see `TSurveyImportRefusalCode`). */
export type TSurveyImportInvalidParam = InvalidParam &
  (
    | { code: "file_unreadable" | "qsf_not_recognized" }
    | { code: "file_type_unsupported"; identifier?: TSurveyImportUnsupportedFile }
    | { code: "file_limit_exceeded"; identifier: TSurveyImportFileLimit }
    | { code: "qsf_limit_exceeded"; identifier: TSurveyImportLimit }
  );

/**
 * The uploaded file is past one of the upload's size limits (`file_limit_exceeded`): its bytes, or the
 * entries or inflated bytes of the archive it is. Answered as a 413 before anything else reads it.
 */
export class SurveyImportFileTooLargeError extends Error {
  readonly invalidParams: TSurveyImportInvalidParam[];

  constructor(limit: TSurveyImportFileLimit, reason: string) {
    super(reason);
    this.name = "SurveyImportFileTooLargeError";
    this.invalidParams = [{ name: "file", reason, code: "file_limit_exceeded", identifier: limit }];
  }
}

/**
 * The import does not read this kind of file (`file_type_unsupported`), answered as a 415. `kind` is
 * what the file was recognized as, when it was.
 */
export class SurveyImportUnsupportedFileError extends Error {
  readonly invalidParams: TSurveyImportInvalidParam[];

  constructor(reason: string, kind?: TSurveyImportUnsupportedFile) {
    super(reason);
    this.name = "SurveyImportUnsupportedFileError";
    this.invalidParams = [
      { name: "file", reason, code: "file_type_unsupported", ...(kind ? { identifier: kind } : {}) },
    ];
  }
}

/**
 * The file is not one the lane can read, or it is past one of the lane's limits. Answered as a 422
 * before the stream opens, so no AI is spent on it.
 *
 * Each invalid param names where in the file (`file.SurveyElements.3`), a fixed reason — never text from
 * the file — and a refusal `code`. The message is the problem's detail; each lane sets its own, fixed.
 */
export class SurveyImportInputError extends Error {
  readonly invalidParams: TSurveyImportInvalidParam[];

  constructor(invalidParams: TSurveyImportInvalidParam[], message: string) {
    super(message);
    this.name = "SurveyImportInputError";
    this.invalidParams = invalidParams;
  }
}

/**
 * The import could not produce a survey: no question survived, the survey's data cannot fit the
 * prompt budget at any limits, or the assembled draft failed the create check twice. Streamed as
 * `import_failed`. The message is fixed on purpose: the route logs an error's name and frames only,
 * and nothing here quotes the file.
 */
export class SurveyImportFailedError extends Error {
  readonly reason: "no_questions" | "prompt_budget" | "draft_invalid";

  constructor(reason: SurveyImportFailedError["reason"]) {
    super(`The survey import failed: ${reason}`);
    this.name = "SurveyImportFailedError";
    this.reason = reason;
  }
}

/**
 * The plan ran out of time before any question was planned: the AI calls that fit before the deadline
 * ran past their own timeout (the AI SDK's `timeout`, which spans the SDK's retries), split chunks
 * included, or the deadline left too little time to send one. One slow call never ends the import —
 * its chunk is split, then its questions are dropped. Streamed as `import_timed_out`, like the route's
 * own deadline: to the user both mean "it took too long", and neither is an incident.
 */
export class SurveyImportTimeoutError extends Error {
  constructor() {
    super("An AI call of the survey import timed out");
    this.name = "SurveyImportTimeoutError";
  }
}

/** The file is the kind it looks like but cannot be read (`file_unreadable`), answered as a 422. */
export const surveyImportFileUnreadable = (reason: string): SurveyImportInputError =>
  new SurveyImportInputError(
    [{ name: "file", reason, code: "file_unreadable" }],
    "The file could not be read."
  );
