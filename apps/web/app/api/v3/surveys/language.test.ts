import { describe, expect, test } from "vitest";
import {
  normalizeV3SurveyLanguageTag,
  normalizeV3SurveyLocaleCode,
  normalizeV3SurveyWriteLanguageCode,
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
    ["zh_hans", "zh-Hans"],
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
});

describe("normalizeV3SurveyLocaleCode", () => {
  test.each([
    ["EN_us", "en-US"],
    ["zh_hans_cn", "zh-Hans-CN"],
    // 3-letter base and UN M.49 numeric region — canonical catalog codes the old 2-letter-only regex rejected.
    ["fil-PH", "fil-PH"],
    ["bho-IN", "bho-IN"],
    ["eo-001", "eo-001"],
  ])("normalizes write locale %s to %s", (input, expected) => {
    expect(normalizeV3SurveyLocaleCode(input)).toBe(expected);
  });

  test.each(["de", "zh_Hans", "not a locale"])("rejects non-region-qualified write locale %s", (input) => {
    expect(normalizeV3SurveyLocaleCode(input)).toBeNull();
  });
});

describe("normalizeV3SurveyWriteLanguageCode", () => {
  test("keeps strict write locale validation by default", () => {
    expect(normalizeV3SurveyWriteLanguageCode("de-DE")).toBe("de-DE");
    expect(normalizeV3SurveyWriteLanguageCode("gu")).toBeNull();
  });

  test("allows legacy codes only when they are already configured", () => {
    expect(normalizeV3SurveyWriteLanguageCode("gu", ["gu", "en-US"])).toBe("gu");
    expect(normalizeV3SurveyWriteLanguageCode("GU", ["gu", "en-US"])).toBe("gu");
    expect(normalizeV3SurveyWriteLanguageCode("hi", ["hi-IN", "en-US"])).toBe("hi-IN");
    expect(normalizeV3SurveyWriteLanguageCode("vi", ["en-US"])).toBeNull();
  });

  test("maps a legacy code to its canonical configured tag (post-migration inbound)", () => {
    // After the migration flips a stored `gu` to `gu-IN`, a client still sending `gu` keeps working.
    expect(normalizeV3SurveyWriteLanguageCode("gu", ["gu-IN", "en-US"])).toBe("gu-IN");
    expect(normalizeV3SurveyWriteLanguageCode("GU", ["gu-IN", "en-US"])).toBe("gu-IN");
  });

  test("canonicalizes a script-incomplete locale on create (ENG-1067)", () => {
    // A new survey language given a region-only Chinese tag is stored script-complete/canonical.
    expect(normalizeV3SurveyWriteLanguageCode("zh-CN")).toBe("zh-Hans-CN");
    expect(normalizeV3SurveyWriteLanguageCode("zh-TW")).toBe("zh-Hant-TW");
  });

  test("preserves legitimate non-default regions on create", () => {
    expect(normalizeV3SurveyWriteLanguageCode("de-AT")).toBe("de-AT");
    expect(normalizeV3SurveyWriteLanguageCode("en-GB")).toBe("en-GB");
  });

  test("preserves a survey's stored legacy code on patch even when the canonical/script form is sent", () => {
    // Survey stores legacy zh-CN (content keyed by zh-CN); sending canonical zh-Hans-CN must still write
    // the stored zh-CN so the existing content keys are not orphaned.
    expect(normalizeV3SurveyWriteLanguageCode("zh-Hans-CN", ["zh-CN", "en-US"])).toBe("zh-CN");
    expect(normalizeV3SurveyWriteLanguageCode("zh-CN", ["zh-CN", "en-US"])).toBe("zh-CN");
  });

  test("writes the canonical stored code on patch when the survey is already canonical", () => {
    expect(normalizeV3SurveyWriteLanguageCode("zh-CN", ["zh-Hans-CN", "en-US"])).toBe("zh-Hans-CN");
  });

  test("returns the survey's stored legacy code on match, not its canonical form (pre-migration)", () => {
    // `pt` and `hi` are in the curated map, so the identifier resolves to `pt-BR`/`hi-IN`. A survey that
    // still stores the bare code (not yet migrated) keys its content by `pt`/`hi`, so the write must
    // target the stored code as-is — rewriting it to the canonical tag would create a mismatched i18n key.
    expect(normalizeV3SurveyWriteLanguageCode("pt", ["pt", "en-US"])).toBe("pt");
    expect(normalizeV3SurveyWriteLanguageCode("PT", ["pt", "en-US"])).toBe("pt");
    expect(normalizeV3SurveyWriteLanguageCode("hi", ["hi", "en-US"])).toBe("hi");
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

  test("resolves legacy and canonical selectors to the canonical survey language", () => {
    // Post-migration the survey stores the canonical tag; a client sending the legacy bare code, the
    // canonical tag, or an underscore variant all resolve to the stored code.
    const languages = [{ code: "hi-IN", enabled: true, alias: null }];

    expect(resolveV3SurveyLanguageCode("hi", languages)).toEqual({ ok: true, code: "hi-IN" });
    expect(resolveV3SurveyLanguageCode("hi-IN", languages)).toEqual({ ok: true, code: "hi-IN" });
    expect(resolveV3SurveyLanguageCode("HI_in", languages)).toEqual({ ok: true, code: "hi-IN" });
  });

  test("resolves legacy/script Chinese selectors to a migrated canonical survey language (ENG-1067)", () => {
    // Survey stored zh-Hans-CN post-migration. A client still sending the legacy script/region tag must
    // keep resolving (was HTTP 400 before the canonical-equivalence fallback).
    const migrated = [{ code: "zh-Hans-CN", enabled: true }];
    expect(resolveV3SurveyLanguageCode("zh-Hans", migrated)).toEqual({ ok: true, code: "zh-Hans-CN" });
    expect(resolveV3SurveyLanguageCode("zh_Hans", migrated)).toEqual({ ok: true, code: "zh-Hans-CN" });
    expect(resolveV3SurveyLanguageCode("zh-CN", migrated)).toEqual({ ok: true, code: "zh-Hans-CN" });
    expect(resolveV3SurveyLanguageCode("zh-Hans-CN", migrated)).toEqual({ ok: true, code: "zh-Hans-CN" });
  });

  test("keeps Simplified and Traditional Chinese distinct through canonical equivalence", () => {
    const both = [
      { code: "zh-Hans-CN", enabled: true },
      { code: "zh-Hant-TW", enabled: true },
    ];
    expect(resolveV3SurveyLanguageCode("zh-CN", both)).toEqual({ ok: true, code: "zh-Hans-CN" });
    expect(resolveV3SurveyLanguageCode("zh-TW", both)).toEqual({ ok: true, code: "zh-Hant-TW" });
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

  test("an exact alias match wins over the bare-selector ambiguity heuristic", () => {
    // en-US carries the alias "en" and en-GB shares the base; the exact alias match must win, not 400.
    expect(
      resolveV3SurveyLanguageCode("en", [
        { code: "en-US", enabled: true, alias: "en" },
        { code: "en-GB", enabled: true },
      ])
    ).toEqual({ ok: true, code: "en-US" });
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
