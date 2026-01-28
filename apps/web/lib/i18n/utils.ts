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

export const iso639Identifiers = iso639Languages.map((language) => language.code);

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
      "en-US": "German",
    },
  },
  {
    code: "en-US",
    label: {
      "en-US": "English (US)",
    },
  },
  {
    code: "es-ES",
    label: {
      "en-US": "Spanish",
    },
  },
  {
    code: "fr-FR",
    label: {
      "en-US": "French",
    },
  },
  {
    code: "hu-HU",
    label: {
      "en-US": "Hungarian",
    },
  },
  {
    code: "ja-JP",
    label: {
      "en-US": "Japanese",
    },
  },
  {
    code: "nl-NL",
    label: {
      "en-US": "Dutch",
    },
  },
  {
    code: "pt-BR",
    label: {
      "en-US": "Portuguese (Brazil)",
    },
  },
  {
    code: "pt-PT",
    label: {
      "en-US": "Portuguese (Portugal)",
    },
  },
  {
    code: "ro-RO",
    label: {
      "en-US": "Romanian",
    },
  },
  {
    code: "ru-RU",
    label: {
      "en-US": "Russian",
    },
  },
  {
    code: "sv-SE",
    label: {
      "en-US": "Swedish",
    },
  },
  {
    code: "zh-Hans-CN",
    label: {
      "en-US": "Chinese (Simplified)",
    },
  },
  {
    code: "zh-Hant-TW",
    label: {
      "en-US": "Chinese (Traditional)",
    },
  },
];
