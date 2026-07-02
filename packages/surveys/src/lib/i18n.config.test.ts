import { describe, expect, test } from "vitest";
import { resolveFallbackBundles } from "./i18n.config";

// Locks down the locale-to-bundle fallback contract (ENG-1067). Bundles are keyed by each language's
// canonical CLDR-default tag (`de-DE`, `pt-BR`, `zh-Hans-CN`); resolveFallbackBundles maps any requested
// tag to the bundle we actually ship, then English. SCRIPT is preserved (so Traditional Chinese never
// borrows the Simplified bundle); region is not. The list it returns is what i18next tries *after* the
// requested tag itself, so a request that already equals its default bundle just yields ["en-US"].
describe("resolveFallbackBundles", () => {
  test("a non-default region resolves to its language's default bundle", () => {
    expect(resolveFallbackBundles("de-AT")).toEqual(["de-DE", "en-US"]);
    expect(resolveFallbackBundles("pt-PT")).toEqual(["pt-BR", "en-US"]);
    expect(resolveFallbackBundles("ar-SA")).toEqual(["ar-EG", "en-US"]);
  });

  test("a bare language resolves to its canonical default bundle", () => {
    expect(resolveFallbackBundles("de")).toEqual(["de-DE", "en-US"]);
  });

  test("case is normalized (BCP-47 is case-insensitive)", () => {
    expect(resolveFallbackBundles("DE-de")).toEqual(["de-DE", "en-US"]);
  });

  test("the canonical default tag itself only falls back to English", () => {
    expect(resolveFallbackBundles("de-DE")).toEqual(["en-US"]);
  });

  test("script is preserved: Traditional Chinese never borrows the Simplified bundle", () => {
    // zh-Hant-TW carries an explicit Hant script -> resolves to the (unshipped) Traditional default,
    // which equals the requested tag, so it falls straight through to English. Crucially NOT zh-Hans-CN.
    expect(resolveFallbackBundles("zh-Hant-TW")).toEqual(["en-US"]);
    expect(resolveFallbackBundles("zh-Hant-TW")).not.toContain("zh-Hans-CN");
    // zh-Hant without a region resolves to the Traditional default tag (also unshipped -> en-US at runtime).
    expect(resolveFallbackBundles("zh-Hant")).toEqual(["zh-Hant-TW", "en-US"]);
  });

  test("an unknown but syntactically valid tag falls back to English", () => {
    expect(resolveFallbackBundles("xx")).toEqual(["en-US"]);
  });

  test("invalid or empty tags fall back to English", () => {
    expect(resolveFallbackBundles("")).toEqual(["en-US"]);
    expect(resolveFallbackBundles("123")).toEqual(["en-US"]);
    expect(resolveFallbackBundles("!!!")).toEqual(["en-US"]);
    // Underscore is not a valid BCP-47 separator -> Intl.Locale throws -> English (NOT de-DE).
    expect(resolveFallbackBundles("DE_de")).toEqual(["en-US"]);
  });
});
