import { describe, expect, test } from "vitest";
import { matchSurveyLanguage, normalizeLanguageCode, resolveSurveyLanguage } from "./language";

const languages = [
  {
    default: true,
    enabled: true,
    language: {
      code: "en",
      alias: "English",
    },
  },
  {
    default: false,
    enabled: true,
    language: {
      code: "es-ES",
      alias: "es",
    },
  },
  {
    default: false,
    enabled: false,
    language: {
      code: "de",
      alias: null,
    },
  },
];

describe("survey language helpers", () => {
  test("normalizes quality values, whitespace, underscores, and case", () => {
    expect(normalizeLanguageCode(" PT_BR ;q=0.9 ")).toBe("pt-br");
  });

  test("matches exact codes, aliases, and loose variants while ignoring disabled languages", () => {
    expect(matchSurveyLanguage(languages, "es")).toBe("es-ES");
    expect(matchSurveyLanguage(languages, "es-MX")).toBe("es-ES");
    expect(matchSurveyLanguage(languages, "de-DE")).toBeUndefined();
  });

  test("resolves explicit language before browser language", () => {
    expect(
      resolveSurveyLanguage({
        languages,
        explicitLanguageCode: "es-MX",
        browserLanguageCodes: ["en-US"],
        autoSelectLanguage: true,
      })
    ).toBe("es-ES");
  });

  test("uses browser language only when enabled and falls back to default", () => {
    expect(
      resolveSurveyLanguage({
        languages,
        browserLanguageCodes: ["es-MX"],
        autoSelectLanguage: true,
      })
    ).toBe("es-ES");

    expect(
      resolveSurveyLanguage({
        languages,
        browserLanguageCodes: ["es-MX"],
        autoSelectLanguage: false,
      })
    ).toBe("default");

    expect(
      resolveSurveyLanguage({
        languages,
        browserLanguageCodes: ["fr-CA"],
        autoSelectLanguage: true,
      })
    ).toBe("default");
  });

  test("supports strict unmatched explicit language behavior", () => {
    expect(
      resolveSurveyLanguage({
        languages,
        explicitLanguageCode: "fr",
        browserLanguageCodes: ["es-MX"],
        autoSelectLanguage: true,
        unmatchedExplicitLanguageBehavior: "undefined",
      })
    ).toBeUndefined();
  });
});
