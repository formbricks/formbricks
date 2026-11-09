import { SURVEY_IMPORT_AI_MAX_SOURCE_CHARS } from "../limits";
import { qsfLimitExceeded } from "./errors";
import { estimateQsfMinimumPromptChars } from "./prompt";
import type { TQsfSurvey } from "./qsf-model";
import { readQsf } from "./read-qsf";

/*
 * The Qualtrics lane's read (`pipeline.ts` has the rest). It runs in the upload's worker thread
 * (`../core/upload-thread.ts`), so it loads nothing server-side: no AI, no database.
 */

export interface TPreparedQsfImport {
  fileName: string;
  surveyName: string;
  survey: TQsfSurvey;
}

/** Read and check the file, before any AI call. Throws `SurveyImportInputError` for a file it cannot read. */
export function prepareQsfImport(qsf: Record<string, unknown>, fileName: string): TPreparedQsfImport {
  const survey = readQsf(qsf);
  // Every part of the prompt is bounded, so only a hostile file gets here; refuse it before the stream.
  if (estimateQsfMinimumPromptChars(survey) > SURVEY_IMPORT_AI_MAX_SOURCE_CHARS) {
    throw qsfLimitExceeded(
      "prompt_size",
      "file.SurveyElements",
      "The survey's questions and logic are too large to import"
    );
  }
  return { fileName, surveyName: survey.name, survey };
}
