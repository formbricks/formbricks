import { describe, expect, test } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { resolveSurveyLanguageCode } from "./language";

const language = (
  code: string,
  { alias = null as string | null, isDefault = false, enabled = true } = {}
) => ({
  language: {
    id: `l-${code}`,
    code,
    alias,
    createdAt: new Date(),
    updatedAt: new Date(),
    workspaceId: "p1",
  },
  default: isDefault,
  enabled,
});

const surveyWith = (languages: ReturnType<typeof language>[]): TSurvey =>
  ({ languages }) as unknown as TSurvey;

const survey = surveyWith([
  language("en-US", { isDefault: true }),
  language("de-DE"),
  language("pt-BR", { alias: "brasil" }),
  language("fr-FR", { enabled: false }),
]);

describe("resolveSurveyLanguageCode", () => {
  test("returns the survey's stored code for an enabled language", () => {
    expect(resolveSurveyLanguageCode("de-DE", survey)).toBe("de-DE");
    expect(resolveSurveyLanguageCode("de-de", survey)).toBe("de-DE");
  });

  test("resolves a legacy or bare code through its canonical tag", () => {
    expect(resolveSurveyLanguageCode("de", survey)).toBe("de-DE");
  });

  test("resolves a custom alias", () => {
    expect(resolveSurveyLanguageCode("brasil", survey)).toBe("pt-BR");
  });

  test("falls back to 'default' rather than erroring on a language the survey does not offer", () => {
    expect(resolveSurveyLanguageCode("it-IT", survey)).toBe("default");
    expect(resolveSurveyLanguageCode("not-a-language", survey)).toBe("default");
    expect(resolveSurveyLanguageCode(undefined, survey)).toBe("default");
  });

  test("treats a disabled language, and the default language itself, as 'default'", () => {
    expect(resolveSurveyLanguageCode("fr-FR", survey)).toBe("default");
    expect(resolveSurveyLanguageCode("en-US", survey)).toBe("default");
  });

  test("prefers an exact code over another language's alias", () => {
    // Without the precedence, the alias row could shadow the row whose code was asked for.
    const shadowed = surveyWith([
      language("en-US", { isDefault: true }),
      language("sv-SE", { alias: "de-DE" }),
      language("de-DE"),
    ]);
    expect(resolveSurveyLanguageCode("de-DE", shadowed)).toBe("de-DE");
  });
});
