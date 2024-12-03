import { TLanguage } from "@formbricks/types/project";
import { TI18nString, TSurveyLanguage } from "@formbricks/types/surveys/types";
import { structuredClone } from "../pollyfills/structuredClone";

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
    const i18nString: any = {
      [targetLanguageCode ?? "default"]: text as string, // Type assertion to assure TypeScript `text` is a string
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
export const isI18nObject = (obj: any): obj is TI18nString => {
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

export interface TIso639Language {
  alpha2: string;
  label: {
    "en-US": string;
    "de-DE": string;
    "pt-BR": string;
  };
}

export const iso639Languages = [
  {
    alpha2: "aa",
    label: {
      "en-US": "Afar",
      "de-DE": "Afar",
      "pt-BR": "Afar",
    },
  },
  {
    alpha2: "ab",
    label: {
      "en-US": "Abkhazian",
      "de-DE": "Abchasisch",
      "pt-BR": "Abcásio",
    },
  },
  {
    alpha2: "ae",
    label: {
      "en-US": "Avestan",
      "de-DE": "Avestisch",
      "pt-BR": "Avestano",
    },
  },
  {
    alpha2: "af",
    label: {
      "en-US": "Afrikaans",
      "de-DE": "Afrikaans",
      "pt-BR": "Afrikâner",
    },
  },
  {
    alpha2: "ak",
    label: {
      "en-US": "Akan",
      "de-DE": "Akan",
      "pt-BR": "Akan",
    },
  },
  {
    alpha2: "am",
    label: {
      "en-US": "Amharic",
      "de-DE": "Amharisch",
      "pt-BR": "Amárico",
    },
  },
  {
    alpha2: "an",
    label: {
      "en-US": "Aragonese",
      "de-DE": "Aragonesisch",
      "pt-BR": "Aragonês",
    },
  },
  {
    alpha2: "ar",
    label: {
      "en-US": "Arabic",
      "de-DE": "Arabisch",
      "pt-BR": "Árabe",
    },
  },
  {
    alpha2: "as",
    label: {
      "en-US": "Assamese",
      "de-DE": "Assamesisch",
      "pt-BR": "Assamês",
    },
  },
  {
    alpha2: "av",
    label: {
      "en-US": "Avaric",
      "de-DE": "Avarisch",
      "pt-BR": "Avaric",
    },
  },
  {
    alpha2: "ay",
    label: {
      "en-US": "Aymara",
      "de-DE": "Aymara",
      "pt-BR": "Aymara",
    },
  },
  {
    alpha2: "az",
    label: {
      "en-US": "Azerbaijani",
      "de-DE": "Aserbaidschanisch",
      "pt-BR": "Azerbaijano",
    },
  },
  {
    alpha2: "ba",
    label: {
      "en-US": "Bashkir",
      "de-DE": "Baschkirisch",
      "pt-BR": "Basco",
    },
  },
  {
    alpha2: "be",
    label: {
      "en-US": "Belarusian",
      "de-DE": "Weißrussisch",
      "pt-BR": "Bielorrusso",
    },
  },
  {
    alpha2: "bg",
    label: {
      "en-US": "Bulgarian",
      "de-DE": "Bulgarisch",
      "pt-BR": "Búlgaro",
    },
  },
  {
    alpha2: "bh",
    label: {
      "en-US": "Bihari languages",
      "de-DE": "Biharische Sprachen",
      "pt-BR": "Bihari",
    },
  },
  {
    alpha2: "bi",
    label: {
      "en-US": "Bislama",
      "de-DE": "Bislama",
      "pt-BR": "Bislama",
    },
  },
  {
    alpha2: "bm",
    label: {
      "en-US": "Bambara",
      "de-DE": "Bambara",
      "pt-BR": "Bambara",
    },
  },
  {
    alpha2: "bn",
    label: {
      "en-US": "Bengali",
      "de-DE": "Bengali",
      "pt-BR": "Bengali",
    },
  },
  {
    alpha2: "bo",
    label: {
      "en-US": "Tibetan",
      "de-DE": "Tibetisch",
      "pt-BR": "Tibetano",
    },
  },
  {
    alpha2: "br",
    label: {
      "en-US": "Breton",
      "de-DE": "Bretonisch",
      "pt-BR": "Breton",
    },
  },
  {
    alpha2: "bs",
    label: {
      "en-US": "Bosnian",
      "de-DE": "Bosnisch",
      "pt-BR": "Bósnio",
    },
  },
  {
    alpha2: "ca",
    label: {
      "en-US": "Catalan; Valencian",
      "de-DE": "Katalanisch; Valencisch",
      "pt-BR": "Catalão; Valenciano",
    },
  },
  {
    alpha2: "ce",
    label: {
      "en-US": "Chechen",
      "de-DE": "Tschetschenisch",
      "pt-BR": "Checheno",
    },
  },
  {
    alpha2: "ch",
    label: {
      "en-US": "Chamorro",
      "de-DE": "Chamorro",
      "pt-BR": "Chamorro",
    },
  },
  {
    alpha2: "co",
    label: {
      "en-US": "Corsican",
      "de-DE": "Korsisch",
      "pt-BR": "Corsican",
    },
  },
  {
    alpha2: "cr",
    label: {
      "en-US": "Cree",
      "de-DE": "Cree",
      "pt-BR": "Cree",
    },
  },
  {
    alpha2: "cs",
    label: {
      "en-US": "Czech",
      "de-DE": "Tschechisch",
      "pt-BR": "Tcheco",
    },
  },
  {
    alpha2: "cu",
    label: {
      "en-US": "Church Slavic; Old Slavonic; Church Slavonic; Old Bulgarian; Old Church Slavonic",
      "de-DE": "Kirchenslawisch; Altbulgarisch; Kirchenslawisch; Altbulgarisch; Altkirchliches Slawisch",
      "pt-BR":
        "Slavônico eclesiástico; Antigo eslavônico; Sânscrito eclesiástico; Antigo búlgaro; Antigo sânscrito eclesiástico",
    },
  },
  {
    alpha2: "cv",
    label: {
      "en-US": "Chuvash",
      "de-DE": "Tschuwaschisch",
      "pt-BR": "Tchuvasco",
    },
  },
  {
    alpha2: "cy",
    label: {
      "en-US": "Welsh",
      "de-DE": "Walisisch",
      "pt-BR": "Galês",
    },
  },
  {
    alpha2: "da",
    label: {
      "en-US": "Danish",
      "de-DE": "Dänisch",
      "pt-BR": "Dinamarquês",
    },
  },
  {
    alpha2: "de",
    label: {
      "en-US": "German",
      "de-DE": "Deutsch",
      "pt-BR": "Alemão",
    },
  },
  {
    alpha2: "dv",
    label: {
      "en-US": "Divehi; Dhivehi; Maldivian",
      "de-DE": "Divehi; Dhivehi; Maldivisch",
      "pt-BR": "Divehi; Dhivehi; Maldiviano",
    },
  },
  {
    alpha2: "dz",
    label: {
      "en-US": "Dzongkha",
      "de-DE": "Dzongkha",
      "pt-BR": "Dzongkha",
    },
  },
  {
    alpha2: "ee",
    label: {
      "en-US": "Ewe",
      "de-DE": "Ewe",
      "pt-BR": "Ewe",
    },
  },
  {
    alpha2: "el",
    label: {
      "en-US": "Greek, Modern (1453-)",
      "de-DE": "Griechisch, Modern (ab 1453)",
      "pt-BR": "Grego moderno (1453-)",
    },
  },
  {
    alpha2: "en",
    label: {
      "en-US": "English",
      "de-DE": "Englisch",
      "pt-BR": "Inglês",
    },
  },
  {
    alpha2: "eo",
    label: {
      "en-US": "Esperanto",
      "de-DE": "Esperanto",
      "pt-BR": "Esperanto",
    },
  },
  {
    alpha2: "es",
    label: {
      "en-US": "Spanish; Castilian",
      "de-DE": "Spanisch; Kastilisch",
      "pt-BR": "Espanhol; Castelao",
    },
  },
  {
    alpha2: "et",
    label: {
      "en-US": "Estonian",
      "de-DE": "Estnisch",
      "pt-BR": "Estoniano",
    },
  },
  {
    alpha2: "eu",
    label: {
      "en-US": "Basque",
      "de-DE": "Baskisch",
      "pt-BR": "Basco",
    },
  },
  {
    alpha2: "fa",
    label: {
      "en-US": "Persian",
      "de-DE": "Persisch",
      "pt-BR": "Persa",
    },
  },
  {
    alpha2: "ff",
    label: {
      "en-US": "Fulah",
      "de-DE": "Fulah",
      "pt-BR": "Fulah",
    },
  },
  {
    alpha2: "fi",
    label: {
      "en-US": "Finnish",
      "de-DE": "Finnisch",
      "pt-BR": "Finlandês",
    },
  },
  {
    alpha2: "fj",
    label: {
      "en-US": "Fijian",
      "de-DE": "Fidschianisch",
      "pt-BR": "Fijiano",
    },
  },
  {
    alpha2: "fo",
    label: {
      "en-US": "Faroese",
      "de-DE": "Färöisch",
      "pt-BR": "Feroês",
    },
  },
  {
    alpha2: "fr",
    label: {
      "en-US": "French",
      "de-DE": "Französisch",
      "pt-BR": "Francês",
    },
  },
  {
    alpha2: "fy",
    label: {
      "en-US": "Western Frisian",
      "de-DE": "Westfriesisch",
      "pt-BR": "Frísio ocidental",
    },
  },
  {
    alpha2: "ga",
    label: {
      "en-US": "Irish",
      "de-DE": "Irischer",
      "pt-BR": "Irlandês",
    },
  },
  {
    alpha2: "gd",
    label: {
      "en-US": "Gaelic; Scottish Gaelic",
      "de-DE": "Gälisch; Schottisch Gälisch",
      "pt-BR": "Gaelico escocês; Gaélico escocês",
    },
  },
  {
    alpha2: "gl",
    label: {
      "en-US": "Galician",
      "de-DE": "Galicisch",
      "pt-BR": "Galego",
    },
  },
  {
    alpha2: "gn",
    label: {
      "en-US": "Guarani",
      "de-DE": "Guarani",
      "pt-BR": "Guarani",
    },
  },
  {
    alpha2: "gu",
    label: {
      "en-US": "Gujarati",
      "de-DE": "Gujarati",
      "pt-BR": "Gujarati",
    },
  },
  {
    alpha2: "gv",
    label: {
      "en-US": "Manx",
      "de-DE": "Manx",
      "pt-BR": "Manx",
    },
  },
  {
    alpha2: "ha",
    label: {
      "en-US": "Hausa",
      "de-DE": "Hausa",
      "pt-BR": "Hausa",
    },
  },
  {
    alpha2: "he",
    label: {
      "en-US": "Hebrew",
      "de-DE": "Hebräisch",
      "pt-BR": "Hebraico",
    },
  },
  {
    alpha2: "hi",
    label: {
      "en-US": "Hindi",
      "de-DE": "Hindi",
      "pt-BR": "Hindi",
    },
  },
  {
    alpha2: "ho",
    label: {
      "en-US": "Hiri Motu",
      "de-DE": "Hiri Motu",
      "pt-BR": "Hiri Motu",
    },
  },
  {
    alpha2: "hr",
    label: {
      "en-US": "Croatian",
      "de-DE": "Kroatisch",
      "pt-BR": "Croata",
    },
  },
  {
    alpha2: "ht",
    label: {
      "en-US": "Haitian; Haitian Creole",
      "de-DE": "Haitian; Haitian Creole",
      "pt-BR": "Haitiano; Crioulo haitiano",
    },
  },
  {
    alpha2: "hu",
    label: {
      "en-US": "Hungarian",
      "de-DE": "Ungarisch",
      "pt-BR": "Húngaro",
    },
  },
  {
    alpha2: "hy",
    label: {
      "en-US": "Armenian",
      "de-DE": "Armenisch",
      "pt-BR": "Armênio",
    },
  },
  {
    alpha2: "hz",
    label: {
      "en-US": "Herero",
      "de-DE": "Herero",
      "pt-BR": "Herero",
    },
  },
  {
    alpha2: "ia",
    label: {
      "en-US": "Interlingua (International Auxiliary Language Association)",
      "de-DE": "Interlingua (Internationaler Hilfssprachverband)",
      "pt-BR": "Interlingua (Associação Internacional de Línguas Auxiliares)",
    },
  },
  {
    alpha2: "id",
    label: {
      "en-US": "Indonesian",
      "de-DE": "Indonesisch",
      "pt-BR": "Indonésio",
    },
  },
  {
    alpha2: "ie",
    label: {
      "en-US": "Interlingue; Occidental",
      "de-DE": "Interlingue; Occidental",
      "pt-BR": "Interlingue; Ocidental",
    },
  },
  {
    alpha2: "ig",
    label: {
      "en-US": "Igbo",
      "de-DE": "Igbo",
      "pt-BR": "Igbo",
    },
  },
  {
    alpha2: "ii",
    label: {
      "en-US": "Sichuan Yi; Nuosu",
      "de-DE": "Sichuan Yi; Nuosu",
      "pt-BR": "Sichuan Yi; Nuosu",
    },
  },
  {
    alpha2: "ik",
    label: {
      "en-US": "Inupiaq",
      "de-DE": "Inupiaq",
      "pt-BR": "Inupiaq",
    },
  },
  {
    alpha2: "io",
    label: {
      "en-US": "Ido",
      "de-DE": "Ido",
      "pt-BR": "Ido",
    },
  },
  {
    alpha2: "is",
    label: {
      "en-US": "Icelandic",
      "de-DE": "Isländisch",
      "pt-BR": "Islandês",
    },
  },
  {
    alpha2: "it",
    label: {
      "en-US": "Italian",
      "de-DE": "Italienisch",
      "pt-BR": "Italiano",
    },
  },
  {
    alpha2: "iu",
    label: {
      "en-US": "Inuktitut",
      "de-DE": "Inuktitut",
      "pt-BR": "Inuktitut",
    },
  },
  {
    alpha2: "ja",
    label: {
      "en-US": "Japanese",
      "de-DE": "Japanisch",
      "pt-BR": "Japonês",
    },
  },
  {
    alpha2: "jv",
    label: {
      "en-US": "Javanese",
      "de-DE": "Javanisch",
      "pt-BR": "Javonês",
    },
  },
  {
    alpha2: "ka",
    label: {
      "en-US": "Georgian",
      "de-DE": "Georgisch",
      "pt-BR": "Georgiano",
    },
  },
  {
    alpha2: "kg",
    label: {
      "en-US": "Kongo",
      "de-DE": "Kongo",
      "pt-BR": "Kongo",
    },
  },
  {
    alpha2: "ki",
    label: {
      "en-US": "Kikuyu; Gikuyu",
      "de-DE": "Kikuyu; Gikuyu",
      "pt-BR": "Kikuyu; Gikuyu",
    },
  },
  {
    alpha2: "kj",
    label: {
      "en-US": "Kuanyama; Kwanyama",
      "de-DE": "Kuanyama; Kwanyama",
      "pt-BR": "Kuanyama; Kwanyama",
    },
  },
  {
    alpha2: "kk",
    label: {
      "en-US": "Kazakh",
      "de-DE": "Kasachisch",
      "pt-BR": "Cazaque",
    },
  },
  {
    alpha2: "kl",
    label: {
      "en-US": "Kalaallisut; Greenlandic",
      "de-DE": "Kalaallisut; Grönländisch",
      "pt-BR": "Kalaallisut; Groelândico",
    },
  },
  {
    alpha2: "km",
    label: {
      "en-US": "Central Khmer",
      "de-DE": "Zentral-Khmer",
      "pt-BR": "Khmer central",
    },
  },
  {
    alpha2: "kn",
    label: {
      "en-US": "Kannada",
      "de-DE": "Kannada",
      "pt-BR": "Canarês",
    },
  },
  {
    alpha2: "ko",
    label: {
      "en-US": "Korean",
      "de-DE": "Koreanisch",
      "pt-BR": "Coreano",
    },
  },
  {
    alpha2: "kr",
    label: {
      "en-US": "Kanuri",
      "de-DE": "Kanuri",
      "pt-BR": "Kanuri",
    },
  },
  {
    alpha2: "ks",
    label: {
      "en-US": "Kashmiri",
      "de-DE": "Kashmiri",
      "pt-BR": "Kashmiri",
    },
  },
  {
    alpha2: "ku",
    label: {
      "en-US": "Kurdish",
      "de-DE": "Kurdisch",
      "pt-BR": "Curdo",
    },
  },
  {
    alpha2: "kv",
    label: {
      "en-US": "Komi",
      "de-DE": "Komi",
      "pt-BR": "Komi",
    },
  },
  {
    alpha2: "kw",
    label: {
      "en-US": "Cornish",
      "de-DE": "Kornisch",
      "pt-BR": "Cornualles",
    },
  },
  {
    alpha2: "ky",
    label: {
      "en-US": "Kirghiz; Kyrgyz",
      "de-DE": "Kirgisisch; Kirgisischer",
      "pt-BR": "Kirguiz; Quirguiz",
    },
  },
  {
    alpha2: "la",
    label: {
      "en-US": "Latin",
      "de-DE": "Lateinisch",
      "pt-BR": "Latim",
    },
  },
  {
    alpha2: "lb",
    label: {
      "en-US": "Luxembourgish; Letzeburgesch",
      "de-DE": "Luxemburgisch; Letzeburgesch",
      "pt-BR": "Luxemburguês; Luxemburguês",
    },
  },
  {
    alpha2: "lg",
    label: {
      "en-US": "Ganda",
      "de-DE": "Ganda",
      "pt-BR": "Ganda",
    },
  },
  {
    alpha2: "li",
    label: {
      "en-US": "Limburgan; Limburger; Limburgish",
      "de-DE": "Limburgisch; Limburger; Limburgish",
      "pt-BR": "Limburguês; Limburguês; Limburguês",
    },
  },
  {
    alpha2: "ln",
    label: {
      "en-US": "Lingala",
      "de-DE": "Lingala",
      "pt-BR": "Lingala",
    },
  },
  {
    alpha2: "lo",
    label: {
      "en-US": "Lao",
      "de-DE": "Lao",
      "pt-BR": "Lao",
    },
  },
  {
    alpha2: "lt",
    label: {
      "en-US": "Lithuanian",
      "de-DE": "Litauisch",
      "pt-BR": "Lituano",
    },
  },
  {
    alpha2: "lu",
    label: {
      "en-US": "Luba-Katanga",
      "de-DE": "Luba-Katanga",
      "pt-BR": "Luba-Katanga",
    },
  },
  {
    alpha2: "lv",
    label: {
      "en-US": "Latvian",
      "de-DE": "Lettisch",
      "pt-BR": "Letão",
    },
  },
  {
    alpha2: "mg",
    label: {
      "en-US": "Malagasy",
      "de-DE": "Malagasy",
      "pt-BR": "Malagasy",
    },
  },
  {
    alpha2: "mh",
    label: {
      "en-US": "Marshallese",
      "de-DE": "Marshallese",
      "pt-BR": "Marshallês",
    },
  },
  {
    alpha2: "mi",
    label: {
      "en-US": "Maori",
      "de-DE": "Maori",
      "pt-BR": "Maori",
    },
  },
  {
    alpha2: "mk",
    label: {
      "en-US": "Macedonian",
      "de-DE": "Mazedonisch",
      "pt-BR": "Macedônio",
    },
  },
  {
    alpha2: "ml",
    label: {
      "en-US": "Malayalam",
      "de-DE": "Malayalam",
      "pt-BR": "Malayalam",
    },
  },
  {
    alpha2: "mn",
    label: {
      "en-US": "Mongolian",
      "de-DE": "Mongolisch",
      "pt-BR": "Mongol",
    },
  },
  {
    alpha2: "mr",
    label: {
      "en-US": "Marathi",
      "de-DE": "Marathi",
      "pt-BR": "Marati",
    },
  },
  {
    alpha2: "ms",
    label: {
      "en-US": "Malay",
      "de-DE": "Malay",
      "pt-BR": "Malaio",
    },
  },
  {
    alpha2: "mt",
    label: {
      "en-US": "Maltese",
      "de-DE": "Maltesisch",
      "pt-BR": "Maltês",
    },
  },
  {
    alpha2: "my",
    label: {
      "en-US": "Burmese",
      "de-DE": "Birmanisch",
      "pt-BR": "Birmanês",
    },
  },
  {
    alpha2: "na",
    label: {
      "en-US": "Nauru",
      "de-DE": "Nauru",
      "pt-BR": "Nauru",
    },
  },
  {
    alpha2: "nb",
    label: {
      "en-US": "Bokmål, Norwegian; Norwegian Bokmål",
      "de-DE": "Bokmål, Norwegisch; Norwegische Bokmål",
      "pt-BR": "Bokmål, Norueguês; Bokmål Norueguês",
    },
  },
  {
    alpha2: "nd",
    label: {
      "en-US": "Ndebele, North; North Ndebele",
      "de-DE": "Ndebele, Nord; Nord Ndebele",
      "pt-BR": "Ndebele, Norte; Norte Ndebele",
    },
  },
  {
    alpha2: "ne",
    label: {
      "en-US": "Nepali",
      "de-DE": "Nepali",
      "pt-BR": "Nepali",
    },
  },
  {
    alpha2: "ng",
    label: {
      "en-US": "Ndonga",
      "de-DE": "Ndonga",
      "pt-BR": "Ndonga",
    },
  },
  {
    alpha2: "nl",
    label: {
      "en-US": "Dutch; Flemish",
      "de-DE": "Holländisch; Flämisch",
      "pt-BR": "Holandês; Flamengo",
    },
  },
  {
    alpha2: "nn",
    label: {
      "en-US": "Norwegian Nynorsk; Nynorsk, Norwegian",
      "de-DE": "Norwegische Nynorsk; Nynorsk, Norwegisch",
      "pt-BR": "Norwegian Nynorsk; Nynorsk, Norueguês",
    },
  },
  {
    alpha2: "no",
    label: {
      "en-US": "Norwegian",
      "de-DE": "Norwegisch",
      "pt-BR": "Norueguês",
    },
  },
  {
    alpha2: "nr",
    label: {
      "en-US": "Ndebele, South; South Ndebele",
      "de-DE": "Ndebele, Süd; Süd Ndebele",
      "pt-BR": "Ndebele, Sul; Sul Ndebele",
    },
  },
  {
    alpha2: "nv",
    label: {
      "en-US": "Navajo; Navaho",
      "de-DE": "Navajo; Navaho",
      "pt-BR": "Navajo; Navaho",
    },
  },
  {
    alpha2: "ny",
    label: {
      "en-US": "Chichewa; Chewa; Nyanja",
      "de-DE": "Chichewa; Chewa; Nyanja",
      "pt-BR": "Chichewa; Chewa; Nyanja",
    },
  },
  {
    alpha2: "oc",
    label: {
      "en-US": "Occitan (post 1500)",
      "de-DE": "Occitan (post 1500)",
      "pt-BR": "Occitano (pós 1500)",
    },
  },
  {
    alpha2: "oj",
    label: {
      "en-US": "Ojibwa",
      "de-DE": "Ojibwa",
      "pt-BR": "Ojibwa",
    },
  },
  {
    alpha2: "om",
    label: {
      "en-US": "Oromo",
      "de-DE": "Oromo",
      "pt-BR": "Oromo",
    },
  },
  {
    alpha2: "or",
    label: {
      "en-US": "Oriya",
      "de-DE": "Oriya",
      "pt-BR": "Oriya",
    },
  },
  {
    alpha2: "os",
    label: {
      "en-US": "Ossetian; Ossetic",
      "de-DE": "Ossetian; Ossetic",
      "pt-BR": "Ossetiano; Ossético",
    },
  },
  {
    alpha2: "pa",
    label: {
      "en-US": "Panjabi; Punjabi",
      "de-DE": "Panjabi; Punjabi",
      "pt-BR": "Panjabi; Punjabi",
    },
  },
  {
    alpha2: "pi",
    label: {
      "en-US": "Pali",
      "de-DE": "Pali",
      "pt-BR": "Pali",
    },
  },
  {
    alpha2: "pl",
    label: {
      "en-US": "Polish",
      "de-DE": "Polnisch",
      "pt-BR": "Polonês",
    },
  },
  {
    alpha2: "ps",
    label: {
      "en-US": "Pushto; Pashto",
      "de-DE": "Pushto; Pashto",
      "pt-BR": "Pushto; Pashto",
    },
  },
  {
    alpha2: "pt",
    label: {
      "en-US": "Portuguese",
      "de-DE": "Portugiesisch",
      "pt-BR": "Português",
    },
  },
  {
    alpha2: "qu",
    label: {
      "en-US": "Quechua",
      "de-DE": "Quechua",
      "pt-BR": "Quechua",
    },
  },
  {
    alpha2: "rm",
    label: {
      "en-US": "Romansh",
      "de-DE": "Rämisch",
      "pt-BR": "Romeno",
    },
  },
  {
    alpha2: "rn",
    label: {
      "en-US": "Rundi",
      "de-DE": "Rundi",
      "pt-BR": "Rundi",
    },
  },
  {
    alpha2: "ro",
    label: {
      "en-US": "Romanian; Moldavian; Moldovan",
      "de-DE": "Rumänisch; Moldauisch; Moldauisch",
      "pt-BR": "Romeno; Moldavo; Moldavo",
    },
  },
  {
    alpha2: "ru",
    label: {
      "en-US": "Russian",
      "de-DE": "Russisch",
      "pt-BR": "Russo",
    },
  },
  {
    alpha2: "rw",
    label: {
      "en-US": "Kinyarwanda",
      "de-DE": "Kinyarwanda",
      "pt-BR": "Kinyarwanda",
    },
  },
  {
    alpha2: "sa",
    label: {
      "en-US": "Sanskrit",
      "de-DE": "Sanskrit",
      "pt-BR": "Sânscrito",
    },
  },
  {
    alpha2: "sc",
    label: {
      "en-US": "Sardinian",
      "de-DE": "Sardisch",
      "pt-BR": "Sardo",
    },
  },
  {
    alpha2: "sd",
    label: {
      "en-US": "Sindhi",
      "de-DE": "Sindhi",
      "pt-BR": "Sindhi",
    },
  },
  {
    alpha2: "se",
    label: {
      "en-US": "Northern Sami",
      "de-DE": "Nordischer Sami",
      "pt-BR": "Sami do Norte",
    },
  },
  {
    alpha2: "sg",
    label: {
      "en-US": "Sango",
      "de-DE": "Sango",
      "pt-BR": "Sango",
    },
  },
  {
    alpha2: "si",
    label: {
      "en-US": "Sinhala; Sinhalese",
      "de-DE": "Sinhala; Sinhalese",
      "pt-BR": "Sinhala; Sinhalese",
    },
  },
  {
    alpha2: "sk",
    label: {
      "en-US": "Slovak",
      "de-DE": "Slowakisch",
      "pt-BR": "Eslovaco",
    },
  },
  {
    alpha2: "sl",
    label: {
      "en-US": "Slovenian",
      "de-DE": "Slowenisch",
      "pt-BR": "Esloveno",
    },
  },
  {
    alpha2: "sm",
    label: {
      "en-US": "Samoan",
      "de-DE": "Samoan",
      "pt-BR": "Samoano",
    },
  },
  {
    alpha2: "sn",
    label: {
      "en-US": "Shona",
      "de-DE": "Shona",
      "pt-BR": "Shona",
    },
  },
  {
    alpha2: "so",
    label: {
      "en-US": "Somali",
      "de-DE": "Somali",
      "pt-BR": "Somali",
    },
  },
  {
    alpha2: "sq",
    label: {
      "en-US": "Albanian",
      "de-DE": "Albanisch",
      "pt-BR": "Albânico",
    },
  },
  {
    alpha2: "sr",
    label: {
      "en-US": "Serbian",
      "de-DE": "Serbisch",
      "pt-BR": "Sérvio",
    },
  },
  {
    alpha2: "ss",
    label: {
      "en-US": "Swati",
      "de-DE": "Swati",
      "pt-BR": "Swati",
    },
  },
  {
    alpha2: "st",
    label: {
      "en-US": "Sotho, Southern",
      "de-DE": "Sotho, Süd",
      "pt-BR": "Sotho, Sul",
    },
  },
  {
    alpha2: "su",
    label: {
      "en-US": "Sundanese",
      "de-DE": "Sundanesisch",
      "pt-BR": "Sundanês",
    },
  },
  {
    alpha2: "sv",
    label: {
      "en-US": "Swedish",
      "de-DE": "Schwedisch",
      "pt-BR": "Sueco",
    },
  },
  {
    alpha2: "sw",
    label: {
      "en-US": "Swahili",
      "de-DE": "Swahili",
      "pt-BR": "Swahili",
    },
  },
  {
    alpha2: "ta",
    label: {
      "en-US": "Tamil",
      "de-DE": "Tamil",
      "pt-BR": "Tâmil",
    },
  },
  {
    alpha2: "te",
    label: {
      "en-US": "Telugu",
      "de-DE": "Telugu",
      "pt-BR": "Telugu",
    },
  },
  {
    alpha2: "tg",
    label: {
      "en-US": "Tajik",
      "de-DE": "Tadschikisch",
      "pt-BR": "Tajique",
    },
  },
  {
    alpha2: "th",
    label: {
      "en-US": "Thai",
      "de-DE": "Thai",
      "pt-BR": "Tailandês",
    },
  },
  {
    alpha2: "ti",
    label: {
      "en-US": "Tigrinya",
      "de-DE": "Tigrinya",
      "pt-BR": "Tigrinya",
    },
  },
  {
    alpha2: "tk",
    label: {
      "en-US": "Turkmen",
      "de-DE": "Turkmenisch",
      "pt-BR": "Turcomano",
    },
  },
  {
    alpha2: "tl",
    label: {
      "en-US": "Tagalog",
      "de-DE": "Tagalog",
      "pt-BR": "Tagalo",
    },
  },
  {
    alpha2: "tn",
    label: {
      "en-US": "Tswana",
      "de-DE": "Tswana",
      "pt-BR": "Tswana",
    },
  },
  {
    alpha2: "to",
    label: {
      "en-US": "Tonga (Tonga Islands)",
      "de-DE": "Tonga (Tonga-Inseln)",
      "pt-BR": "Tonga (Ilhas Tonga)",
    },
  },
  {
    alpha2: "tr",
    label: {
      "en-US": "Turkish",
      "de-DE": "Türkisch",
      "pt-BR": "Turco",
    },
  },
  {
    alpha2: "ts",
    label: {
      "en-US": "Tsonga",
      "de-DE": "Tsonga",
      "pt-BR": "Tsonga",
    },
  },
  {
    alpha2: "tt",
    label: {
      "en-US": "Tatar",
      "de-DE": "Tatarisch",
      "pt-BR": "Tatar",
    },
  },
  {
    alpha2: "tw",
    label: {
      "en-US": "Twi",
      "de-DE": "Twi",
      "pt-BR": "Twi",
    },
  },
  {
    alpha2: "ty",
    label: {
      "en-US": "Tahitian",
      "de-DE": "Tahitisch",
      "pt-BR": "Tahitiano",
    },
  },
  {
    alpha2: "ug",
    label: {
      "en-US": "Uighur; Uyghur",
      "de-DE": "Uighur; Uyghur",
      "pt-BR": "Uigur; Uigur",
    },
  },
  {
    alpha2: "uk",
    label: {
      "en-US": "Ukrainian",
      "de-DE": "Ukrainisch",
      "pt-BR": "Ucraniano",
    },
  },
  {
    alpha2: "ur",
    label: {
      "en-US": "Urdu",
      "de-DE": "Urdu",
      "pt-BR": "Urdu",
    },
  },
  {
    alpha2: "uz",
    label: {
      "en-US": "Uzbek",
      "de-DE": "Usbekisch",
      "pt-BR": "Usbeque",
    },
  },
  {
    alpha2: "ve",
    label: {
      "en-US": "Venda",
      "de-DE": "Venda",
      "pt-BR": "Venda",
    },
  },
  {
    alpha2: "vi",
    label: {
      "en-US": "Vietnamese",
      "de-DE": "Vietnamesisch",
      "pt-BR": "Vietnamita",
    },
  },
  {
    alpha2: "vo",
    label: {
      "en-US": "Volapük",
      "de-DE": "Volapük",
      "pt-BR": "Volapük",
    },
  },
  {
    alpha2: "wa",
    label: {
      "en-US": "Walloon",
      "de-DE": "Wallonisch",
      "pt-BR": "Valão",
    },
  },
  {
    alpha2: "wo",
    label: {
      "en-US": "Wolof",
      "de-DE": "Wolof",
      "pt-BR": "Wolof",
    },
  },
  {
    alpha2: "xh",
    label: {
      "en-US": "Xhosa",
      "de-DE": "Xhosa",
      "pt-BR": "Xhosa",
    },
  },
  {
    alpha2: "yi",
    label: {
      "en-US": "Yiddish",
      "de-DE": "Jiddisch",
      "pt-BR": "Iídiche",
    },
  },
  {
    alpha2: "yo",
    label: {
      "en-US": "Yoruba",
      "de-DE": "Yoruba",
      "pt-BR": "Iorubá",
    },
  },
  {
    alpha2: "za",
    label: {
      "en-US": "Zhuang; Chuang",
      "de-DE": "Zhuang; Chuang",
      "pt-BR": "Zhuang; Chuang",
    },
  },
  {
    alpha2: "zh-Hans",
    label: {
      "en-US": "Chinese (Simplified)",
      "de-DE": "Chinesisch (Vereinfacht)",
      "pt-BR": "Chinês (Simplificado)",
    },
  },
  {
    alpha2: "zh-Hant",
    label: {
      "en-US": "Chinese (Traditional)",
      "de-DE": "Chinesisch (Traditionell)",
      "pt-BR": "Chinês (Tradicional)",
    },
  },
  {
    alpha2: "zu",
    label: {
      "en-US": "Zulu",
      "de-DE": "Zulu",
      "pt-BR": "Zulu",
    },
  },
];

export const iso639Identifiers = iso639Languages.map((language) => language.alpha2);

export const getLanguageLabel = (languageCode: string, locale: string): string | undefined => {
  const language = iso639Languages.find((lang) => lang.alpha2 === languageCode);
  // Type assertion to tell TypeScript that we know the structure of label
  return language?.label[locale as keyof typeof language.label];
};

// Helper function to add language keys to a multi-language object (e.g. survey or question)
// Iterates over the object recursively and adds empty strings for new language keys
export const addMultiLanguageLabels = (object: any, languageSymbols: string[]): any => {
  // Helper function to add language keys to a multi-language object
  function addLanguageKeys(obj: { default: string;[key: string]: string }) {
    languageSymbols.forEach((lang) => {
      if (!obj.hasOwnProperty(lang)) {
        obj[lang] = ""; // Add empty string for new language keys
      }
    });
  }

  // Recursive function to process an object or array
  function processObject(obj: any) {
    if (Array.isArray(obj)) {
      obj.forEach((item) => processObject(item));
    } else if (obj && typeof obj === "object") {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (key === "default" && typeof obj[key] === "string") {
            addLanguageKeys(obj);
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
    },
  },
  {
    code: "de-DE",
    label: {
      "en-US": "German",
      "de-DE": "Deutsch",
      "pt-BR": "Alemão",
    },
  },
  {
    code: "pt-BR",
    label: {
      "en-US": "Portuguese (Brazil)",
      "de-DE": "Portugiesisch (Brasilien)",
      "pt-BR": "Português (Brasil)",
    },
  },
];
