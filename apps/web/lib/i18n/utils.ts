import { iso639Languages } from "@formbricks/i18n-utils/src/utils";
import { TI18nString } from "@formbricks/types/i18n";
import { TLanguage } from "@formbricks/types/project";
import { TSurveyLanguage } from "@formbricks/types/surveys/types";
import { structuredClone } from "@/lib/pollyfills/structuredClone";

// Helper function to create an i18nString from a regular string.
export const createI18nString = (
  text: string | TI18nString,
  languages: string[],
  targetLanguageCode?: string
): TI18nString => {
  if (typeof text === "object") {
    // It's already an i18n object, so clone it
    const i18nString: TI18nString = structuredClone(text);
    // Add new language keys with empty strings if they don't exist
    languages?.forEach((language) => {
      if (!(language in i18nString)) {
        i18nString[language] = "";
      }
    });

    // Remove language keys that are not in the languages array
    Object.keys(i18nString).forEach((key) => {
      if (key !== (targetLanguageCode ?? "default") && languages && !languages.includes(key)) {
        delete i18nString[key];
      }
    });

    return i18nString;
  } else {
    // It's a regular string, so create a new i18n object
    const i18nString = {
      [targetLanguageCode ?? "default"]: text,
    };

    // Initialize all provided languages with empty strings
    languages?.forEach((language) => {
      if (language !== (targetLanguageCode ?? "default")) {
        i18nString[language] = "";
      }
    });

    return i18nString;
  }
};

// Type guard to check if an object is an I18nString
export const isI18nObject = (obj: unknown): obj is TI18nString => {
  return typeof obj === "object" && obj !== null && Object.keys(obj).includes("default");
};

export const isLabelValidForAllLanguages = (label: TI18nString, languages: string[]): boolean => {
  return languages.every((language) => label[language] && label[language].trim() !== "");
};

export const getLocalizedValue = (value: TI18nString | undefined, languageId: string): string => {
  if (!value) {
    return "";
  }
  if (isI18nObject(value)) {
    if (value[languageId]) {
      return value[languageId];
    }
    return "";
  }
  return "";
};

export const extractLanguageCodes = (surveyLanguages: TSurveyLanguage[]): string[] => {
  if (!surveyLanguages) return [];
  return surveyLanguages.map((surveyLanguage) =>
    surveyLanguage.default ? "default" : surveyLanguage.language.code
  );
};

export const getEnabledLanguages = (surveyLanguages: TSurveyLanguage[]) => {
  return surveyLanguages.filter((surveyLanguage) => surveyLanguage.enabled);
};

export const extractLanguageIds = (languages: TLanguage[]): string[] => {
  return languages.map((language) => language.code);
};

export const getLanguageCode = (surveyLanguages: TSurveyLanguage[], languageCode: string | null) => {
  if (!surveyLanguages?.length || !languageCode) return "default";
  const language = surveyLanguages.find((surveyLanguage) => surveyLanguage.language.code === languageCode);
  return language?.default ? "default" : language?.language.code || "default";
};

export const iso639Identifiers = iso639Languages.map((language) => language.alpha2);

// Helper function to add language keys to a multi-language object (e.g. survey or question)
// Iterates over the object recursively and adds empty strings for new language keys
export const addMultiLanguageLabels = (object: unknown, languageSymbols: string[]): any => {
  // Helper function to add language keys to a multi-language object
  function addLanguageKeys(obj: { default: string; [key: string]: string }) {
    languageSymbols.forEach((lang) => {
      if (!obj.hasOwnProperty(lang)) {
        obj[lang] = ""; // Add empty string for new language keys
      }
    });
  }

  // Recursive function to process an object or array
  function processObject(obj: unknown) {
    if (Array.isArray(obj)) {
      obj.forEach((item) => processObject(item));
    } else if (obj && typeof obj === "object") {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (key === "default" && typeof obj[key] === "string") {
            addLanguageKeys(obj as { default: string; [key: string]: string });
          } else {
            processObject(obj[key]);
          }
        }
      }
    }
  }

  // Start processing the question object
  processObject(object);

  return object;
};

