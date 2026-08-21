import { describe, expect, test } from "vitest";
import { type TSurveyLanguage } from "@formbricks/types/surveys/types";
import { canonicalizeLanguageCode, getVisibleSurveyLanguages, isSameLanguageCode } from "./language-options";

const language = (code: string, { enabled = true, isDefault = false } = {}): TSurveyLanguage =>
  ({
    default: isDefault,
    enabled,
    language: { id: `id-${code}`, code, alias: null },
  }) as unknown as TSurveyLanguage;

const codesOf = (languages: TSurveyLanguage[]): string[] =>
  languages.map((surveyLanguage) => surveyLanguage.language.code);

describe("canonicalizeLanguageCode", () => {
  test("maps a legacy alias to its canonical code", () => {
    expect(canonicalizeLanguageCode("hi")).toBe("hi-IN");
  });

  test("leaves an already-canonical code alone", () => {
    expect(canonicalizeLanguageCode("en-US")).toBe("en-US");
  });

  test("falls back to the code itself when it has no canonical mapping", () => {
    expect(canonicalizeLanguageCode("xx-YY")).toBe("xx-YY");
  });
});

describe("isSameLanguageCode", () => {
  test("matches a legacy alias against its canonical form", () => {
    expect(isSameLanguageCode("hi", "hi-IN")).toBe(true);
  });

  test("matches a canonical code against a legacy alias — the other direction", () => {
    expect(isSameLanguageCode("hi-IN", "hi")).toBe(true);
  });

  test("matches identical codes", () => {
    expect(isSameLanguageCode("de-DE", "de-DE")).toBe(true);
  });

  test("does not collapse two genuinely different languages", () => {
    expect(isSameLanguageCode("de-DE", "en-US")).toBe(false);
  });

  test("is false for a null or undefined counterpart rather than throwing", () => {
    expect(isSameLanguageCode("en-US", null)).toBe(false);
    expect(isSameLanguageCode("en-US", undefined)).toBe(false);
  });

  test("is false for an empty counterpart", () => {
    expect(isSameLanguageCode("en-US", "")).toBe(false);
  });
});

describe("getVisibleSurveyLanguages", () => {
  test("keeps every enabled language when none are aliases of each other", () => {
    const languages = [language("en-US", { isDefault: true }), language("de-DE"), language("ja-JP")];

    expect(codesOf(getVisibleSurveyLanguages(languages))).toEqual(["en-US", "de-DE", "ja-JP"]);
  });

  test("drops disabled languages", () => {
    const languages = [language("en-US", { isDefault: true }), language("de-DE", { enabled: false })];

    expect(codesOf(getVisibleSurveyLanguages(languages))).toEqual(["en-US"]);
  });

  test("dedupes a legacy alias against its canonical row, keeping the canonical code", () => {
    const languages = [language("en-US", { isDefault: true }), language("hi"), language("hi-IN")];

    expect(codesOf(getVisibleSurveyLanguages(languages))).toEqual(["en-US", "hi-IN"]);
  });

  test("keeps the canonical code even when the alias is listed second", () => {
    const languages = [language("en-US", { isDefault: true }), language("hi-IN"), language("hi")];

    expect(codesOf(getVisibleSurveyLanguages(languages))).toEqual(["en-US", "hi-IN"]);
  });

  test("keeps a legacy alias when its canonical row is not offered", () => {
    const languages = [language("en-US", { isDefault: true }), language("hi")];

    expect(codesOf(getVisibleSurveyLanguages(languages))).toEqual(["en-US", "hi"]);
  });

  test("a disabled canonical row does not shadow its enabled alias", () => {
    const languages = [language("hi-IN", { enabled: false }), language("hi")];

    expect(codesOf(getVisibleSurveyLanguages(languages))).toEqual(["hi"]);
  });

  test("returns an empty list for a survey with no languages", () => {
    expect(getVisibleSurveyLanguages([])).toEqual([]);
  });
});
