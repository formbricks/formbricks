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

describe("parseV3SurveyLanguageQuery", () => {
  test("parses comma-separated language selectors", () => {
    expect(parseV3SurveyLanguageQuery("de-DE, pt_PT, EN_us, zh_hans_cn")).toEqual({
      ok: true,
      languages: ["de-DE", "pt-PT", "en-US", "zh-Hans-CN"],
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

  test("rejects language-only selectors", () => {
    expect(parseV3SurveyLanguageQuery("de")).toEqual({
      ok: false,
      message: "Language 'de' is not a valid locale code",
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

  test("returns unknown for languages not configured on the survey", () => {
    expect(resolveV3SurveyLanguageCode("ZH_hant_tw", languages)).toEqual({
      ok: false,
      reason: "unknown",
      normalizedCode: "zh-Hant-TW",
      message: "Language 'zh-Hant-TW' is not configured for this survey",
    });
  });

  test("rejects language-only tags for surveys with a matching configured language", () => {
    expect(resolveV3SurveyLanguageCode("de", languages)).toEqual({
      ok: false,
      reason: "invalid",
      message: "Language 'de' is not a valid locale code",
    });
  });

  test("resolves the implicit default locale for surveys without configured languages", () => {
    expect(resolveV3SurveyLanguageCode("en-US", [{ code: "en-US", enabled: true }])).toEqual({
      ok: true,
      code: "en-US",
    });
  });
});
