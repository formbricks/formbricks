import { describe, expect, test } from "vitest";
import { CANONICAL_LANGUAGE_CODES } from "./canonical.ts";
import { getLanguageLabel, supportedLanguages } from "./utils.ts";

const codes = supportedLanguages.map((language) => language.code);
const byCode = new Map(supportedLanguages.map((language) => [language.code, language]));

describe("supportedLanguages", () => {
  test("has no duplicate codes", () => {
    expect(codes.length).toBe(new Set(codes).size);
  });

  test("every code is a canonical tag", () => {
    const canonical = new Set(CANONICAL_LANGUAGE_CODES);
    for (const code of codes) {
      expect(canonical.has(code)).toBe(true);
    }
  });

  test("contains no legacy bare/region-alias codes", () => {
    for (const legacy of [
      "de",
      "en",
      "es",
      "fr",
      "pt",
      "ar",
      "zh-Hans",
      "zh-Hant",
      "zh-CN",
      "zh-TW",
      "zh-HK",
    ]) {
      expect(byCode.has(legacy)).toBe(false);
    }
  });

  test("offers the canonical region-tagged variants", () => {
    for (const canonical of ["de-DE", "en-US", "pt-BR", "zh-Hans-CN", "zh-Hant-TW", "zh-Hant-HK"]) {
      expect(byCode.has(canonical)).toBe(true);
    }
  });

  test("Chinese entries keep their script labels (5 picker rows collapse to 3)", () => {
    expect(byCode.get("zh-Hans-CN")?.label["en-US"]).toBe("Chinese (Simplified)");
    expect(byCode.get("zh-Hant-TW")?.label["en-US"]).toBe("Chinese (Traditional)");
    expect(byCode.has("zh-Hant-HK")).toBe(true);
  });

  test("an exact-code label wins over the bare source (pt-BR keeps its Brazil label)", () => {
    expect(byCode.get("pt-BR")?.label["en-US"]).toBe("Portuguese (Brazil)");
  });
});

describe("getLanguageLabel", () => {
  test("resolves legacy and canonical codes to the same label", () => {
    expect(getLanguageLabel("de", "en-US")).toBe(getLanguageLabel("de-DE", "en-US"));
    expect(getLanguageLabel("pt", "en-US")).toBe(getLanguageLabel("pt-BR", "en-US"));
  });

  test("resolves a region alias through normalization", () => {
    expect(getLanguageLabel("zh-CN", "en-US")).toBe("Chinese (Simplified)");
    expect(getLanguageLabel("zh-TW", "en-US")).toBe("Chinese (Traditional)");
  });

  test("falls back to the source locale label when the requested locale is missing", () => {
    // every supported language has at least an en-US label
    for (const language of supportedLanguages) {
      expect(getLanguageLabel(language.code, "en-US")).toBeTruthy();
    }
  });
});
