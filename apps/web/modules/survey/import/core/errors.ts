import {
  type InvalidParam,
  problemPayloadTooLarge,
  problemUnprocessableContent,
  problemUnsupportedMediaType,
} from "@/app/api/v3/lib/response";
import type {
  TSurveyImportDocumentLimit,
  TSurveyImportFileLimit,
  TSurveyImportLimit,
  TSurveyImportProblemCode,
  TSurveyImportUnsupportedFile,
} from "../types";

/** One problem with a refused file, coded for the dialog (see `TSurveyImportRefusalCode`). */
export type TSurveyImportInvalidParam = InvalidParam &
  (
    | { code: "file_unreadable" | "qsf_not_recognized" }
    | { code: "file_type_unsupported"; identifier?: TSurveyImportUnsupportedFile }
    | { code: "file_limit_exceeded"; identifier: TSurveyImportFileLimit }
    | { code: "qsf_limit_exceeded"; identifier: TSurveyImportLimit }
    | { code: "document_limit_exceeded"; identifier: TSurveyImportDocumentLimit }
  );

/**
 * The uploaded file is past one of the upload's size limits (`file_limit_exceeded`): its bytes, or the
 * entries or inflated bytes of the archive it is. Answered as a 413 before anything else reads it.
 */
export class SurveyImportFileTooLargeError extends Error {
  readonly invalidParams: TSurveyImportInvalidParam[];

  /** @param name Where the limit was passed: the file, or a part of it (`file.survey`). */
  constructor(limit: TSurveyImportFileLimit, reason: string, name = "file") {
    super(reason);
    this.name = "SurveyImportFileTooLargeError";
    this.invalidParams = [{ name, reason, code: "file_limit_exceeded", identifier: limit }];
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
  readonly invalidParams: (TSurveyImportInvalidParam | InvalidParam)[];
  /**
   * The problem's own code, when the lane says more than "unprocessable": a Formbricks file that is
   * malformed (`formbricks_file_invalid`) or written by a newer Formbricks (`formbricks_file_too_new`),
   * whose params are the file's fields rather than a refusal code.
   */
  readonly problemCode?: TSurveyImportProblemCode;

  constructor(
    invalidParams: (TSurveyImportInvalidParam | InvalidParam)[],
    message: string,
    problemCode?: TSurveyImportProblemCode
  ) {
    super(message);
    this.name = "SurveyImportInputError";
    this.invalidParams = invalidParams;
    this.problemCode = problemCode;
  }
}

/**
 * The import could not produce a survey: no question survived, the survey's data cannot fit the
 * prompt budget at any limits, or the assembled draft failed the create check twice. Streamed as
 * `import_failed`. The message is fixed on purpose: the route logs an error's name and frames only,
 * and nothing here quotes the file.
 */
export class SurveyImportFailedError extends Error {
  /**
   * `too_many_questions`: a document's plan holds more questions than one import takes, the AI ceiling
   * past which the file is imported through MCP instead.
   */
  readonly reason: "no_questions" | "prompt_budget" | "draft_invalid" | "too_many_questions";

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

/** Problems the create's checks found, named from where the survey sits: `file.survey…` or `survey…`. */
export const nameFromSurvey = (params: InvalidParam[], fieldPrefix: string | null): InvalidParam[] => {
  const root = fieldPrefix ? `${fieldPrefix}.survey` : "survey";
  return params.map((param) => ({
    ...param,
    name: ["data", "body", ""].includes(param.name) ? root : `${root}.${param.name}`,
  }));
};

/**
 * The problem response for a refused import — a 413, 415 or 422 naming each field — or `null` for an
 * error that is not a refusal. Shared by every route that reads or writes an import.
 */
export const toRefusalResponse = (error: unknown, requestId: string, instance: string): Response | null => {
  if (error instanceof SurveyImportFileTooLargeError) {
    return problemPayloadTooLarge(requestId, error.message, instance, error.invalidParams);
  }
  if (error instanceof SurveyImportUnsupportedFileError) {
    return problemUnsupportedMediaType(requestId, error.message, {
      instance,
      invalid_params: error.invalidParams,
    });
  }
  if (error instanceof SurveyImportInputError) {
    return problemUnprocessableContent(requestId, error.message, {
      instance,
      invalid_params: error.invalidParams,
      ...(error.problemCode ? { code: error.problemCode } : {}),
    });
  }
  return null;
};
