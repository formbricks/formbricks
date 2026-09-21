import { readFileSync, readdirSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SURVEY_RUNTIME_LANGUAGE_CODES } from "@formbricks/i18n-utils/survey-runtime-languages";
import i18n, {
  hasLanguageLoaded,
  loadLanguage,
  resolveFallbackBundles,
  setLocaleBaseUrl,
} from "./i18n.config";

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
    // zh-Hant-TW carries an explicit Hant script -> resolves to the Traditional default, which equals the
    // requested tag, so it falls straight through to English. Crucially NOT zh-Hans-CN.
    expect(resolveFallbackBundles("zh-Hant-TW")).toEqual(["en-US"]);
    expect(resolveFallbackBundles("zh-Hant-TW")).not.toContain("zh-Hans-CN");
    // zh-Hant without a region resolves to the Traditional default tag, which is the shipped bundle.
    expect(resolveFallbackBundles("zh-Hant")).toEqual(["zh-Hant-TW", "en-US"]);
    // Legacy tags carry the script only in the region; recovering it keeps them off the Simplified bundle.
    expect(resolveFallbackBundles("zh-TW")).toEqual(["zh-Hant-TW", "en-US"]);
    expect(resolveFallbackBundles("zh-HK")).toEqual(["zh-Hant-TW", "en-US"]);
    // Simplified legacy tags still resolve to Simplified.
    expect(resolveFallbackBundles("zh-CN")).toEqual(["zh-Hans-CN", "en-US"]);
    expect(resolveFallbackBundles("zh")).toEqual(["zh-Hans-CN", "en-US"]);
  });

  test("recovering the script does not leak a script subtag into non-script languages", () => {
    // de-AT/pt-PT canonicalize to themselves (both are catalog tags), so no script is recovered and the
    // region is still dropped — a Latin-script tag like `de-Latn-DE` would miss every shipped bundle.
    expect(resolveFallbackBundles("de-AT")).toEqual(["de-DE", "en-US"]);
    expect(resolveFallbackBundles("pt-PT")).toEqual(["pt-BR", "en-US"]);
    expect(resolveFallbackBundles("ur-IN")).toEqual(["ur-PK", "en-US"]);
  });

  test("the newly shipped languages resolve to their own bundle", () => {
    expect(resolveFallbackBundles("id")).toEqual(["id-ID", "en-US"]);
    expect(resolveFallbackBundles("ur")).toEqual(["ur-PK", "en-US"]);
    expect(resolveFallbackBundles("vi")).toEqual(["vi-VN", "en-US"]);
    expect(resolveFallbackBundles("km")).toEqual(["km-KH", "en-US"]);
    expect(resolveFallbackBundles("ne")).toEqual(["ne-NP", "en-US"]);
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

describe("shipped bundles", () => {
  const localeFiles = readdirSync(new URL("../../locales/", import.meta.url))
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""));

  // Every language the runtime advertises must have a bundle that can actually be served — inlined for
  // English, fetchable from /js/locales for the rest. Advertising one with no bundle behind it is the
  // bug this guards (ENG-2068): the survey renders English chrome around translated questions.
  test("every supported language has a bundle on disk to serve", () => {
    const supported = (i18n.options.supportedLngs || []).filter((code: string) => code !== "cimode");
    expect([...supported].sort()).toEqual([...localeFiles].sort());
  });

  // The whole point of loading on demand: shipping a second bundle inside the widget puts that language
  // back on every respondent's download, whether they speak it or not.
  test("English is the only bundle compiled into the widget", () => {
    expect(Object.keys(i18n.options.resources ?? {})).toEqual(["en-US"]);
  });

  // SURVEY_RUNTIME_LANGUAGE_CODES is what the workspace default-survey-language picker offers
  // (ENG-2816). Offering a language whose bundle we do not ship is the bug that setting exists to
  // avoid, so the list has to be provably the shipped set — not a copy of it that can rot.
  test("the runtime language list matches the bundles on disk", () => {
    expect([...SURVEY_RUNTIME_LANGUAGE_CODES].sort()).toEqual([...localeFiles].sort());
  });

  test("survey strings resolve once a shipped bundle is loaded", () => {
    for (const code of ["id-ID", "km-KH", "ne-NP", "ur-PK", "vi-VN", "zh-Hant-TW"]) {
      const bundle = JSON.parse(
        readFileSync(new URL(`../../locales/${code}.json`, import.meta.url), "utf-8")
      ) as Record<string, unknown>;
      i18n.addResourceBundle(code, "translation", bundle);

      const required = i18n.getFixedT(code)("common.required");
      expect(required).not.toBe("common.required");
      expect(required).not.toBe(i18n.getFixedT("en-US")("common.required"));

      i18n.removeResourceBundle(code, "translation");
    }
  });
});

