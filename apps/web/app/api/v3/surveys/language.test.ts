import { describe, expect, test } from "vitest";
import {
  normalizeV3SurveyLanguageIdentifier,
  normalizeV3SurveyLanguageTag,
  parseV3SurveyLanguageQuery,
  resolveV3SurveyLanguageCode,
} from "./language";

const languages = [
  { code: "en-US", enabled: true, alias: "english" },
  { code: "de-DE", enabled: true, alias: "de" },
  { code: "fr-FR", enabled: false },
];

describe("normalizeV3SurveyLanguageTag", () => {
  test.each([
    ["EN_us", "en-US"],
    ["en-us", "en-US"],
    ["zh_hans_cn", "zh-Hans-CN"],
    ["ZH-hant-tw", "zh-Hant-TW"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeV3SurveyLanguageTag(input)).toBe(expected);
  });

  test("returns null for invalid language tags", () => {
    expect(normalizeV3SurveyLanguageTag("not a locale")).toBeNull();
  });

  test("returns null for language-only tags", () => {
    expect(normalizeV3SurveyLanguageTag("de")).toBeNull();
  });

  test("returns null for script-only tags without a region", () => {
    expect(normalizeV3SurveyLanguageTag("zh_Hans")).toBeNull();
  });
});

describe("normalizeV3SurveyLanguageIdentifier", () => {
  test.each([
    ["hi", "hi-IN"],
    ["HI", "hi-IN"],
    ["de", "de-DE"],
    ["hi_in", "hi-IN"],
  ])("normalizes legacy identifier %s to %s", (input, expected) => {
    expect(normalizeV3SurveyLanguageIdentifier(input)).toBe(expected);
  });

  test("does not guess ambiguous legacy identifiers", () => {
    expect(normalizeV3SurveyLanguageIdentifier("pt")).toBeNull();
  });
});

describe("parseV3SurveyLanguageQuery", () => {
  test("parses comma-separated language selectors", () => {
    expect(parseV3SurveyLanguageQuery("de-DE, pt_PT, EN_us, zh_hans_cn, hi")).toEqual({
      ok: true,
      languages: ["de-DE", "pt_PT", "EN_us", "zh_hans_cn", "hi"],
    });
  });

  test("parses repeated language selectors", () => {
    expect(parseV3SurveyLanguageQuery(["de-DE", "pt_PT,en_us"])).toEqual({
      ok: true,
      languages: ["de-DE", "pt_PT", "en_us"],
    });
  });

  test("deduplicates equivalent canonical selectors case-insensitively", () => {
    expect(parseV3SurveyLanguageQuery("de-DE,DE_de,hi-IN,HI_in")).toEqual({
      ok: true,
      languages: ["de-DE", "hi-IN"],
    });
  });

  test("keeps language-only and qualified locale selectors as distinct entries", () => {
    expect(parseV3SurveyLanguageQuery("hi,hi-IN")).toEqual({
      ok: true,
      languages: ["hi", "hi-IN"],
    });
  });

  test("rejects empty language selectors", () => {
    expect(parseV3SurveyLanguageQuery("de-DE,")).toEqual({
      ok: false,
      message: "Language selector must contain valid comma-separated language selectors",
    });
  });

  test("keeps invalid-looking selectors for survey-aware alias resolution", () => {
    expect(parseV3SurveyLanguageQuery("not a locale")).toEqual({
      ok: true,
      languages: ["not a locale"],
    });
  });

  test("keeps language-only selectors for survey-aware compatibility resolution", () => {
    expect(parseV3SurveyLanguageQuery("de")).toEqual({
      ok: true,
      languages: ["de"],
    });
  });
});

describe("resolveV3SurveyLanguageCode", () => {
  test("matches configured languages case-insensitively and normalizes underscores", () => {
    expect(resolveV3SurveyLanguageCode("DE_de", languages)).toEqual({ ok: true, code: "de-DE" });
  });

  test("matches configured script-region languages case-insensitively and normalizes underscores", () => {
    expect(resolveV3SurveyLanguageCode("ZH_hans_cn", [{ code: "zh-Hans-CN", enabled: true }])).toEqual({
      ok: true,
      code: "zh-Hans-CN",
    });
  });

  test("resolves disabled configured languages for management reads", () => {
    expect(resolveV3SurveyLanguageCode("fr-FR", languages)).toEqual({ ok: true, code: "fr-FR" });
  });

  test("resolves legacy stored language codes and canonical selectors", () => {
    const legacyLanguages = [{ code: "hi", enabled: true, alias: null }];

    expect(resolveV3SurveyLanguageCode("hi", legacyLanguages)).toEqual({ ok: true, code: "hi-IN" });
    expect(resolveV3SurveyLanguageCode("hi-IN", legacyLanguages)).toEqual({ ok: true, code: "hi-IN" });
    expect(resolveV3SurveyLanguageCode("HI_in", legacyLanguages)).toEqual({ ok: true, code: "hi-IN" });
  });

  test("resolves configured language aliases", () => {
    expect(resolveV3SurveyLanguageCode("english", languages)).toEqual({ ok: true, code: "en-US" });
    expect(resolveV3SurveyLanguageCode("de", languages)).toEqual({ ok: true, code: "de-DE" });
  });

  test("rejects ambiguous language-only selectors", () => {
    expect(
      resolveV3SurveyLanguageCode("en", [
        { code: "en-US", enabled: true },
        { code: "en-GB", enabled: true },
      ])
    ).toEqual({
      ok: false,
      reason: "ambiguous",
      normalizedCode: "en",
      message: "Language 'en' is ambiguous for this survey. Matching languages: en-US, en-GB",
    });
  });

  test("reports the user's input rather than a guessed locale when unknown", () => {
    expect(resolveV3SurveyLanguageCode("en", [{ code: "de-DE", enabled: true }])).toEqual({
      ok: false,
      reason: "unknown",
      normalizedCode: "en",
      message: "Language 'en' is not configured for this survey",
    });
  });

  test("resolves language-only selectors to the only matching configured locale", () => {
    expect(resolveV3SurveyLanguageCode("pt", [{ code: "pt-BR", enabled: true }])).toEqual({
      ok: true,
      code: "pt-BR",
    });
  });

  test("does not fallback full locale selectors to a different configured region", () => {
    expect(resolveV3SurveyLanguageCode("en-GB", [{ code: "en-US", enabled: true }])).toEqual({
      ok: false,
      reason: "unknown",
      normalizedCode: "en-GB",
      message: "Language 'en-GB' is not configured for this survey",
    });
  });

  test("returns unknown for languages not configured on the survey", () => {
    expect(resolveV3SurveyLanguageCode("ZH_hant_tw", languages)).toEqual({
      ok: false,
      reason: "unknown",
      normalizedCode: "zh-Hant-TW",
      message: "Language 'zh-Hant-TW' is not configured for this survey",
    });
  });

  test("rejects selectors that are neither locale codes nor configured aliases", () => {
    expect(resolveV3SurveyLanguageCode("not a locale", languages)).toEqual({
      ok: false,
      reason: "invalid",
      message: "Language 'not a locale' is not a valid locale code or configured language alias",
    });
  });

  test("resolves the implicit default locale for surveys without configured languages", () => {
    expect(resolveV3SurveyLanguageCode("en-US", [{ code: "en-US", enabled: true }])).toEqual({
      ok: true,
      code: "en-US",
    });
  });
});
