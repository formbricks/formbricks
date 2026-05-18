import { describe, expect, test } from "vitest";
import { normalizeV3SurveyLanguageTag, resolveV3SurveyLanguageCode } from "./language";

const languages = [
  { code: "en-US", enabled: true },
  { code: "de-DE", enabled: true },
  { code: "fr-FR", enabled: false },
];

describe("normalizeV3SurveyLanguageTag", () => {
  test.each([
    ["EN_us", "en-US"],
    ["en-us", "en-US"],
    ["de", "de"],
    ["zh_hans_cn", "zh-Hans-CN"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeV3SurveyLanguageTag(input)).toBe(expected);
  });

  test("returns null for invalid language tags", () => {
    expect(normalizeV3SurveyLanguageTag("not a locale")).toBeNull();
  });
});

describe("resolveV3SurveyLanguageCode", () => {
  test("matches configured languages case-insensitively and normalizes underscores", () => {
    expect(resolveV3SurveyLanguageCode("DE_de", languages)).toEqual({ ok: true, code: "de-DE" });
  });

  test("resolves language-only tags when exactly one configured language matches", () => {
    expect(resolveV3SurveyLanguageCode("de", languages)).toEqual({ ok: true, code: "de-DE" });
  });

  test("returns disabled when the resolved language is disabled", () => {
    expect(resolveV3SurveyLanguageCode("fr", languages)).toEqual({
      ok: false,
      reason: "disabled",
      message: "Language 'fr-FR' is disabled for this survey",
    });
  });

  test("returns ambiguous when language-only tags match multiple configured languages", () => {
    expect(
      resolveV3SurveyLanguageCode("pt", [
        { code: "pt-BR", enabled: true },
        { code: "pt-PT", enabled: true },
      ])
    ).toEqual({
      ok: false,
      reason: "ambiguous",
      message: "Language 'pt' is ambiguous for this survey; use one of pt-BR, pt-PT",
    });
  });

  test("returns unknown for languages not configured on the survey", () => {
    expect(resolveV3SurveyLanguageCode("es-ES", languages)).toEqual({
      ok: false,
      reason: "unknown",
      message: "Language 'es-ES' is not configured for this survey",
    });
  });
});
