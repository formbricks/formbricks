import type { TSurvey } from "@formbricks/types/surveys/types";

export type TLanguageAddedEvent = {
  event: "survey_language_enabled" | "survey_language_added";
  languageCode: string;
  /** The survey's language count before this language. */
  existingLanguageCount: number;
};

/**
 * The analytics events for the languages an edit adds, in order: the first language added to a
 * single-language survey enables multi-language, every other one is an addition.
 */
export const getLanguageAddedEvents = (
  oldSurvey: Pick<TSurvey, "languages">,
  newSurvey: Pick<TSurvey, "languages">
): TLanguageAddedEvent[] => {
  const oldLanguages = oldSurvey.languages ?? [];
  const newLanguages = newSurvey.languages ?? [];
  const oldLanguageCodes = new Set(oldLanguages.map((l) => l.language.code));
  const addedLanguages = newLanguages.filter((l) => !oldLanguageCodes.has(l.language.code));
  const wasMultiLangBefore = oldLanguages.length > 1;

  return addedLanguages.map((lang, index) => ({
    event: !wasMultiLangBefore && index === 0 ? "survey_language_enabled" : "survey_language_added",
    languageCode: lang.language.code,
    existingLanguageCount: oldLanguages.length + index,
  }));
};
