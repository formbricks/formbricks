import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import {
  DEFAULT_SURVEY_LANGUAGE_CODE,
  SURVEY_RUNTIME_LANGUAGE_CODES,
  resolveSurveyLanguageDefaultTag,
} from "@formbricks/i18n-utils/survey-runtime-languages";
import arEGTranslations from "../../locales/ar-EG.json";
import bgBGTranslations from "../../locales/bg-BG.json";
import csCZTranslations from "../../locales/cs-CZ.json";
import daDKTranslations from "../../locales/da-DK.json";
import deDETranslations from "../../locales/de-DE.json";
import elGRTranslations from "../../locales/el-GR.json";
import enUSTranslations from "../../locales/en-US.json";
import esESTranslations from "../../locales/es-ES.json";
import etEETranslations from "../../locales/et-EE.json";
import fiFITranslations from "../../locales/fi-FI.json";
import frFRTranslations from "../../locales/fr-FR.json";
import hiINTranslations from "../../locales/hi-IN.json";
import hrHRTranslations from "../../locales/hr-HR.json";
import huHUTranslations from "../../locales/hu-HU.json";
import idIDTranslations from "../../locales/id-ID.json";
import itITTranslations from "../../locales/it-IT.json";
import jaJPTranslations from "../../locales/ja-JP.json";
import kmKHTranslations from "../../locales/km-KH.json";
import ltLTTranslations from "../../locales/lt-LT.json";
import lvLVTranslations from "../../locales/lv-LV.json";
import nbNOTranslations from "../../locales/nb-NO.json";
import neNPTranslations from "../../locales/ne-NP.json";
import nlNLTranslations from "../../locales/nl-NL.json";
import noNOTranslations from "../../locales/no-NO.json";
import plPLTranslations from "../../locales/pl-PL.json";
import ptBRTranslations from "../../locales/pt-BR.json";
import roROTranslations from "../../locales/ro-RO.json";
import ruRUTranslations from "../../locales/ru-RU.json";
import skSKTranslations from "../../locales/sk-SK.json";
import slSITranslations from "../../locales/sl-SI.json";
import svSETranslations from "../../locales/sv-SE.json";
import trTRTranslations from "../../locales/tr-TR.json";
import ukUATranslations from "../../locales/uk-UA.json";
import urPKTranslations from "../../locales/ur-PK.json";
import uzUZTranslations from "../../locales/uz-UZ.json";
import viVNTranslations from "../../locales/vi-VN.json";
import zhHansCNTranslations from "../../locales/zh-Hans-CN.json";
import zhHantTWTranslations from "../../locales/zh-Hant-TW.json";

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

    resources: {
      "ar-EG": { translation: arEGTranslations },
      "bg-BG": { translation: bgBGTranslations },
      "cs-CZ": { translation: csCZTranslations },
      "da-DK": { translation: daDKTranslations },
      "de-DE": { translation: deDETranslations },
      "el-GR": { translation: elGRTranslations },
      "en-US": { translation: enUSTranslations },
      "es-ES": { translation: esESTranslations },
      "et-EE": { translation: etEETranslations },
      "fi-FI": { translation: fiFITranslations },
      "fr-FR": { translation: frFRTranslations },
      "hi-IN": { translation: hiINTranslations },
      "hr-HR": { translation: hrHRTranslations },
      "hu-HU": { translation: huHUTranslations },
      "id-ID": { translation: idIDTranslations },
      "it-IT": { translation: itITTranslations },
      "ja-JP": { translation: jaJPTranslations },
      "km-KH": { translation: kmKHTranslations },
      "lt-LT": { translation: ltLTTranslations },
      "lv-LV": { translation: lvLVTranslations },
      "nb-NO": { translation: nbNOTranslations },
      "ne-NP": { translation: neNPTranslations },
      "nl-NL": { translation: nlNLTranslations },
      "no-NO": { translation: noNOTranslations },
      "pl-PL": { translation: plPLTranslations },
      "pt-BR": { translation: ptBRTranslations },
      "ro-RO": { translation: roROTranslations },
      "ru-RU": { translation: ruRUTranslations },
      "sk-SK": { translation: skSKTranslations },
      "sl-SI": { translation: slSITranslations },
      "sv-SE": { translation: svSETranslations },
      "tr-TR": { translation: trTRTranslations },
      "uk-UA": { translation: ukUATranslations },
      "ur-PK": { translation: urPKTranslations },
      "uz-UZ": { translation: uzUZTranslations },
      "vi-VN": { translation: viVNTranslations },
      "zh-Hans-CN": { translation: zhHansCNTranslations },
      "zh-Hant-TW": { translation: zhHantTWTranslations },
    },

    interpolation: { escapeValue: false },
  });

export default i18n;
