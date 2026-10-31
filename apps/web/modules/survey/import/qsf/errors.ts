import { SurveyImportInputError, type TSurveyImportInvalidParam } from "../core/errors";
import type { TSurveyImportLimit } from "../types";

/** A refused Qualtrics file, answered 422 with a fixed detail and `invalidParams` naming why. */
export const qsfRefused = (invalidParams: TSurveyImportInvalidParam[]): SurveyImportInputError =>
  new SurveyImportInputError(invalidParams, "The file is not a Qualtrics survey export (.qsf).");

/** The file is not a Qualtrics export the import can read. */
export const qsfNotRecognized = (name: string, reason: string): SurveyImportInputError =>
  qsfRefused([{ name, reason, code: "qsf_not_recognized" }]);

/** The file is a Qualtrics export past one of the import's limits. */
export const qsfLimitExceeded = (
  limit: TSurveyImportLimit,
  name: string,
  reason: string
): SurveyImportInputError => qsfRefused([{ name, reason, code: "qsf_limit_exceeded", identifier: limit }]);
