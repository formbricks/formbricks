import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/canonical";
import arEGTranslations from "../../locales/ar-EG.json";
import daDKTranslations from "../../locales/da-DK.json";
import deDETranslations from "../../locales/de-DE.json";
import enUSTranslations from "../../locales/en-US.json";
import esESTranslations from "../../locales/es-ES.json";
import etEETranslations from "../../locales/et-EE.json";
import frFRTranslations from "../../locales/fr-FR.json";
import hiINTranslations from "../../locales/hi-IN.json";
import huHUTranslations from "../../locales/hu-HU.json";
import idIDTranslations from "../../locales/id-ID.json";
import itITTranslations from "../../locales/it-IT.json";
import jaJPTranslations from "../../locales/ja-JP.json";
import nlNLTranslations from "../../locales/nl-NL.json";
import ptBRTranslations from "../../locales/pt-BR.json";
import roROTranslations from "../../locales/ro-RO.json";
import ruRUTranslations from "../../locales/ru-RU.json";
import svSETranslations from "../../locales/sv-SE.json";
import trTRTranslations from "../../locales/tr-TR.json";
import urPKTranslations from "../../locales/ur-PK.json";
import uzUZTranslations from "../../locales/uz-UZ.json";
import viVNTranslations from "../../locales/vi-VN.json";
import zhHansCNTranslations from "../../locales/zh-Hans-CN.json";
import zhHantTWTranslations from "../../locales/zh-Hant-TW.json";

/** The script subtag of a BCP-47 tag, or undefined when it has none (or can't be parsed). */
const scriptOf = (code: string | null): string | undefined => {
  if (!code) return undefined;
  try {
    return new Intl.Locale(code).script;
  } catch {
    return undefined;
  }
};

/**
 * Map any requested language tag to the bundle we actually ship, then English.
 *
 * Bundles are keyed by each language's canonical CLDR-default tag (`de-DE`, `ar-EG`, `zh-Hans-CN`). A
 * non-default or legacy variant resolves to its language's default bundle — `de-AT`/`de` → `de-DE`,
 * `ar-SA` → `ar-EG`, `pt-PT` → `pt-BR` — while SCRIPT is preserved: `zh-Hant`/`zh-TW` resolves to the
 * Traditional bundle `zh-Hant-TW`, NOT to the Simplified `zh-Hans-CN`.
 *
 * A legacy tag can carry its script only in the region (`zh-TW`, `zh-HK`), and `Intl.Locale` does not
 * infer the script, so we recover it from the tag's canonical form before dropping the region —
 * otherwise `zh-TW` would strip to a bare `zh` and borrow the Simplified bundle.
 */
export const resolveFallbackBundles = (code: string): string[] => {
  if (!code) return ["en-US"];
  try {
    const locale = new Intl.Locale(code);
    const canonicalScript = locale.script ?? scriptOf(normalizeLanguageCode(code));
    const languageWithScript = [locale.language, canonicalScript].filter(Boolean).join("-");
    const defaultBundle = normalizeLanguageCode(languageWithScript);
    return defaultBundle && defaultBundle !== code ? [defaultBundle, "en-US"] : ["en-US"];
  } catch {
    return ["en-US"];
  }
};

i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    fallbackLng: resolveFallbackBundles,
    supportedLngs: [
      "ar-EG",
      "da-DK",
      "de-DE",
      "en-US",
      "es-ES",
      "et-EE",
      "fr-FR",
      "hi-IN",
      "hu-HU",
      "id-ID",
      "it-IT",
      "ja-JP",
      "nl-NL",
      "pt-BR",
      "ro-RO",
      "ru-RU",
      "sv-SE",
      "tr-TR",
      "ur-PK",
      "uz-UZ",
      "vi-VN",
      "zh-Hans-CN",
      "zh-Hant-TW",
    ],

    resources: {
      "ar-EG": { translation: arEGTranslations },
      "da-DK": { translation: daDKTranslations },
      "de-DE": { translation: deDETranslations },
      "en-US": { translation: enUSTranslations },
      "es-ES": { translation: esESTranslations },
      "et-EE": { translation: etEETranslations },
      "fr-FR": { translation: frFRTranslations },
      "hi-IN": { translation: hiINTranslations },
      "hu-HU": { translation: huHUTranslations },
      "id-ID": { translation: idIDTranslations },
      "it-IT": { translation: itITTranslations },
      "ja-JP": { translation: jaJPTranslations },
      "nl-NL": { translation: nlNLTranslations },
      "pt-BR": { translation: ptBRTranslations },
      "ro-RO": { translation: roROTranslations },
      "ru-RU": { translation: ruRUTranslations },
      "sv-SE": { translation: svSETranslations },
      "tr-TR": { translation: trTRTranslations },
      "ur-PK": { translation: urPKTranslations },
      "uz-UZ": { translation: uzUZTranslations },
      "vi-VN": { translation: viVNTranslations },
      "zh-Hans-CN": { translation: zhHansCNTranslations },
      "zh-Hant-TW": { translation: zhHantTWTranslations },
    },

    interpolation: { escapeValue: false },
  });

export default i18n;