export const appLanguages = [
  {
    code: "de-DE",
    label: {
      "de-DE": "Deutsch",
      "en-US": "German",
      "es-ES": "Alemán",
      "fr-FR": "Allemand",
      "hu-HU": "Német",
      "ja-JP": "ドイツ語",
      "nl-NL": "Duits",
      "pt-BR": "Alemão",
      "pt-PT": "Alemão",
      "ro-RO": "Germană",
      "sv-SE": "Tyska",
      "zh-Hans-CN": "德语",
      "zh-Hant-TW": "德語",
    },
  },
  {
    code: "en-US",
    label: {
      "de-DE": "Englisch (US)",
      "en-US": "English (US)",
      "es-ES": "Inglés (EE.UU.)",
      "fr-FR": "Anglais (États-Unis)",
      "hu-HU": "Angol (Egyesült Államok)",
      "ja-JP": "英語（米国）",
      "nl-NL": "Engels (VS)",
      "pt-BR": "Inglês (EUA)",
      "pt-PT": "Inglês (EUA)",
      "ro-RO": "Engleză (SUA)",
      "sv-SE": "Engelska (USA)",
      "zh-Hans-CN": "英语（美国）",
      "zh-Hant-TW": "英文 (美國)",
    },
  },
  {
    code: "es-ES",
    label: {
      "de-DE": "Spanisch",
      "en-US": "Spanish",
      "es-ES": "Español",
      "fr-FR": "Espagnol",
      "hu-HU": "Spanyol",
      "ja-JP": "スペイン語",
      "nl-NL": "Spaans",
      "pt-BR": "Espanhol",
      "pt-PT": "Espanhol",
      "ro-RO": "Spaniol",
      "sv-SE": "Spanska",
      "zh-Hans-CN": "西班牙语",
      "zh-Hant-TW": "西班牙語",
    },
  },
  {
    code: "fr-FR",
    label: {
      "de-DE": "Französisch",
      "en-US": "French",
      "es-ES": "Francés",
      "fr-FR": "Français",
      "hu-HU": "Francia",
      "ja-JP": "フランス語",
      "nl-NL": "Frans",
      "pt-BR": "Francês",
      "pt-PT": "Francês",
      "ro-RO": "Franceză",
      "sv-SE": "Franska",
      "zh-Hans-CN": "法语",
      "zh-Hant-TW": "法語",
    },
  },
  {
    code: "hu-HU",
    label: {
      "de-DE": "Ungarisch",
      "en-US": "Hungarian",
      "es-ES": "Húngaro",
      "fr-FR": "Hongrois",
      "hu-HU": "Magyar",
      "ja-JP": "ハンガリー語",
      "nl-NL": "Hongaars",
      "pt-BR": "Húngaro",
      "pt-PT": "Húngaro",
      "ro-RO": "Maghiară",
      "sv-SE": "Ungerska",
      "zh-Hans-CN": "匈牙利",
      "zh-Hant-TW": "匈牙利",
    },
  },
  {
    code: "ja-JP",
    label: {
      "de-DE": "Japanisch",
      "en-US": "Japanese",
      "es-ES": "Japonés",
      "fr-FR": "Japonais",
      "hu-HU": "Japán",
      "ja-JP": "日本語",
      "nl-NL": "Japans",
      "pt-BR": "Japonês",
      "pt-PT": "Japonês",
      "ro-RO": "Japoneză",
      "sv-SE": "Japanska",
      "zh-Hans-CN": "日语",
      "zh-Hant-TW": "日語",
    },
  },
  {
    code: "nl-NL",
    label: {
      "de-DE": "Niederländisch",
      "en-US": "Dutch",
      "es-ES": "Neerlandés",
      "fr-FR": "Néerlandais",
      "hu-HU": "Holland",
      "ja-JP": "オランダ語",
      "nl-NL": "Nederlands",
      "pt-BR": "Holandês",
      "pt-PT": "Holandês",
      "ro-RO": "Olandeza",
      "sv-SE": "Nederländska",
      "zh-Hans-CN": "荷兰语",
      "zh-Hant-TW": "荷蘭語",
    },
  },
  {
    code: "pt-BR",
    label: {
      "de-DE": "Portugiesisch (Brasilien)",
      "en-US": "Portuguese (Brazil)",
      "es-ES": "Portugués (Brasil)",
      "fr-FR": "Portugais (Brésil)",
      "hu-HU": "Portugál (Brazília)",
      "ja-JP": "ポルトガル語（ブラジル）",
      "nl-NL": "Portugees (Brazilië)",
      "pt-BR": "Português (Brasil)",
      "pt-PT": "Português (Brasil)",
      "ro-RO": "Portugheză (Brazilia)",
      "sv-SE": "Portugisiska (Brasilien)",
      "zh-Hans-CN": "葡萄牙语（巴西）",
      "zh-Hant-TW": "葡萄牙語 (巴西)",
    },
  },
  {
    code: "pt-PT",
    label: {
      "de-DE": "Portugiesisch (Portugal)",
      "en-US": "Portuguese (Portugal)",
      "es-ES": "Portugués (Portugal)",
      "fr-FR": "Portugais (Portugal)",
      "hu-HU": "Portugál (Portugália)",
      "ja-JP": "ポルトガル語（ポルトガル）",
      "nl-NL": "Portugees (Portugal)",
      "pt-BR": "Português (Portugal)",
      "pt-PT": "Português (Portugal)",
      "ro-RO": "Portugheză (Portugalia)",
      "sv-SE": "Portugisiska (Portugal)",
      "zh-Hans-CN": "葡萄牙语（葡萄牙）",
      "zh-Hant-TW": "葡萄牙語 (葡萄牙)",
    },
  },
  {
    code: "ro-RO",
    label: {
      "de-DE": "Rumänisch",
      "en-US": "Romanian",
      "es-ES": "Rumano",
      "fr-FR": "Roumain",
      "hu-HU": "Román",
      "ja-JP": "ルーマニア語",
      "nl-NL": "Roemeens",
      "pt-BR": "Romeno",
      "pt-PT": "Romeno",
      "ro-RO": "Română",
      "sv-SE": "Rumänska",
      "zh-Hans-CN": "罗马尼亚语",
      "zh-Hant-TW": "羅馬尼亞語",
    },
  },
  {
    code: "sv-SE",
    label: {
      "de-DE": "Schwedisch",
      "en-US": "Swedish",
      "es-ES": "Sueco",
      "fr-FR": "Suédois",
      "hu-HU": "Svéd",
      "ja-JP": "スウェーデン語",
      "nl-NL": "Zweeds",
      "pt-BR": "Sueco",
      "pt-PT": "Sueco",
      "ro-RO": "Suedeză",
      "sv-SE": "Svenska",
      "zh-Hans-CN": "瑞典语",
      "zh-Hant-TW": "瑞典語",
    },
  },
  {
    code: "zh-Hans-CN",
    label: {
      "de-DE": "Chinesisch (Vereinfacht)",
      "en-US": "Chinese (Simplified)",
      "es-ES": "Chino (Simplificado)",
      "fr-FR": "Chinois (Simplifié)",
      "hu-HU": "Kínai (egyszerűsített)",
      "ja-JP": "中国語（簡体字）",
      "nl-NL": "Chinees (Vereenvoudigd)",
      "pt-BR": "Chinês (Simplificado)",
      "pt-PT": "Chinês (Simplificado)",
      "ro-RO": "Chineza (Simplificată)",
      "sv-SE": "Kinesiska (förenklad)",
      "zh-Hans-CN": "简体中文",
      "zh-Hant-TW": "簡體中文",
    },
  },
  {
    code: "zh-Hant-TW",
    label: {
      "de-DE": "Chinesisch (Traditionell)",
      "en-US": "Chinese (Traditional)",
      "es-ES": "Chino (Tradicional)",
      "fr-FR": "Chinois (Traditionnel)",
      "hu-HU": "Kínai (hagyományos)",
      "ja-JP": "中国語（繁体字）",
      "nl-NL": "Chinees (Traditioneel)",
      "pt-BR": "Chinês (Tradicional)",
      "pt-PT": "Chinês (Tradicional)",
      "ro-RO": "Chineza (Tradițională)",
      "sv-SE": "Kinesiska (traditionell)",
      "zh-Hans-CN": "繁体中文",
      "zh-Hant-TW": "繁體中文",
    },
  },
];
export { iso639Languages };
