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
    code: "en-US",
    label: {
      "en-US": "English (US)",
      "de-DE": "Englisch (US)",
      "pt-BR": "Inglês (EUA)",
      "fr-FR": "Anglais (États-Unis)",
      "zh-Hant-TW": "英文 (美國)",
      "pt-PT": "Inglês (EUA)",
      "ro-RO": "Engleză (SUA)",
      "ja-JP": "英語（米国）",
      "zh-Hans-CN": "英语（美国）",
      "nl-NL": "Engels (VS)",
      "es-ES": "Inglés (EE.UU.)",
      "sv-SE": "Engelska (USA)",
    },
  },
  {
    code: "de-DE",
    label: {
      "en-US": "German",
      "de-DE": "Deutsch",
      "pt-BR": "Alemão",
      "fr-FR": "Allemand",
      "zh-Hant-TW": "德語",
      "pt-PT": "Alemão",
      "ro-RO": "Germană",
      "ja-JP": "ドイツ語",
      "zh-Hans-CN": "德语",
      "nl-NL": "Duits",
      "es-ES": "Alemán",
      "sv-SE": "Tyska",
    },
  },
  {
    code: "pt-BR",
    label: {
      "en-US": "Portuguese (Brazil)",
      "de-DE": "Portugiesisch (Brasilien)",
      "pt-BR": "Português (Brasil)",
      "fr-FR": "Portugais (Brésil)",
      "zh-Hant-TW": "葡萄牙語 (巴西)",
      "pt-PT": "Português (Brasil)",
      "ro-RO": "Portugheză (Brazilia)",
      "ja-JP": "ポルトガル語（ブラジル）",
      "zh-Hans-CN": "葡萄牙语（巴西）",
      "nl-NL": "Portugees (Brazilië)",
      "es-ES": "Portugués (Brasil)",
      "sv-SE": "Portugisiska (Brasilien)",
    },
  },
  {
    code: "fr-FR",
    label: {
      "en-US": "French",
      "de-DE": "Französisch",
      "pt-BR": "Francês",
      "fr-FR": "Français",
      "zh-Hant-TW": "法語",
      "pt-PT": "Francês",
      "ro-RO": "Franceză",
      "ja-JP": "フランス語",
      "zh-Hans-CN": "法语",
      "nl-NL": "Frans",
      "es-ES": "Francés",
      "sv-SE": "Franska",
    },
  },
  {
    code: "zh-Hant-TW",
    label: {
      "en-US": "Chinese (Traditional)",
      "de-DE": "Chinesisch (Traditionell)",
      "pt-BR": "Chinês (Tradicional)",
      "fr-FR": "Chinois (Traditionnel)",
      "zh-Hant-TW": "繁體中文",
      "pt-PT": "Chinês (Tradicional)",
      "ro-RO": "Chineza (Tradițională)",
      "ja-JP": "中国語（繁体字）",
      "zh-Hans-CN": "繁体中文",
      "nl-NL": "Chinees (Traditioneel)",
      "es-ES": "Chino (Tradicional)",
      "sv-SE": "Kinesiska (traditionell)",
    },
  },
  {
    code: "pt-PT",
    label: {
      "en-US": "Portuguese (Portugal)",
      "de-DE": "Portugiesisch (Portugal)",
      "pt-BR": "Português (Portugal)",
      "fr-FR": "Portugais (Portugal)",
      "zh-Hant-TW": "葡萄牙語 (葡萄牙)",
      "pt-PT": "Português (Portugal)",
      "ro-RO": "Portugheză (Portugalia)",
      "ja-JP": "ポルトガル語（ポルトガル）",
      "zh-Hans-CN": "葡萄牙语（葡萄牙）",
      "nl-NL": "Portugees (Portugal)",
      "es-ES": "Portugués (Portugal)",
      "sv-SE": "Portugisiska (Portugal)",
    },
  },
  {
    code: "ro-RO",
    label: {
      "en-US": "Romanian",
      "de-DE": "Rumänisch",
      "pt-BR": "Romeno",
      "fr-FR": "Roumain",
      "zh-Hant-TW": "羅馬尼亞語",
      "pt-PT": "Romeno",
      "ro-RO": "Română",
      "ja-JP": "ルーマニア語",
      "zh-Hans-CN": "罗马尼亚语",
      "nl-NL": "Roemeens",
      "es-ES": "Rumano",
      "sv-SE": "Rumänska",
    },
  },
  {
    code: "ja-JP",
    label: {
      "en-US": "Japanese",
      "de-DE": "Japanisch",
      "pt-BR": "Japonês",
      "fr-FR": "Japonais",
      "zh-Hant-TW": "日語",
      "pt-PT": "Japonês",
      "ro-RO": "Japoneză",
      "ja-JP": "日本語",
      "zh-Hans-CN": "日语",
      "nl-NL": "Japans",
      "es-ES": "Japonés",
      "sv-SE": "Japanska",
    },
  },
  {
    code: "zh-Hans-CN",
    label: {
      "en-US": "Chinese (Simplified)",
      "de-DE": "Chinesisch (Vereinfacht)",
      "pt-BR": "Chinês (Simplificado)",
      "fr-FR": "Chinois (Simplifié)",
      "zh-Hant-TW": "簡體中文",
      "pt-PT": "Chinês (Simplificado)",
      "ro-RO": "Chineza (Simplificată)",
      "ja-JP": "中国語（簡体字）",
      "zh-Hans-CN": "简体中文",
      "nl-NL": "Chinees (Vereenvoudigd)",
      "es-ES": "Chino (Simplificado)",
      "sv-SE": "Kinesiska (förenklad)",
    },
  },
  {
    code: "nl-NL",
    label: {
      "en-US": "Dutch",
      "de-DE": "Niederländisch",
      "pt-BR": "Holandês",
      "fr-FR": "Néerlandais",
      "zh-Hant-TW": "荷蘭語",
      "pt-PT": "Holandês",
      "ro-RO": "Olandeza",
      "ja-JP": "オランダ語",
      "zh-Hans-CN": "荷兰语",
      "nl-NL": "Nederlands",
      "es-ES": "Neerlandés",
      "sv-SE": "Nederländska",
    },
  },
  {
    code: "es-ES",
    label: {
      "en-US": "Spanish",
      "de-DE": "Spanisch",
      "pt-BR": "Espanhol",
      "fr-FR": "Espagnol",
      "zh-Hant-TW": "西班牙語",
      "pt-PT": "Espanhol",
      "ro-RO": "Spaniol",
      "ja-JP": "スペイン語",
      "zh-Hans-CN": "西班牙语",
      "nl-NL": "Spaans",
      "es-ES": "Español",
      "sv-SE": "Spanska",
    },
  },
  {
    code: "sv-SE",
    label: {
      "en-US": "Swedish",
      "de-DE": "Schwedisch",
      "pt-BR": "Sueco",
      "fr-FR": "Suédois",
      "zh-Hant-TW": "瑞典語",
      "pt-PT": "Sueco",
      "ro-RO": "Suedeză",
      "ja-JP": "スウェーデン語",
      "zh-Hans-CN": "瑞典语",
      "nl-NL": "Zweeds",
      "es-ES": "Sueco",
      "sv-SE": "Svenska",
    },
  },
];
export { iso639Languages };
