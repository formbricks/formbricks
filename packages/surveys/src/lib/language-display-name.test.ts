import { describe, expect, test } from "vitest";
import { getLanguageDisplayName, getShortLanguageDisplayName } from "./language-display-name";

describe("getLanguageDisplayName", () => {
  test("returns native name for common language codes", () => {
    expect(getLanguageDisplayName("de")).toBe("Deutsch");
    expect(getLanguageDisplayName("fr")).toBe("Français");
    expect(getLanguageDisplayName("es")).toBe("Español");
    expect(getLanguageDisplayName("ja")).toBe("日本語");
    expect(getLanguageDisplayName("ko")).toBe("한국어");
    expect(getLanguageDisplayName("ar")).toBe("العربية");
    expect(getLanguageDisplayName("en")).toBe("English");
  });

  test("returns native name for regional variants", () => {
    expect(getLanguageDisplayName("pt-BR")).toBe("Português (Brasil)");
    expect(getLanguageDisplayName("de-AT")).toBe("Österreichisches Deutsch");
    expect(getLanguageDisplayName("fr-CA")).toBe("Français canadien");
    expect(getLanguageDisplayName("zh-Hans")).toBe("简体中文");
    expect(getLanguageDisplayName("zh-Hant")).toBe("繁體中文");
  });

  test("returns native name for less common codes", () => {
    expect(getLanguageDisplayName("aa")).toBe("Afar");
    expect(getLanguageDisplayName("is")).toBe("Íslenska");
    expect(getLanguageDisplayName("cy")).toBe("Cymraeg");
    expect(getLanguageDisplayName("eu")).toBe("Euskara");
    expect(getLanguageDisplayName("vo")).toBe("Volapük");
    expect(getLanguageDisplayName("bo")).toBe("བོད་སྐད་");
  });

  test("falls back to the bare/script native name for region-tagged canonical codes", () => {
    // no exact entry for these canonical codes → fall back to language(+script)
    expect(getLanguageDisplayName("hi-IN")).toBe("हिन्दी");
    expect(getLanguageDisplayName("zh-Hans-CN")).toBe("简体中文");
    expect(getLanguageDisplayName("da-DK")).toBe("Dansk");
  });

  test("returns raw code for unknown codes", () => {
    expect(getLanguageDisplayName("xx")).toBe("Xx");
    expect(getLanguageDisplayName("unknown")).toBe("Unknown");
  });

  test("returns empty string for empty input", () => {
    expect(getLanguageDisplayName("")).toBe("");
  });
});

describe("getShortLanguageDisplayName", () => {
  test("drops the region from a region-named code", () => {
    // The full names ("Deutsch (Deutschland)", "American English") do not fit a compact label.
    expect(getLanguageDisplayName("de-DE")).toBe("Deutsch (Deutschland)");
    expect(getShortLanguageDisplayName("de-DE")).toBe("Deutsch");
    expect(getShortLanguageDisplayName("en-US")).toBe("English");
    expect(getShortLanguageDisplayName("ar-EG")).toBe("العربية");
  });

  test("keeps the script, which is what tells the Chinese variants apart", () => {
    expect(getShortLanguageDisplayName("zh-Hans-CN")).toBe("简体中文");
    expect(getShortLanguageDisplayName("zh-Hant-TW")).toBe("繁體中文");
  });

  test("is a no-op for codes that carry no region", () => {
    expect(getShortLanguageDisplayName("de")).toBe("Deutsch");
    expect(getShortLanguageDisplayName("ja")).toBe("日本語");
  });

  test("keeps the full name when the bare language has no entry of its own", () => {
    // Shortening must not trade a known name for an echoed code.
    expect(getShortLanguageDisplayName("xx-YY")).toBe("Xx-YY");
  });

  test("falls back to the full-name behaviour for malformed and empty input", () => {
    expect(getShortLanguageDisplayName("")).toBe("");
    expect(getShortLanguageDisplayName("not a locale")).toBe("Not a locale");
  });
});
