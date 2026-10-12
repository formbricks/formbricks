import { describe, expect, test } from "vitest";
import {
  DEFAULT_SURVEY_LANGUAGE_KEY,
  MAX_BROWSER_LANGUAGE_CANDIDATES,
  type TMatchableSurveyLanguage,
  matchSurveyLanguage,
  resolveSurveyLanguage,
} from "./survey-language-match";

const language = (
  code: string,
  { alias = null as string | null, isDefault = false, enabled = true } = {}
): TMatchableSurveyLanguage => ({ language: { code, alias }, default: isDefault, enabled });

// Italian is the default throughout, so a match on any other row returns that row's stored code.
const withDefault = (...languages: TMatchableSurveyLanguage[]): TMatchableSurveyLanguage[] => [
  language("it-IT", { isDefault: true }),
  ...languages,
];

describe("matchSurveyLanguage — worked examples", () => {
  test.each([
    ["ar", ["ar-SA"], "ar-SA"],
    ["ar", ["ar-EG", "ar-SA"], "ar-EG"],
    ["ar-MA", ["ar-SA", "ar-EG"], "ar-EG"],
    ["ar-SA", ["ar-EG"], "ar-EG"],
    ["ar-SA", ["ar-EG", "ar-SA"], "ar-SA"],
    ["pt", ["pt-BR"], "pt-BR"],
    ["pt-PT", ["pt-BR"], "pt-BR"],
    ["en-GB", ["en-US"], "en-US"],
    ["zh-TW", ["zh-Hans-CN"], null],
    ["zh-TW", ["zh-Hans-CN", "zh-Hant-TW"], "zh-Hant-TW"],
  ])("%s on a survey with %j resolves to %s", (requested, codes, expected) => {
    expect(matchSurveyLanguage(withDefault(...codes.map((code) => language(code))), requested)).toBe(
      expected
    );
  });

  test("de never matches a disabled de-DE", () => {
    expect(matchSurveyLanguage(withDefault(language("de-DE", { enabled: false })), "de")).toBeNull();
  });

  test("de matching the default de-DE returns the default sentinel", () => {
    expect(matchSurveyLanguage([language("de-DE", { isDefault: true }), language("en-US")], "de")).toBe(
      DEFAULT_SURVEY_LANGUAGE_KEY
    );
  });
});

describe("matchSurveyLanguage — tiers", () => {
  test("tier 1 ignores case and treats every underscore as a hyphen", () => {
    const languages = withDefault(language("de-DE"), language("zh-Hant-TW"));
    expect(matchSurveyLanguage(languages, "DE_de")).toBe("de-DE");
    expect(matchSurveyLanguage(languages, "zh_hant_tw")).toBe("zh-Hant-TW");
  });

  test("tier 2 matches an alias case-insensitively", () => {
    expect(matchSurveyLanguage(withDefault(language("pt-BR", { alias: "Brasil" })), "brasil")).toBe("pt-BR");
  });

  test("an exact code beats another row's alias", () => {
    const languages = withDefault(language("sv-SE", { alias: "de-DE" }), language("de-DE"));
    expect(matchSurveyLanguage(languages, "de-DE")).toBe("de-DE");
  });

  test("an alias beats a canonical-equivalent code", () => {
    const languages = withDefault(language("de-DE"), language("de-AT", { alias: "de" }));
    expect(matchSurveyLanguage(languages, "de")).toBe("de-AT");
  });

  test("tier 3 resolves legacy codes in both directions", () => {
    expect(matchSurveyLanguage(withDefault(language("zh-Hans-CN")), "zh-CN")).toBe("zh-Hans-CN");
    // A not-yet-migrated survey still storing a bare code.
    expect(matchSurveyLanguage(withDefault(language("de")), "de-DE")).toBe("de");
  });

  test("tier 3 beats tier 4", () => {
    expect(matchSurveyLanguage(withDefault(language("pt-PT"), language("pt-BR")), "pt")).toBe("pt-BR");
  });

  test("tier 4 falls back to the first same-base language when none is the base default", () => {
    expect(matchSurveyLanguage(withDefault(language("de-CH"), language("de-AT")), "de-LU")).toBe("de-CH");
  });

  test("tier 4 never crosses the Chinese script", () => {
    const chinese = withDefault(language("zh-Hans-CN"), language("zh-Hant-TW"));
    expect(matchSurveyLanguage(chinese, "zh-Hant-HK")).toBe("zh-Hant-TW");
    expect(matchSurveyLanguage(chinese, "zh-HK")).toBe("zh-Hant-TW");
    expect(matchSurveyLanguage(chinese, "zh-SG")).toBe("zh-Hans-CN");
    expect(matchSurveyLanguage(withDefault(language("zh-Hant-TW")), "zh-CN")).toBeNull();
  });

  test("tier 4 skips disabled languages", () => {
    const languages = withDefault(language("ar-EG", { enabled: false }), language("ar-SA"));
    expect(matchSurveyLanguage(languages, "ar-MA")).toBe("ar-SA");
  });

  test("a disabled exact match falls through to an enabled sibling", () => {
    const languages = withDefault(language("de-DE", { enabled: false }), language("de-AT"));
    expect(matchSurveyLanguage(languages, "de-DE")).toBe("de-AT");
  });

  test("the default language matches even when its enabled flag is false", () => {
    expect(matchSurveyLanguage([language("en-US", { isDefault: true, enabled: false })], "en")).toBe(
      DEFAULT_SURVEY_LANGUAGE_KEY
    );
  });

  test("trims input and strips a quality weight", () => {
    expect(matchSurveyLanguage(withDefault(language("de-DE")), "  de-DE;q=0.8 ")).toBe("de-DE");
  });

  test("returns null for empty, malformed and unknown input", () => {
    const languages = withDefault(language("de-DE"));
    expect(matchSurveyLanguage(languages, undefined)).toBeNull();
    expect(matchSurveyLanguage(languages, null)).toBeNull();
    expect(matchSurveyLanguage(languages, "   ")).toBeNull();
    expect(matchSurveyLanguage(languages, ";q=1")).toBeNull();
    expect(matchSurveyLanguage(languages, "!!")).toBeNull();
    expect(matchSurveyLanguage(languages, "xx")).toBeNull();
    expect(matchSurveyLanguage([], "de")).toBeNull();
  });
});

