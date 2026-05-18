import { describe, expect, test } from "vitest";
import {
  normalizeV3SurveyLanguageTag,
  parseV3SurveyLanguageQuery,
  resolveV3SurveyLanguageCode,
} from "./language";

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

describe("parseV3SurveyLanguageQuery", () => {
  test("parses comma-separated language selectors", () => {
    expect(parseV3SurveyLanguageQuery("de-DE, pt_PT, EN_us")).toEqual({
      ok: true,
      languages: ["de-DE", "pt-PT", "en-US"],
    });
  });

  test("parses repeated language selectors", () => {
    expect(parseV3SurveyLanguageQuery(["de-DE", "pt_PT,en_us"])).toEqual({
      ok: true,
      languages: ["de-DE", "pt-PT", "en-US"],
    });
  });

  test("deduplicates language selectors case-insensitively", () => {
    expect(parseV3SurveyLanguageQuery("de-DE,DE_de")).toEqual({
      ok: true,
      languages: ["de-DE"],
    });
  });

  test("rejects empty language selectors", () => {
    expect(parseV3SurveyLanguageQuery("de-DE,")).toEqual({
      ok: false,
      message: "Language selector must contain valid comma-separated locale codes",
    });
  });

  test("rejects invalid language selectors", () => {
    expect(parseV3SurveyLanguageQuery("not a locale")).toEqual({
      ok: false,
      message: "Language 'not a locale' is not a valid locale code",
    });
  });
});

describe("resolveV3SurveyLanguageCode", () => {
  test("matches configured languages case-insensitively and normalizes underscores", () => {
    expect(resolveV3SurveyLanguageCode("DE_de", languages)).toEqual({ ok: true, code: "de-DE" });
  });

  test("resolves language-only tags when exactly one configured language matches", () => {
    expect(resolveV3SurveyLanguageCode("de", languages)).toEqual({ ok: true, code: "de-DE" });
  });

  test("resolves disabled configured languages for management reads", () => {
    expect(resolveV3SurveyLanguageCode("fr", languages)).toEqual({ ok: true, code: "fr-FR" });
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

  test("resolves the implicit default language for surveys without configured languages", () => {
    expect(resolveV3SurveyLanguageCode("en", [{ code: "en-US", enabled: true }])).toEqual({
      ok: true,
      code: "en-US",
    });
  });
});
