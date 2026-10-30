import { type TSanitizedTexts, sanitizeImportTexts } from "../core/sanitize-text";
import type { TQsfSurvey } from "./qsf-model";

/**
 * Sanitize every text of a Qualtrics survey (ENG-3607): the lane-neutral sanitizer, with report lines
 * that name a question by its export tag and the end message as the ending.
 */
export const sanitizeQsfTexts = (survey: TQsfSurvey, signal: AbortSignal): Promise<TSanitizedTexts> =>
  sanitizeImportTexts(
    {
      texts: survey.texts,
      defaultLanguage: survey.defaultLanguage,
      endingKey: survey.endMessageKey,
      questionLabel: (questionRef) => survey.questions.get(questionRef)?.exportTag,
    },
    signal
  );
