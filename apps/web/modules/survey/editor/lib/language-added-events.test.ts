import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getLanguageAddedEvents } from "./language-added-events";

const withLanguages = (...codes: string[]) =>
  ({ languages: codes.map((code) => ({ language: { code } })) }) as unknown as Pick<TSurvey, "languages">;

describe("getLanguageAddedEvents", () => {
  test("is empty when no language is added", () => {
    expect(getLanguageAddedEvents(withLanguages("en", "de"), withLanguages("de"))).toEqual([]);
  });

  test("enables multi-language with the first language added to a single-language survey", () => {
    expect(getLanguageAddedEvents(withLanguages("en"), withLanguages("en", "de", "fr"))).toEqual([
      { event: "survey_language_enabled", languageCode: "de", existingLanguageCount: 1 },
      { event: "survey_language_added", languageCode: "fr", existingLanguageCount: 2 },
    ]);
  });

  test("treats a survey without languages as single-language", () => {
    expect(getLanguageAddedEvents({ languages: [] }, withLanguages("en"))).toEqual([
      { event: "survey_language_enabled", languageCode: "en", existingLanguageCount: 0 },
    ]);
  });

  test("counts every language added to a multi-language survey as an addition", () => {
    expect(getLanguageAddedEvents(withLanguages("en", "de"), withLanguages("en", "de", "fr", "es"))).toEqual([
      { event: "survey_language_added", languageCode: "fr", existingLanguageCount: 2 },
      { event: "survey_language_added", languageCode: "es", existingLanguageCount: 3 },
    ]);
  });
});
