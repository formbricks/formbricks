import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import {
  DEFAULT_SURVEY_LANGUAGE_CODE,
  SURVEY_RUNTIME_LANGUAGE_CODES,
  resolveSurveyLanguageDefaultTag,
  resolveSurveyRuntimeBundle,
} from "@formbricks/i18n-utils/survey-runtime-languages";
import enUSTranslations from "../../locales/en-US.json";

/**
 * Map any requested language tag to the bundle we actually ship, then English.
 *
 * Bundles are keyed by each language's canonical CLDR-default tag (`de-DE`, `ar-EG`, `zh-Hans-CN`), and
 * `resolveSurveyLanguageDefaultTag` is what turns a requested tag into that key — `de-AT`/`de` -> `de-DE`,
 * `pt-PT` -> `pt-BR`, while preserving script so `zh-Hant`/`zh-TW` resolve to Traditional. It is shared
 * with the workspace default-language picker, which uses it to decide whether a language has strings at
 * all, so the two can never disagree about what this runtime serves.
 */
export const resolveFallbackBundles = (code: string): string[] => {
  const defaultBundle = resolveSurveyLanguageDefaultTag(code);
  return defaultBundle && defaultBundle !== code
    ? [defaultBundle, DEFAULT_SURVEY_LANGUAGE_CODE]
    : [DEFAULT_SURVEY_LANGUAGE_CODE];
};

i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    fallbackLng: resolveFallbackBundles,
    supportedLngs: [...SURVEY_RUNTIME_LANGUAGE_CODES],

    // English only. Every other bundle is fetched on demand by `loadLanguage` — all 38 inlined cost
    // 254 kB minified (21% of the gzipped widget) to serve one language per respondent. English stays
    // bundled because it is `fallbackLng`: a failed or skipped fetch then renders English strings
    // rather than raw translation keys.
    resources: {
      "en-US": { translation: enUSTranslations },
    },

    interpolation: { escapeValue: false },
  });

/**
 * Where `loadLanguage` fetches bundles from — `{appUrl}/js/locales`, set once from the host app's
 * `appUrl` before the first render (see `src/index.ts`).
 *
 * It has to be absolute rather than a relative `/js/locales`: the mobile SDKs load this renderer into
 * a WebView with a null base URL (`location.href` is `about:blank`, see `browser-context.ts`), where a
 * root-relative path resolves to nothing. Empty until set, and `loadLanguage` then no-ops into the
 * English fallback rather than firing a request at an unknown origin.
 */
let localeBaseUrl = "";

/**
 * Point the loader at a deployment, from the `appUrl` the host app renders with. Both production
 * callers pass one (the SDK from its config, the link survey from the public domain); the preview and
 * editor do not, and fall back to a path relative to the app's own origin, which is where they render.
 */
export const setLocaleBaseUrl = (appUrl: string | undefined): void => {
  localeBaseUrl = `${appUrl ?? ""}/js/locales`;
};

/**
 * Cache-busts the locale fetches against the bundle that asks for them.
 *
 * `/js/*` is served with `s-maxage=2592000` (30 days, see `apps/web/next.config.mjs`). While the
 * strings were compiled into the bundle the two could not disagree; fetched separately, a new bundle
 * can meet a month-old cached bundle and render English for any key added since. The token is a hash
 * of the locale sources, injected at build time, so the URL changes when — and only when — the strings
 * do.
 */
declare const __FB_LOCALES_HASH__: string;
const localesVersion = typeof __FB_LOCALES_HASH__ === "string" ? __FB_LOCALES_HASH__ : "dev";

/** In-flight fetches, keyed by bundle tag, so concurrent callers share one request. */
const pendingLoads = new Map<string, Promise<void>>();

/**
 * Ensure the strings for a language are in memory, fetching the bundle if this is the first ask.
 *
 * Resolves the requested tag to the bundle that actually serves it before doing anything, because a
 * survey language is stored un-canonicalized (`getI18nLanguage` returns the survey's own code) and
 * most region variants ship no file of their own: `de-AT`, `en-GB` and `pt-PT` are served by
 * `de-DE.json`, `en-US.json` and `pt-BR.json`. Fetching the requested tag instead would 404 on every
 * one of them and silently fall back to English.
 *
 * Resolves rather than rejects when a language has no bundle, the base URL is unset, or the request
 * fails — the caller renders, and i18next falls through to the bundled English strings.
 */
export const loadLanguage = async (code: string): Promise<void> => {
  const bundle = resolveSurveyRuntimeBundle(code);
  if (!bundle || bundle === DEFAULT_SURVEY_LANGUAGE_CODE) return;
  if (i18n.hasResourceBundle(bundle, "translation")) return;

  const pending = pendingLoads.get(bundle);
  if (pending) return pending;

  if (!localeBaseUrl) return;

  const load = (async () => {
    try {
      const response = await fetch(`${localeBaseUrl}/${bundle}.json?v=${localesVersion}`);
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      i18n.addResourceBundle(bundle, "translation", await response.json());
    } catch {
      // eslint-disable-next-line no-console -- the survey still renders; this is the only trace of why it is in English
      console.warn(`[formbricks] Could not load translations for "${bundle}". Falling back to English.`);
    } finally {
      pendingLoads.delete(bundle);
    }
  })();

  pendingLoads.set(bundle, load);
  return load;
};

/** Whether the strings for a language are already in memory — no fetch, no await. */
export const hasLanguageLoaded = (code: string): boolean => {
  const bundle = resolveSurveyRuntimeBundle(code);
  if (!bundle || bundle === DEFAULT_SURVEY_LANGUAGE_CODE) return true;
  return i18n.hasResourceBundle(bundle, "translation");
};

/**
 * The tag to hand `i18n.changeLanguage` for a survey language: the bundle `loadLanguage` fetched for it.
 *
 * Passing the requested tag lets i18next pick the bundle itself, and it takes the first `supportedLngs`
 * entry sharing the base language — so every Traditional Chinese tag (`zh-TW`, `zh-Hant-HK`) lands on
 * `zh-Hans-CN`, a bundle nobody fetched, and renders English. A tag with no bundle is passed through and
 * falls back to English as before.
 */
export const toI18nLanguage = (code: string): string => resolveSurveyRuntimeBundle(code) ?? code;

export default i18n;
