import { SurveyImportInputError } from "../core/errors";
import type { TSurveyImportDocumentLimit } from "../types";

/** The sheet or CSV is past one of the import's limits: a 422 before any AI call. */
export const documentLimitExceeded = (
  limit: TSurveyImportDocumentLimit,
  name: string,
  reason: string
): SurveyImportInputError =>
  new SurveyImportInputError(
    [{ name, reason, code: "document_limit_exceeded", identifier: limit }],
    "The file is past one of the import's limits."
  );
