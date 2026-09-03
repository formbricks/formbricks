import { describe, expect, test } from "vitest";
import {
  DEFAULT_SURVEY_LANGUAGE_CODE,
  SURVEY_RUNTIME_LANGUAGE_CODES,
  isSurveyRuntimeLanguage,
  resolveSurveyLanguageDefaultTag,
  resolveSurveyRuntimeBundle,
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

describe("resolveSurveyLanguageDefaultTag", () => {
  test("drops the region to reach the language's canonical tag", () => {
    expect(resolveSurveyLanguageDefaultTag("de-AT")).toBe("de-DE");
    expect(resolveSurveyLanguageDefaultTag("es-MX")).toBe("es-ES");
    expect(resolveSurveyLanguageDefaultTag("en-GB")).toBe("en-US");
    expect(resolveSurveyLanguageDefaultTag("pt-PT")).toBe("pt-BR");
  });

  test("preserves script, including when a legacy tag carries it in the region", () => {
    expect(resolveSurveyLanguageDefaultTag("zh-Hant")).toBe("zh-Hant-TW");
    expect(resolveSurveyLanguageDefaultTag("zh-TW")).toBe("zh-Hant-TW");
    expect(resolveSurveyLanguageDefaultTag("zh-HK")).toBe("zh-Hant-TW");
    expect(resolveSurveyLanguageDefaultTag("zh-CN")).toBe("zh-Hans-CN");
  });

  test("returns null for input that is not a language tag", () => {
    expect(resolveSurveyLanguageDefaultTag("")).toBeNull();
    expect(resolveSurveyLanguageDefaultTag("!!!")).toBeNull();
    // Underscore is not a valid BCP-47 separator.
    expect(resolveSurveyLanguageDefaultTag("DE_de")).toBeNull();
  });
});

describe("resolveSurveyRuntimeBundle", () => {
  test("returns a shipped code unchanged", () => {
    expect(resolveSurveyRuntimeBundle("de-DE")).toBe("de-DE");
    expect(resolveSurveyRuntimeBundle("zh-Hant-TW")).toBe("zh-Hant-TW");
  });

  test("matches case-insensitively", () => {
    expect(resolveSurveyRuntimeBundle("DE-de")).toBe("de-DE");
    expect(resolveSurveyRuntimeBundle("zh-hant-tw")).toBe("zh-Hant-TW");
  });

  test("resolves a legacy bare code to the shipped bundle", () => {
    expect(resolveSurveyRuntimeBundle("de")).toBe("de-DE");
    expect(resolveSurveyRuntimeBundle("ar")).toBe("ar-EG");
    expect(resolveSurveyRuntimeBundle("zh-CN")).toBe("zh-Hans-CN");
  });

  test("resolves a regional variant to its language's bundle, which is what the runtime serves", () => {
    // No bundle of their own, but the runtime renders them from the language's default bundle — so a
    // survey defaulting to any of these gets translated buttons and validation messages.
    expect(resolveSurveyRuntimeBundle("de-AT")).toBe("de-DE");
    expect(resolveSurveyRuntimeBundle("es-MX")).toBe("es-ES");
    expect(resolveSurveyRuntimeBundle("en-GB")).toBe("en-US");
    expect(resolveSurveyRuntimeBundle("pt-PT")).toBe("pt-BR");
    expect(resolveSurveyRuntimeBundle("ar-SA")).toBe("ar-EG");
  });

  test("returns null for a language the runtime ships nothing for", () => {
    // Not the terminal English fallback: these would render English buttons around translated
    // questions, which is the case the default-language picker has to keep out (ENG-2325).
    expect(resolveSurveyRuntimeBundle("km-KH")).toBeNull();
    expect(resolveSurveyRuntimeBundle("ne-NP")).toBeNull();
    expect(resolveSurveyRuntimeBundle("fa-IR")).toBeNull();
    expect(resolveSurveyRuntimeBundle("aa-ET")).toBeNull();
  });

  test("returns null for empty, blank and unparseable input", () => {
    expect(resolveSurveyRuntimeBundle(null)).toBeNull();
    expect(resolveSurveyRuntimeBundle(undefined)).toBeNull();
    expect(resolveSurveyRuntimeBundle("")).toBeNull();
    expect(resolveSurveyRuntimeBundle("   ")).toBeNull();
    expect(resolveSurveyRuntimeBundle("!!!")).toBeNull();
  });

  test("trims surrounding whitespace", () => {
    expect(resolveSurveyRuntimeBundle("  fr-FR  ")).toBe("fr-FR");
  });
});

describe("isSurveyRuntimeLanguage", () => {
  test("is true for a shipped language and for a variant it serves", () => {
    expect(isSurveyRuntimeLanguage("de-DE")).toBe(true);
    expect(isSurveyRuntimeLanguage("de-AT")).toBe(true);
    expect(isSurveyRuntimeLanguage("pt-PT")).toBe(true);
  });

  test("is false for a language with no strings at all", () => {
    expect(isSurveyRuntimeLanguage("km-KH")).toBe(false);
    expect(isSurveyRuntimeLanguage(null)).toBe(false);
  });
});
