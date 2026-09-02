import { describe, expect, test } from "vitest";
import {
  DEFAULT_SURVEY_LANGUAGE_CODE,
  SURVEY_RUNTIME_LANGUAGE_CODES,
  resolveSurveyRuntimeLanguageCode,
} from "./survey-runtime-languages";

describe("SURVEY_RUNTIME_LANGUAGE_CODES", () => {
  test("holds unique, canonical, region-tagged codes", () => {
    expect(new Set(SURVEY_RUNTIME_LANGUAGE_CODES).size).toBe(SURVEY_RUNTIME_LANGUAGE_CODES.length);
    for (const code of SURVEY_RUNTIME_LANGUAGE_CODES) {
      expect(code).toMatch(/^[a-z]{2,3}(-[A-Z][a-z]{3})?-[A-Z]{2}$/);
    }
  });

  test("includes the fallback language", () => {
    expect(SURVEY_RUNTIME_LANGUAGE_CODES).toContain(DEFAULT_SURVEY_LANGUAGE_CODE);
  });
});

describe("resolveSurveyRuntimeLanguageCode", () => {
  test("returns a shipped code unchanged", () => {
    expect(resolveSurveyRuntimeLanguageCode("de-DE")).toBe("de-DE");
    expect(resolveSurveyRuntimeLanguageCode("zh-Hant-TW")).toBe("zh-Hant-TW");
  });

  test("matches case-insensitively", () => {
    expect(resolveSurveyRuntimeLanguageCode("DE-de")).toBe("de-DE");
    expect(resolveSurveyRuntimeLanguageCode("zh-hant-tw")).toBe("zh-Hant-TW");
  });

  test("resolves a legacy bare code to the shipped bundle", () => {
    expect(resolveSurveyRuntimeLanguageCode("de")).toBe("de-DE");
    expect(resolveSurveyRuntimeLanguageCode("ar")).toBe("ar-EG");
    expect(resolveSurveyRuntimeLanguageCode("zh-CN")).toBe("zh-Hans-CN");
  });

  test("returns null for a language the runtime ships no bundle for", () => {
    // pt-PT is a dashboard language with no survey bundle; km/fa are in the 215-entry picker only.
    expect(resolveSurveyRuntimeLanguageCode("pt-PT")).toBeNull();
    expect(resolveSurveyRuntimeLanguageCode("km-KH")).toBeNull();
    expect(resolveSurveyRuntimeLanguageCode("fa-IR")).toBeNull();
    // A deliberate non-default region is its own language tag, not its CLDR default.
    expect(resolveSurveyRuntimeLanguageCode("de-AT")).toBeNull();
  });

  test("returns null for empty, blank and unparseable input", () => {
    expect(resolveSurveyRuntimeLanguageCode(null)).toBeNull();
    expect(resolveSurveyRuntimeLanguageCode(undefined)).toBeNull();
    expect(resolveSurveyRuntimeLanguageCode("")).toBeNull();
    expect(resolveSurveyRuntimeLanguageCode("   ")).toBeNull();
    expect(resolveSurveyRuntimeLanguageCode("!!!")).toBeNull();
  });

  test("trims surrounding whitespace", () => {
    expect(resolveSurveyRuntimeLanguageCode("  fr-FR  ")).toBe("fr-FR");
  });
});
