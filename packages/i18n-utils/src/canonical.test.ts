import { describe, expect, test } from "vitest";
import { CANONICAL_LANGUAGE_CODES, LANGUAGE_CANONICAL_MAP, normalizeLanguageCode } from "./canonical.ts";

describe("normalizeLanguageCode", () => {
  test("maps bare language codes to their CLDR default region", () => {
    expect(normalizeLanguageCode("de")).toBe("de-DE");
    expect(normalizeLanguageCode("fr")).toBe("fr-FR");
    expect(normalizeLanguageCode("en")).toBe("en-US");
    expect(normalizeLanguageCode("pt")).toBe("pt-BR");
    expect(normalizeLanguageCode("ar")).toBe("ar-EG");
  });

  test("leaves already-canonical tags unchanged", () => {
    expect(normalizeLanguageCode("en-US")).toBe("en-US");
    expect(normalizeLanguageCode("pt-BR")).toBe("pt-BR");
    expect(normalizeLanguageCode("pt-PT")).toBe("pt-PT");
    expect(normalizeLanguageCode("de-AT")).toBe("de-AT");
  });

  test("keeps the script subtag for Chinese and resolves region", () => {
    expect(normalizeLanguageCode("zh-Hans")).toBe("zh-Hans-CN");
    expect(normalizeLanguageCode("zh-Hant")).toBe("zh-Hant-TW");
    expect(normalizeLanguageCode("zh-CN")).toBe("zh-Hans-CN");
    expect(normalizeLanguageCode("zh-TW")).toBe("zh-Hant-TW");
    expect(normalizeLanguageCode("zh-HK")).toBe("zh-Hant-HK");
  });

  test("dedup pairs resolve to the same canonical tag", () => {
    expect(normalizeLanguageCode("zh-CN")).toBe(normalizeLanguageCode("zh-Hans"));
    expect(normalizeLanguageCode("zh-TW")).toBe(normalizeLanguageCode("zh-Hant"));
    expect(normalizeLanguageCode("tw")).toBe(normalizeLanguageCode("ak"));
  });

  test("tolerates mixed case and underscore separators", () => {
    expect(normalizeLanguageCode("en-us")).toBe("en-US");
    expect(normalizeLanguageCode("PT_br")).toBe("pt-BR");
    expect(normalizeLanguageCode("  de  ")).toBe("de-DE");
  });

  test("remaps aliases regardless of input casing", () => {
    // Alias remaps (tl->fil, tw->ak) must hold even when the input casing misses the static map and
    // resolution falls through to CLDR.
    expect(normalizeLanguageCode("tl")).toBe("fil-PH");
    expect(normalizeLanguageCode("TL")).toBe("fil-PH");
    expect(normalizeLanguageCode("Tl")).toBe("fil-PH");
    expect(normalizeLanguageCode("tw")).toBe("ak-GH");
    expect(normalizeLanguageCode("TW")).toBe("ak-GH");
  });

  test("falls back to CLDR for codes outside the static map", () => {
    // not in the catalog/prod map, but resolvable via likely-subtags
    expect(normalizeLanguageCode("nso")).toBe("nso-ZA");
  });

  test("returns null for empty or unparseable input", () => {
    expect(normalizeLanguageCode("")).toBeNull();
    expect(normalizeLanguageCode("   ")).toBeNull();
    expect(normalizeLanguageCode(null)).toBeNull();
    expect(normalizeLanguageCode(undefined)).toBeNull();
    expect(normalizeLanguageCode("not a language")).toBeNull();
  });
});

describe("LANGUAGE_CANONICAL_MAP / CANONICAL_LANGUAGE_CODES", () => {
  test("every mapped value is itself a canonical code", () => {
    const canonical = new Set(CANONICAL_LANGUAGE_CODES);
    for (const value of Object.values(LANGUAGE_CANONICAL_MAP)) {
      expect(canonical.has(value)).toBe(true);
    }
  });

  test("every canonical code maps to itself (idempotent)", () => {
    for (const code of CANONICAL_LANGUAGE_CODES) {
      expect(LANGUAGE_CANONICAL_MAP[code]).toBe(code);
      expect(normalizeLanguageCode(code)).toBe(code);
    }
  });

  test("the canonical list has no duplicates", () => {
    expect(CANONICAL_LANGUAGE_CODES.length).toBe(new Set(CANONICAL_LANGUAGE_CODES).size);
  });
});