describe("loadLanguage", () => {
  const baseUrl = "https://app.formbricks.com/js/locales";
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setLocaleBaseUrl(baseUrl);
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ common: { next: "x" } }) });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const code of SURVEY_RUNTIME_LANGUAGE_CODES) i18n.removeResourceBundle(code, "translation");
  });

  const requestedUrls = (): string[] => fetchMock.mock.calls.map((call) => String(call[0]));

  // A survey language is stored un-canonicalized and most region variants ship no file of their own —
  // `de-AT` is served by `de-DE.json`, `en-GB` by the bundled English. Fetching the requested tag would
  // 404 on every one of them and silently fall back to English.
  test.each([
    ["de-AT", "de-DE"],
    ["de-LU", "de-DE"],
    ["fr-BE", "fr-FR"],
    ["it-CH", "it-IT"],
    ["nl-BE", "nl-NL"],
    ["pt-PT", "pt-BR"],
    ["zh-TW", "zh-Hant-TW"],
    ["de", "de-DE"],
  ])("%s is fetched from its language's bundle, %s", async (requested, bundle) => {
    await loadLanguage(requested);
    expect(requestedUrls()).toHaveLength(1);
    expect(requestedUrls()[0]).toContain(`${baseUrl}/${bundle}.json?v=`);
  });

  test("English and its variants never cost a request", async () => {
    await loadLanguage("en-US");
    await loadLanguage("en-GB");
    await loadLanguage("en-AU");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a language with no bundle at all never costs a request", async () => {
    await loadLanguage("fa-IR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("concurrent and repeat asks for one bundle share a single request", async () => {
    await Promise.all([loadLanguage("de-DE"), loadLanguage("de-AT"), loadLanguage("de")]);
    await loadLanguage("de-DE");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("a failed fetch leaves the survey renderable in English", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    await expect(loadLanguage("pl-PL")).resolves.toBeUndefined();
    expect(i18n.hasResourceBundle("pl-PL", "translation")).toBe(false);
    expect(i18n.getFixedT("pl-PL")("common.required")).toBe(i18n.getFixedT("en-US")("common.required"));
  });

  test("nothing is requested before the host app has said where the bundles live", async () => {
    setLocaleBaseUrl("");
    await loadLanguage("pl-PL");
    expect(fetchMock).not.toHaveBeenCalled();
    setLocaleBaseUrl(baseUrl);
  });
});

describe("hasLanguageLoaded", () => {
  test("is true for English without a fetch, false for an unfetched language", () => {
    expect(hasLanguageLoaded("en-US")).toBe(true);
    expect(hasLanguageLoaded("en-GB")).toBe(true);
    expect(hasLanguageLoaded("pl-PL")).toBe(false);
  });

  // The provider asks about the requested tag; the answer has to be about the bundle that serves it, or
  // a loaded `de-DE` would read as missing for `de-AT` and refetch on every render.
  test("answers for the bundle that serves the tag, not the tag", () => {
    i18n.addResourceBundle("de-DE", "translation", { common: { next: "Weiter" } });
    expect(hasLanguageLoaded("de-AT")).toBe(true);
    i18n.removeResourceBundle("de-DE", "translation");
    expect(hasLanguageLoaded("de-AT")).toBe(false);
  });
});