describe("resolveSurveyLanguage", () => {
  const germanEnglish = [language("en-US", { isDefault: true }), language("de-DE")];

  test("an explicit language wins over the browser languages", () => {
    expect(
      resolveSurveyLanguage({
        languages: withDefault(language("de-DE"), language("fr-FR")),
        explicitLanguage: "fr",
        browserLanguages: ["de-DE"],
        autoSelectLanguage: true,
        unmatchedExplicitLanguage: "fallback",
      })
    ).toBe("fr-FR");
  });

  test("uses the browser language only when the survey opted in", () => {
    const input = {
      languages: germanEnglish,
      browserLanguages: ["de-DE", "en"],
      unmatchedExplicitLanguage: "fallback" as const,
    };
    expect(resolveSurveyLanguage({ ...input, autoSelectLanguage: true })).toBe("de-DE");
    expect(resolveSurveyLanguage({ ...input, autoSelectLanguage: false })).toBe(DEFAULT_SURVEY_LANGUAGE_KEY);
    expect(resolveSurveyLanguage({ ...input, autoSelectLanguage: null })).toBe(DEFAULT_SURVEY_LANGUAGE_KEY);
    expect(resolveSurveyLanguage({ ...input, autoSelectLanguage: undefined })).toBe(
      DEFAULT_SURVEY_LANGUAGE_KEY
    );
  });

  test("tries each browser language through every tier before the next one (D5)", () => {
    expect(
      resolveSurveyLanguage({
        languages: [language("de-DE", { isDefault: true }), language("en-US")],
        browserLanguages: ["en-GB", "de-DE"],
        autoSelectLanguage: true,
        unmatchedExplicitLanguage: "fallback",
      })
    ).toBe("en-US");
  });

  test("moves past browser languages that match nothing", () => {
    expect(
      resolveSurveyLanguage({
        languages: germanEnglish,
        browserLanguages: ["fr-FR", "ja", "de-AT"],
        autoSelectLanguage: true,
        unmatchedExplicitLanguage: "fallback",
      })
    ).toBe("de-DE");
  });

  test("falls back to the default when no browser language matches", () => {
    expect(
      resolveSurveyLanguage({
        languages: germanEnglish,
        browserLanguages: ["fr-FR"],
        autoSelectLanguage: true,
        unmatchedExplicitLanguage: "fallback",
      })
    ).toBe(DEFAULT_SURVEY_LANGUAGE_KEY);
  });

  test("stops after the candidate cap", () => {
    const filler = Array.from({ length: MAX_BROWSER_LANGUAGE_CANDIDATES }, () => "fr-FR");
    expect(
      resolveSurveyLanguage({
        languages: germanEnglish,
        browserLanguages: [...filler, "de-DE"],
        autoSelectLanguage: true,
        unmatchedExplicitLanguage: "fallback",
      })
    ).toBe(DEFAULT_SURVEY_LANGUAGE_KEY);
  });

  describe("an explicit language that matches nothing", () => {
    test("falls through to the browser language, then the default, for link surveys", () => {
      const input = {
        languages: germanEnglish,
        explicitLanguage: "xx",
        unmatchedExplicitLanguage: "fallback" as const,
      };
      expect(resolveSurveyLanguage({ ...input, browserLanguages: ["de-DE"], autoSelectLanguage: true })).toBe(
        "de-DE"
      );
      expect(resolveSurveyLanguage({ ...input, browserLanguages: ["fr"], autoSelectLanguage: true })).toBe(
        DEFAULT_SURVEY_LANGUAGE_KEY
      );
      expect(
        resolveSurveyLanguage({ ...input, browserLanguages: ["de-DE"], autoSelectLanguage: false })
      ).toBe(DEFAULT_SURVEY_LANGUAGE_KEY);
    });

    test("skips the survey in the SDK even when a browser language would match (D4)", () => {
      expect(
        resolveSurveyLanguage({
          languages: germanEnglish,
          explicitLanguage: "fr",
          browserLanguages: ["de-DE"],
          autoSelectLanguage: true,
          unmatchedExplicitLanguage: "skip",
        })
      ).toBeNull();
    });
  });

  test("the SDK uses the browser language when no explicit language is set", () => {
    expect(
      resolveSurveyLanguage({
        languages: germanEnglish,
        explicitLanguage: undefined,
        browserLanguages: ["de-DE"],
        autoSelectLanguage: true,
        unmatchedExplicitLanguage: "skip",
      })
    ).toBe("de-DE");
  });

  test("a blank explicit language counts as none", () => {
    expect(
      resolveSurveyLanguage({
        languages: germanEnglish,
        explicitLanguage: "  ",
        browserLanguages: ["de"],
        autoSelectLanguage: true,
        unmatchedExplicitLanguage: "skip",
      })
    ).toBe("de-DE");
  });

  test("an explicit language matching the default returns the default sentinel", () => {
    expect(
      resolveSurveyLanguage({
        languages: germanEnglish,
        explicitLanguage: "en",
        unmatchedExplicitLanguage: "skip",
      })
    ).toBe(DEFAULT_SURVEY_LANGUAGE_KEY);
  });
});
