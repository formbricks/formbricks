import { TLanguage } from "@formbricks/types/product";
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
    "hi-IN": string;
    "de-DE": string;
    "pt-BR": string;
  };
}

export const iso639Languages = [
  {
    alpha2: "aa",
    label: {
      "en-US": "Afar",
      "hi-IN": "अफ़ार",
      "de-DE": "Afar",
      "pt-BR": "Afar",
    },
  },
  {
    alpha2: "ab",
    label: {
      "en-US": "Abkhazian",
      "hi-IN": "अभ्राज़ीयन",
      "de-DE": "Abchasisch",
      "pt-BR": "Abcásio",
    },
  },
  {
    alpha2: "ae",
    label: {
      "en-US": "Avestan",
      "hi-IN": "अवेस्तानी",
      "de-DE": "Avestisch",
      "pt-BR": "Avestano",
    },
  },
  {
    alpha2: "af",
    label: {
      "en-US": "Afrikaans",
      "hi-IN": "अफ्रीकान्स",
      "de-DE": "Afrikaans",
      "pt-BR": "Afrikâner",
    },
  },
  {
    alpha2: "ak",
    label: {
      "en-US": "Akan",
      "hi-IN": "अकान",
      "de-DE": "Akan",
      "pt-BR": "Akan",
    },
  },
  {
    alpha2: "am",
    label: {
      "en-US": "Amharic",
      "hi-IN": "अम्हारिक",
      "de-DE": "Amharisch",
      "pt-BR": "Amárico",
    },
  },
  {
    alpha2: "an",
    label: {
      "en-US": "Aragonese",
      "hi-IN": "अरागोनीज़",
      "de-DE": "Aragonesisch",
      "pt-BR": "Aragonês",
    },
  },
  {
    alpha2: "ar",
    label: {
      "en-US": "Arabic",
      "hi-IN": "अरबी",
      "de-DE": "Arabisch",
      "pt-BR": "Árabe",
    },
  },
  {
    alpha2: "as",
    label: {
      "en-US": "Assamese",
      "hi-IN": "असमीज़",
      "de-DE": "Assamesisch",
      "pt-BR": "Assamês",
    },
  },
  {
    alpha2: "av",
    label: {
      "en-US": "Avaric",
      "hi-IN": "अवारिक",
      "de-DE": "Avarisch",
      "pt-BR": "Avaric",
    },
  },
  {
    alpha2: "ay",
    label: {
      "en-US": "Aymara",
      "hi-IN": "अयमारा",
      "de-DE": "Aymara",
      "pt-BR": "Aymara",
    },
  },
  {
    alpha2: "az",
    label: {
      "en-US": "Azerbaijani",
      "hi-IN": "अज़रबैजानी",
      "de-DE": "Aserbaidschanisch",
      "pt-BR": "Azerbaijano",
    },
  },
  {
    alpha2: "ba",
    label: {
      "en-US": "Bashkir",
      "hi-IN": "बश्किर",
      "de-DE": "Baschkirisch",
      "pt-BR": "Basco",
    },
  },
  {
    alpha2: "be",
    label: {
      "en-US": "Belarusian",
      "hi-IN": "बेलारुसीयन",
      "de-DE": "Weißrussisch",
      "pt-BR": "Bielorrusso",
    },
  },
  {
    alpha2: "bg",
    label: {
      "en-US": "Bulgarian",
      "hi-IN": "बुल्गारियन",
      "de-DE": "Bulgarisch",
      "pt-BR": "Búlgaro",
    },
  },
  {
    alpha2: "bh",
    label: {
      "en-US": "Bihari languages",
      "hi-IN": "बिहारी भाषाएं",
      "de-DE": "Biharische Sprachen",
      "pt-BR": "Bihari",
    },
  },
  {
    alpha2: "bi",
    label: {
      "en-US": "Bislama",
      "hi-IN": "बिस्लामा",
      "de-DE": "Bislama",
      "pt-BR": "Bislama",
    },
  },
  {
    alpha2: "bm",
    label: {
      "en-US": "Bambara",
      "hi-IN": "बम्बारा",
      "de-DE": "Bambara",
      "pt-BR": "Bambara",
    },
  },
  {
    alpha2: "bn",
    label: {
      "en-US": "Bengali",
      "hi-IN": "बेंगाली",
      "de-DE": "Bengali",
      "pt-BR": "Bengali",
    },
  },
  {
    alpha2: "bo",
    label: {
      "en-US": "Tibetan",
      "hi-IN": "तिब्बती",
      "de-DE": "Tibetisch",
      "pt-BR": "Tibetano",
    },
  },
  {
    alpha2: "br",
    label: {
      "en-US": "Breton",
      "hi-IN": "ब्रेटन",
      "de-DE": "Bretonisch",
      "pt-BR": "Breton",
    },
  },
  {
    alpha2: "bs",
    label: {
      "en-US": "Bosnian",
      "hi-IN": "बोस्नियन",
      "de-DE": "Bosnisch",
      "pt-BR": "Bósnio",
    },
  },
  {
    alpha2: "ca",
    label: {
      "en-US": "Catalan; Valencian",
      "hi-IN": "कॉटलन; वेलेन्सियन",
      "de-DE": "Katalanisch; Valencisch",
      "pt-BR": "Catalão; Valenciano",
    },
  },
  {
    alpha2: "ce",
    label: {
      "en-US": "Chechen",
      "hi-IN": "चेचेन",
      "de-DE": "Tschetschenisch",
      "pt-BR": "Checheno",
    },
  },
  {
    alpha2: "ch",
    label: {
      "en-US": "Chamorro",
      "hi-IN": "चामोरो",
      "de-DE": "Chamorro",
      "pt-BR": "Chamorro",
    },
  },
  {
    alpha2: "co",
    label: {
      "en-US": "Corsican",
      "hi-IN": "कॉर्सिकन",
      "de-DE": "Korsisch",
      "pt-BR": "Corsican",
    },
  },
  {
    alpha2: "cr",
    label: {
      "en-US": "Cree",
      "hi-IN": "क्री",
      "de-DE": "Cree",
      "pt-BR": "Cree",
    },
  },
  {
    alpha2: "cs",
    label: {
      "en-US": "Czech",
      "hi-IN": "चेक",
      "de-DE": "Tschechisch",
      "pt-BR": "Tcheco",
    },
  },
  {
    alpha2: "cu",
    label: {
      "en-US": "Church Slavic; Old Slavonic; Church Slavonic; Old Bulgarian; Old Church Slavonic",
      "hi-IN": "चर्च स्लाविक; पुराना स्लाविक; चर्च स्लाविक; पुराना बुल्गारियन; पुराना चर्च स्लाविक",
      "de-DE": "Kirchenslawisch; Altbulgarisch; Kirchenslawisch; Altbulgarisch; Altkirchliches Slawisch",
      "pt-BR":
        "Slavônico eclesiástico; Antigo eslavônico; Sânscrito eclesiástico; Antigo búlgaro; Antigo sânscrito eclesiástico",
    },
  },
  {
    alpha2: "cv",
    label: {
      "en-US": "Chuvash",
      "hi-IN": "चुवाश",
      "de-DE": "Tschuwaschisch",
      "pt-BR": "Tchuvasco",
    },
  },
  {
    alpha2: "cy",
    label: {
      "en-US": "Welsh",
      "hi-IN": "वेल्श",
      "de-DE": "Walisisch",
      "pt-BR": "Galês",
    },
  },
  {
    alpha2: "da",
    label: {
      "en-US": "Danish",
      "hi-IN": "डेनिश",
      "de-DE": "Dänisch",
      "pt-BR": "Dinamarquês",
    },
  },
  {
    alpha2: "de",
    label: {
      "en-US": "German",
      "hi-IN": "जर्मन",
      "de-DE": "Deutsch",
      "pt-BR": "Alemão",
    },
  },
  {
    alpha2: "dv",
    label: {
      "en-US": "Divehi; Dhivehi; Maldivian",
      "hi-IN": "डिवीही; धिवीही; मलदीवियन",
      "de-DE": "Divehi; Dhivehi; Maldivisch",
      "pt-BR": "Divehi; Dhivehi; Maldiviano",
    },
  },
  {
    alpha2: "dz",
    label: {
      "en-US": "Dzongkha",
      "hi-IN": "जोंघा",
      "de-DE": "Dzongkha",
      "pt-BR": "Dzongkha",
    },
  },
  {
    alpha2: "ee",
    label: {
      "en-US": "Ewe",
      "hi-IN": "एवे",
      "de-DE": "Ewe",
      "pt-BR": "Ewe",
    },
  },
  {
    alpha2: "el",
    label: {
      "en-US": "Greek, Modern (1453-)",
      "hi-IN": "ग्रीक, आधुनिक (1453-)",
      "de-DE": "Griechisch, Modern (ab 1453)",
      "pt-BR": "Grego moderno (1453-)",
    },
  },
  {
    alpha2: "en",
    label: {
      "en-US": "English",
      "hi-IN": "अंग्रेजी",
      "de-DE": "Englisch",
      "pt-BR": "Inglês",
    },
  },
  {
    alpha2: "eo",
    label: {
      "en-US": "Esperanto",
      "hi-IN": "एस्पेरंटो",
      "de-DE": "Esperanto",
      "pt-BR": "Esperanto",
    },
  },
  {
    alpha2: "es",
    label: {
      "en-US": "Spanish; Castilian",
      "hi-IN": "स्पेनिश; कास्टिलियन",
      "de-DE": "Spanisch; Kastilisch",
      "pt-BR": "Espanhol; Castelao",
    },
  },
  {
    alpha2: "et",
    label: {
      "en-US": "Estonian",
      "hi-IN": "एस्टोनियन",
      "de-DE": "Estnisch",
      "pt-BR": "Estoniano",
    },
  },
  {
    alpha2: "eu",
    label: {
      "en-US": "Basque",
      "hi-IN": "बास्की",
      "de-DE": "Baskisch",
      "pt-BR": "Basco",
    },
  },
  {
    alpha2: "fa",
    label: {
      "en-US": "Persian",
      "hi-IN": "पर्शियन",
      "de-DE": "Persisch",
      "pt-BR": "Persa",
    },
  },
  {
    alpha2: "ff",
    label: {
      "en-US": "Fulah",
      "hi-IN": "फुलाह",
      "de-DE": "Fulah",
      "pt-BR": "Fulah",
    },
  },
  {
    alpha2: "fi",
    label: {
      "en-US": "Finnish",
      "hi-IN": "फिनिश",
      "de-DE": "Finnisch",
      "pt-BR": "Finlandês",
    },
  },
  {
    alpha2: "fj",
    label: {
      "en-US": "Fijian",
      "hi-IN": "फिजियन",
      "de-DE": "Fidschianisch",
      "pt-BR": "Fijiano",
    },
  },
  {
    alpha2: "fo",
    label: {
      "en-US": "Faroese",
      "hi-IN": "फारोइस",
      "de-DE": "Färöisch",
      "pt-BR": "Feroês",
    },
  },
  {
    alpha2: "fr",
    label: {
      "en-US": "French",
      "hi-IN": "फ्रांसीसी",
      "de-DE": "Französisch",
      "pt-BR": "Francês",
    },
  },
  {
    alpha2: "fy",
    label: {
      "en-US": "Western Frisian",
      "hi-IN": "पश्चिमी फ्रीसियन",
      "de-DE": "Westfriesisch",
      "pt-BR": "Frísio ocidental",
    },
  },
  {
    alpha2: "ga",
    label: {
      "en-US": "Irish",
      "hi-IN": "आयरिश",
      "de-DE": "Irischer",
      "pt-BR": "Irlandês",
    },
  },
  {
    alpha2: "gd",
    label: {
      "en-US": "Gaelic; Scottish Gaelic",
      "hi-IN": "गेलिक; स्कॉटिश गेलिक",
      "de-DE": "Gälisch; Schottisch Gälisch",
      "pt-BR": "Gaelico escocês; Gaélico escocês",
    },
  },
  {
    alpha2: "gl",
    label: {
      "en-US": "Galician",
      "hi-IN": "गालिसियन",
      "de-DE": "Galicisch",
      "pt-BR": "Galego",
    },
  },
  {
    alpha2: "gn",
    label: {
      "en-US": "Guarani",
      "hi-IN": "गुआरानी",
      "de-DE": "Guarani",
      "pt-BR": "Guarani",
    },
  },
  {
    alpha2: "gu",
    label: {
      "en-US": "Gujarati",
      "hi-IN": "गुजरती",
      "de-DE": "Gujarati",
      "pt-BR": "Gujarati",
    },
  },
  {
    alpha2: "gv",
    label: {
      "en-US": "Manx",
      "hi-IN": "मैन्स",
      "de-DE": "Manx",
      "pt-BR": "Manx",
    },
  },
  {
    alpha2: "ha",
    label: {
      "en-US": "Hausa",
      "hi-IN": "हौसा",
      "de-DE": "Hausa",
      "pt-BR": "Hausa",
    },
  },
  {
    alpha2: "he",
    label: {
      "en-US": "Hebrew",
      "hi-IN": "हेब्रू",
      "de-DE": "Hebräisch",
      "pt-BR": "Hebraico",
    },
  },
  {
    alpha2: "hi",
    label: {
      "en-US": "Hindi",
      "hi-IN": "हिंदी",
      "de-DE": "Hindi",
      "pt-BR": "Hindi",
    },
  },
  {
    alpha2: "ho",
    label: {
      "en-US": "Hiri Motu",
      "hi-IN": "हिरी मोटु",
      "de-DE": "Hiri Motu",
      "pt-BR": "Hiri Motu",
    },
  },
  {
    alpha2: "hr",
    label: {
      "en-US": "Croatian",
      "hi-IN": "क्रोएशियन",
      "de-DE": "Kroatisch",
      "pt-BR": "Croata",
    },
  },
  {
    alpha2: "ht",
    label: {
      "en-US": "Haitian; Haitian Creole",
      "hi-IN": "हैटियन; हैटियन क्रीओल",
      "de-DE": "Haitian; Haitian Creole",
      "pt-BR": "Haitiano; Crioulo haitiano",
    },
  },
  {
    alpha2: "hu",
    label: {
      "en-US": "Hungarian",
      "hi-IN": "हंगेरियन",
      "de-DE": "Ungarisch",
      "pt-BR": "Húngaro",
    },
  },
  {
    alpha2: "hy",
    label: {
      "en-US": "Armenian",
      "hi-IN": "अर्मेनियन",
      "de-DE": "Armenisch",
      "pt-BR": "Armênio",
    },
  },
  {
    alpha2: "hz",
    label: {
      "en-US": "Herero",
      "hi-IN": "हेरेरो",
      "de-DE": "Herero",
      "pt-BR": "Herero",
    },
  },
  {
    alpha2: "ia",
    label: {
      "en-US": "Interlingua (International Auxiliary Language Association)",
      "hi-IN": "इंटरलिंग्वा (अंटरनेशनल एक्ससिलियरी लैंग्वेज एसोसिएशन)",
      "de-DE": "Interlingua (Internationaler Hilfssprachverband)",
      "pt-BR": "Interlingua (Associação Internacional de Línguas Auxiliares)",
    },
  },
  {
    alpha2: "id",
    label: {
      "en-US": "Indonesian",
      "hi-IN": "इंडोनेशियन",
      "de-DE": "Indonesisch",
      "pt-BR": "Indonésio",
    },
  },
  {
    alpha2: "ie",
    label: {
      "en-US": "Interlingue; Occidental",
      "hi-IN": "इंटरलिंग्वा; ऑस्कियल",
      "de-DE": "Interlingue; Occidental",
      "pt-BR": "Interlingue; Ocidental",
    },
  },
  {
    alpha2: "ig",
    label: {
      "en-US": "Igbo",
      "hi-IN": "इग्बो",
      "de-DE": "Igbo",
      "pt-BR": "Igbo",
    },
  },
  {
    alpha2: "ii",
    label: {
      "en-US": "Sichuan Yi; Nuosu",
      "hi-IN": "सिचुआन यी; नुसु",
      "de-DE": "Sichuan Yi; Nuosu",
      "pt-BR": "Sichuan Yi; Nuosu",
    },
  },
  {
    alpha2: "ik",
    label: {
      "en-US": "Inupiaq",
      "hi-IN": "इनुपियाक",
      "de-DE": "Inupiaq",
      "pt-BR": "Inupiaq",
    },
  },
  {
    alpha2: "io",
    label: {
      "en-US": "Ido",
      "hi-IN": "इडो",
      "de-DE": "Ido",
      "pt-BR": "Ido",
    },
  },
  {
    alpha2: "is",
    label: {
      "en-US": "Icelandic",
      "hi-IN": "आइसलैंडिक",
      "de-DE": "Isländisch",
      "pt-BR": "Islandês",
    },
  },
  {
    alpha2: "it",
    label: {
      "en-US": "Italian",
      "hi-IN": "इतालियन",
      "de-DE": "Italienisch",
      "pt-BR": "Italiano",
    },
  },
  {
    alpha2: "iu",
    label: {
      "en-US": "Inuktitut",
      "hi-IN": "इनुक्टिटुट",
      "de-DE": "Inuktitut",
      "pt-BR": "Inuktitut",
    },
  },
  {
    alpha2: "ja",
    label: {
      "en-US": "Japanese",
      "hi-IN": "जापानी",
      "de-DE": "Japanisch",
      "pt-BR": "Japonês",
    },
  },
  {
    alpha2: "jv",
    label: {
      "en-US": "Javanese",
      "hi-IN": "जावानी",
      "de-DE": "Javanisch",
      "pt-BR": "Javonês",
    },
  },
  {
    alpha2: "ka",
    label: {
      "en-US": "Georgian",
      "hi-IN": "जॉर्जियन",
      "de-DE": "Georgisch",
      "pt-BR": "Georgiano",
    },
  },
  {
    alpha2: "kg",
    label: {
      "en-US": "Kongo",
      "hi-IN": "कोंगो",
      "de-DE": "Kongo",
      "pt-BR": "Kongo",
    },
  },
  {
    alpha2: "ki",
    label: {
      "en-US": "Kikuyu; Gikuyu",
      "hi-IN": "किकुयु; गिकुयु",
      "de-DE": "Kikuyu; Gikuyu",
      "pt-BR": "Kikuyu; Gikuyu",
    },
  },
  {
    alpha2: "kj",
    label: {
      "en-US": "Kuanyama; Kwanyama",
      "hi-IN": "कुआन्यामा; क्वान्यामा",
      "de-DE": "Kuanyama; Kwanyama",
      "pt-BR": "Kuanyama; Kwanyama",
    },
  },
  {
    alpha2: "kk",
    label: {
      "en-US": "Kazakh",
      "hi-IN": "काजाक",
      "de-DE": "Kasachisch",
      "pt-BR": "Cazaque",
    },
  },
  {
    alpha2: "kl",
    label: {
      "en-US": "Kalaallisut; Greenlandic",
      "hi-IN": "कलालिसुट; ग्रीनलैंडिक",
      "de-DE": "Kalaallisut; Grönländisch",
      "pt-BR": "Kalaallisut; Groelândico",
    },
  },
  {
    alpha2: "km",
    label: {
      "en-US": "Central Khmer",
      "hi-IN": "केंट्रल खमेर",
      "de-DE": "Zentral-Khmer",
      "pt-BR": "Khmer central",
    },
  },
  {
    alpha2: "kn",
    label: {
      "en-US": "Kannada",
      "hi-IN": "कन्नड",
      "de-DE": "Kannada",
      "pt-BR": "Canarês",
    },
  },
  {
    alpha2: "ko",
    label: {
      "en-US": "Korean",
      "hi-IN": "कोरियन",
      "de-DE": "Koreanisch",
      "pt-BR": "Coreano",
    },
  },
  {
    alpha2: "kr",
    label: {
      "en-US": "Kanuri",
      "hi-IN": "कानुरी",
      "de-DE": "Kanuri",
      "pt-BR": "Kanuri",
    },
  },
  {
    alpha2: "ks",
    label: {
      "en-US": "Kashmiri",
      "hi-IN": "कश्मीरी",
      "de-DE": "Kashmiri",
      "pt-BR": "Kashmiri",
    },
  },
  {
    alpha2: "ku",
    label: {
      "en-US": "Kurdish",
      "hi-IN": "कुर्दिश",
      "de-DE": "Kurdisch",
      "pt-BR": "Curdo",
    },
  },
  {
    alpha2: "kv",
    label: {
      "en-US": "Komi",
      "hi-IN": "कोमी",
      "de-DE": "Komi",
      "pt-BR": "Komi",
    },
  },
  {
    alpha2: "kw",
    label: {
      "en-US": "Cornish",
      "hi-IN": "कॉर्निश",
      "de-DE": "Kornisch",
      "pt-BR": "Cornualles",
    },
  },
  {
    alpha2: "ky",
    label: {
      "en-US": "Kirghiz; Kyrgyz",
      "hi-IN": "किर्गिज; किर्गिस",
      "de-DE": "Kirgisisch; Kirgisischer",
      "pt-BR": "Kirguiz; Quirguiz",
    },
  },
  {
    alpha2: "la",
    label: {
      "en-US": "Latin",
      "hi-IN": "लैटिन",
      "de-DE": "Lateinisch",
      "pt-BR": "Latim",
    },
  },
  {
    alpha2: "lb",
    label: {
      "en-US": "Luxembourgish; Letzeburgesch",
      "hi-IN": "लक्समबुर्गिश; लेट्जेबर्गिश",
      "de-DE": "Luxemburgisch; Letzeburgesch",
      "pt-BR": "Luxemburguês; Luxemburguês",
    },
  },
  {
    alpha2: "lg",
    label: {
      "en-US": "Ganda",
      "hi-IN": "गंडा",
      "de-DE": "Ganda",
      "pt-BR": "Ganda",
    },
  },
  {
    alpha2: "li",
    label: {
      "en-US": "Limburgan; Limburger; Limburgish",
      "hi-IN": "लिम्बुर्गन; लिम्बुर्गर; लिम्बुर्गिश",
      "de-DE": "Limburgisch; Limburger; Limburgish",
      "pt-BR": "Limburguês; Limburguês; Limburguês",
    },
  },
  {
    alpha2: "ln",
    label: {
      "en-US": "Lingala",
      "hi-IN": "लिंगाला",
      "de-DE": "Lingala",
      "pt-BR": "Lingala",
    },
  },
  {
    alpha2: "lo",
    label: {
      "en-US": "Lao",
      "hi-IN": "लाओ",
      "de-DE": "Lao",
      "pt-BR": "Lao",
    },
  },
  {
    alpha2: "lt",
    label: {
      "en-US": "Lithuanian",
      "hi-IN": "लिथुआनियन",
      "de-DE": "Litauisch",
      "pt-BR": "Lituano",
    },
  },
  {
    alpha2: "lu",
    label: {
      "en-US": "Luba-Katanga",
      "hi-IN": "लुबा-काटांगा",
      "de-DE": "Luba-Katanga",
      "pt-BR": "Luba-Katanga",
    },
  },
  {
    alpha2: "lv",
    label: {
      "en-US": "Latvian",
      "hi-IN": "लेट्वियन",
      "de-DE": "Lettisch",
      "pt-BR": "Letão",
    },
  },
  {
    alpha2: "mg",
    label: {
      "en-US": "Malagasy",
      "hi-IN": "मलागासी",
      "de-DE": "Malagasy",
      "pt-BR": "Malagasy",
    },
  },
  {
    alpha2: "mh",
    label: {
      "en-US": "Marshallese",
      "hi-IN": "मार्शलेसे",
      "de-DE": "Marshallese",
      "pt-BR": "Marshallês",
    },
  },
  {
    alpha2: "mi",
    label: {
      "en-US": "Maori",
      "hi-IN": "मोरी",
      "de-DE": "Maori",
      "pt-BR": "Maori",
    },
  },
  {
    alpha2: "mk",
    label: {
      "en-US": "Macedonian",
      "hi-IN": "मॅसेडोनियन",
      "de-DE": "Mazedonisch",
      "pt-BR": "Macedônio",
    },
  },
  {
    alpha2: "ml",
    label: {
      "en-US": "Malayalam",
      "hi-IN": "मलयालम",
      "de-DE": "Malayalam",
      "pt-BR": "Malayalam",
    },
  },
  {
    alpha2: "mn",
    label: {
      "en-US": "Mongolian",
      "hi-IN": "मोंगोलियन",
      "de-DE": "Mongolisch",
      "pt-BR": "Mongol",
    },
  },
  {
    alpha2: "mr",
    label: {
      "en-US": "Marathi",
      "hi-IN": "मराठी",
      "de-DE": "Marathi",
      "pt-BR": "Marati",
    },
  },
  {
    alpha2: "ms",
    label: {
      "en-US": "Malay",
      "hi-IN": "मलेय",
      "de-DE": "Malay",
      "pt-BR": "Malaio",
    },
  },
  {
    alpha2: "mt",
    label: {
      "en-US": "Maltese",
      "hi-IN": "मल्टेसे",
      "de-DE": "Maltesisch",
      "pt-BR": "Maltês",
    },
  },
  {
    alpha2: "my",
    label: {
      "en-US": "Burmese",
      "hi-IN": "बर्मी",
      "de-DE": "Birmanisch",
      "pt-BR": "Birmanês",
    },
  },
  {
    alpha2: "na",
    label: {
      "en-US": "Nauru",
      "hi-IN": "नाउरू",
      "de-DE": "Nauru",
      "pt-BR": "Nauru",
    },
  },
  {
    alpha2: "nb",
    label: {
      "en-US": "Bokmål, Norwegian; Norwegian Bokmål",
      "hi-IN": "बोकमाल, नॉर्वेजियन; नॉर्वेजियन बोकमाल",
      "de-DE": "Bokmål, Norwegisch; Norwegische Bokmål",
      "pt-BR": "Bokmål, Norueguês; Bokmål Norueguês",
    },
  },
  {
    alpha2: "nd",
    label: {
      "en-US": "Ndebele, North; North Ndebele",
      "hi-IN": "नॉर्थ न्यूडबेले",
      "de-DE": "Ndebele, Nord; Nord Ndebele",
      "pt-BR": "Ndebele, Norte; Norte Ndebele",
    },
  },
  {
    alpha2: "ne",
    label: {
      "en-US": "Nepali",
      "hi-IN": "नेपाली",
      "de-DE": "Nepali",
      "pt-BR": "Nepali",
    },
  },
  {
    alpha2: "ng",
    label: {
      "en-US": "Ndonga",
      "hi-IN": "नंडोंगा",
      "de-DE": "Ndonga",
      "pt-BR": "Ndonga",
    },
  },
  {
    alpha2: "nl",
    label: {
      "en-US": "Dutch; Flemish",
      "hi-IN": "डच; फ्लेमिंग",
      "de-DE": "Holländisch; Flämisch",
      "pt-BR": "Holandês; Flamengo",
    },
  },
  {
    alpha2: "nn",
    label: {
      "en-US": "Norwegian Nynorsk; Nynorsk, Norwegian",
      "hi-IN": "नॉर्वेजियन न्यूनोर्स्क; न्यूनोर्स्क, नॉर्वेजियन",
      "de-DE": "Norwegische Nynorsk; Nynorsk, Norwegisch",
      "pt-BR": "Norwegian Nynorsk; Nynorsk, Norueguês",
    },
  },
  {
    alpha2: "no",
    label: {
      "en-US": "Norwegian",
      "hi-IN": "नॉर्वेजियन",
      "de-DE": "Norwegisch",
      "pt-BR": "Norueguês",
    },
  },
  {
    alpha2: "nr",
    label: {
      "en-US": "Ndebele, South; South Ndebele",
      "hi-IN": "दक्षिण न्यूडबेले",
      "de-DE": "Ndebele, Süd; Süd Ndebele",
      "pt-BR": "Ndebele, Sul; Sul Ndebele",
    },
  },
  {
    alpha2: "nv",
    label: {
      "en-US": "Navajo; Navaho",
      "hi-IN": "नावाजो; नावाहो",
      "de-DE": "Navajo; Navaho",
      "pt-BR": "Navajo; Navaho",
    },
  },
  {
    alpha2: "ny",
    label: {
      "en-US": "Chichewa; Chewa; Nyanja",
      "hi-IN": "चिचेवा; चेवा; न्यान्जा",
      "de-DE": "Chichewa; Chewa; Nyanja",
      "pt-BR": "Chichewa; Chewa; Nyanja",
    },
  },
  {
    alpha2: "oc",
    label: {
      "en-US": "Occitan (post 1500)",
      "hi-IN": "ऑसिटन (पोस्ट 1500)",
      "de-DE": "Occitan (post 1500)",
      "pt-BR": "Occitano (pós 1500)",
    },
  },
  {
    alpha2: "oj",
    label: {
      "en-US": "Ojibwa",
      "hi-IN": "ओजिबवा",
      "de-DE": "Ojibwa",
      "pt-BR": "Ojibwa",
    },
  },
  {
    alpha2: "om",
    label: {
      "en-US": "Oromo",
      "hi-IN": "ओरोमो",
      "de-DE": "Oromo",
      "pt-BR": "Oromo",
    },
  },
  {
    alpha2: "or",
    label: {
      "en-US": "Oriya",
      "hi-IN": "ओरिया",
      "de-DE": "Oriya",
      "pt-BR": "Oriya",
    },
  },
  {
    alpha2: "os",
    label: {
      "en-US": "Ossetian; Ossetic",
      "hi-IN": "ओसेटियन; ओसेटिक",
      "de-DE": "Ossetian; Ossetic",
      "pt-BR": "Ossetiano; Ossético",
    },
  },
  {
    alpha2: "pa",
    label: {
      "en-US": "Panjabi; Punjabi",
      "hi-IN": "पंजाबी; पंजाबी",
      "de-DE": "Panjabi; Punjabi",
      "pt-BR": "Panjabi; Punjabi",
    },
  },
  {
    alpha2: "pi",
    label: {
      "en-US": "Pali",
      "hi-IN": "पाली",
      "de-DE": "Pali",
      "pt-BR": "Pali",
    },
  },
  {
    alpha2: "pl",
    label: {
      "en-US": "Polish",
      "hi-IN": "पोलिश",
      "de-DE": "Polnisch",
      "pt-BR": "Polonês",
    },
  },
  {
    alpha2: "ps",
    label: {
      "en-US": "Pushto; Pashto",
      "hi-IN": "पुष्टो; पास्तो",
      "de-DE": "Pushto; Pashto",
      "pt-BR": "Pushto; Pashto",
    },
  },
  {
    alpha2: "pt",
    label: {
      "en-US": "Portuguese",
      "hi-IN": "पुर्तगाली",
      "de-DE": "Portugiesisch",
      "pt-BR": "Português",
    },
  },
  {
    alpha2: "qu",
    label: {
      "en-US": "Quechua",
      "hi-IN": "क्विचुआ",
      "de-DE": "Quechua",
      "pt-BR": "Quechua",
    },
  },
  {
    alpha2: "rm",
    label: {
      "en-US": "Romansh",
      "hi-IN": "रोमान्स",
      "de-DE": "Rämisch",
      "pt-BR": "Romeno",
    },
  },
  {
    alpha2: "rn",
    label: {
      "en-US": "Rundi",
      "hi-IN": "रुंडी",
      "de-DE": "Rundi",
      "pt-BR": "Rundi",
    },
  },
  {
    alpha2: "ro",
    label: {
      "en-US": "Romanian; Moldavian; Moldovan",
      "hi-IN": "रोमानियन; मोल्डोवा; मोल्डोवन",
      "de-DE": "Rumänisch; Moldauisch; Moldauisch",
      "pt-BR": "Romeno; Moldavo; Moldavo",
    },
  },
  {
    alpha2: "ru",
    label: {
      "en-US": "Russian",
      "hi-IN": "रूसी",
      "de-DE": "Russisch",
      "pt-BR": "Russo",
    },
  },
  {
    alpha2: "rw",
    label: {
      "en-US": "Kinyarwanda",
      "hi-IN": "किन्यारवांडा",
      "de-DE": "Kinyarwanda",
      "pt-BR": "Kinyarwanda",
    },
  },
  {
    alpha2: "sa",
    label: {
      "en-US": "Sanskrit",
      "hi-IN": "संस्कृत",
      "de-DE": "Sanskrit",
      "pt-BR": "Sânscrito",
    },
  },
  {
    alpha2: "sc",
    label: {
      "en-US": "Sardinian",
      "hi-IN": "सार्डिनियन",
      "de-DE": "Sardisch",
      "pt-BR": "Sardo",
    },
  },
  {
    alpha2: "sd",
    label: {
      "en-US": "Sindhi",
      "hi-IN": "सिंधी",
      "de-DE": "Sindhi",
      "pt-BR": "Sindhi",
    },
  },
  {
    alpha2: "se",
    label: {
      "en-US": "Northern Sami",
      "hi-IN": "उत्तरी सामी",
      "de-DE": "Nordischer Sami",
      "pt-BR": "Sami do Norte",
    },
  },
  {
    alpha2: "sg",
    label: {
      "en-US": "Sango",
      "hi-IN": "सांगो",
      "de-DE": "Sango",
      "pt-BR": "Sango",
    },
  },
  {
    alpha2: "si",
    label: {
      "en-US": "Sinhala; Sinhalese",
      "hi-IN": "सिंहला; सिंहलेश",
      "de-DE": "Sinhala; Sinhalese",
      "pt-BR": "Sinhala; Sinhalese",
    },
  },
  {
    alpha2: "sk",
    label: {
      "en-US": "Slovak",
      "hi-IN": "स्लोवाक",
      "de-DE": "Slowakisch",
      "pt-BR": "Eslovaco",
    },
  },
  {
    alpha2: "sl",
    label: {
      "en-US": "Slovenian",
      "hi-IN": "स्लोवेनियन",
      "de-DE": "Slowenisch",
      "pt-BR": "Esloveno",
    },
  },
  {
    alpha2: "sm",
    label: {
      "en-US": "Samoan",
      "hi-IN": "सामोआन",
      "de-DE": "Samoan",
      "pt-BR": "Samoano",
    },
  },
  {
    alpha2: "sn",
    label: {
      "en-US": "Shona",
      "hi-IN": "शोना",
      "de-DE": "Shona",
      "pt-BR": "Shona",
    },
  },
  {
    alpha2: "so",
    label: {
      "en-US": "Somali",
      "hi-IN": "सोमाली",
      "de-DE": "Somali",
      "pt-BR": "Somali",
    },
  },
  {
    alpha2: "sq",
    label: {
      "en-US": "Albanian",
      "hi-IN": "अल्बानियन",
      "de-DE": "Albanisch",
      "pt-BR": "Albânico",
    },
  },
  {
    alpha2: "sr",
    label: {
      "en-US": "Serbian",
      "hi-IN": "सर्बियन",
      "de-DE": "Serbisch",
      "pt-BR": "Sérvio",
    },
  },
  {
    alpha2: "ss",
    label: {
      "en-US": "Swati",
      "hi-IN": "स्वाती",
      "de-DE": "Swati",
      "pt-BR": "Swati",
    },
  },
  {
    alpha2: "st",
    label: {
      "en-US": "Sotho, Southern",
      "hi-IN": "सोथो, दक्षिणी",
      "de-DE": "Sotho, Süd",
      "pt-BR": "Sotho, Sul",
    },
  },
  {
    alpha2: "su",
    label: {
      "en-US": "Sundanese",
      "hi-IN": "सुंडानी",
      "de-DE": "Sundanesisch",
      "pt-BR": "Sundanês",
    },
  },
  {
    alpha2: "sv",
    label: {
      "en-US": "Swedish",
      "hi-IN": "स्वीडीश",
      "de-DE": "Schwedisch",
      "pt-BR": "Sueco",
    },
  },
  {
    alpha2: "sw",
    label: {
      "en-US": "Swahili",
      "hi-IN": "स्वाहिली",
      "de-DE": "Swahili",
      "pt-BR": "Swahili",
    },
  },
  {
    alpha2: "ta",
    label: {
      "en-US": "Tamil",
      "hi-IN": "तामिल",
      "de-DE": "Tamil",
      "pt-BR": "Tâmil",
    },
  },
  {
    alpha2: "te",
    label: {
      "en-US": "Telugu",
      "hi-IN": "तेलुगु",
      "de-DE": "Telugu",
      "pt-BR": "Telugu",
    },
  },
  {
    alpha2: "tg",
    label: {
      "en-US": "Tajik",
      "hi-IN": "ताजिक",
      "de-DE": "Tadschikisch",
      "pt-BR": "Tajique",
    },
  },
  {
    alpha2: "th",
    label: {
      "en-US": "Thai",
      "hi-IN": "थाइ",
      "de-DE": "Thai",
      "pt-BR": "Tailandês",
    },
  },
  {
    alpha2: "ti",
    label: {
      "en-US": "Tigrinya",
      "hi-IN": "तिग्रिन्या",
      "de-DE": "Tigrinya",
      "pt-BR": "Tigrinya",
    },
  },
  {
    alpha2: "tk",
    label: {
      "en-US": "Turkmen",
      "hi-IN": "तुर्कमेन",
      "de-DE": "Turkmenisch",
      "pt-BR": "Turcomano",
    },
  },
  {
    alpha2: "tl",
    label: {
      "en-US": "Tagalog",
      "hi-IN": "तागालोग",
      "de-DE": "Tagalog",
      "pt-BR": "Tagalo",
    },
  },
  {
    alpha2: "tn",
    label: {
      "en-US": "Tswana",
      "hi-IN": "त्स्वाना",
      "de-DE": "Tswana",
      "pt-BR": "Tswana",
    },
  },
  {
    alpha2: "to",
    label: {
      "en-US": "Tonga (Tonga Islands)",
      "hi-IN": "तोंगा (तोंगा द्वीप)",
      "de-DE": "Tonga (Tonga-Inseln)",
      "pt-BR": "Tonga (Ilhas Tonga)",
    },
  },
  {
    alpha2: "tr",
    label: {
      "en-US": "Turkish",
      "hi-IN": "तुर्की",
      "de-DE": "Türkisch",
      "pt-BR": "Turco",
    },
  },
  {
    alpha2: "ts",
    label: {
      "en-US": "Tsonga",
      "hi-IN": "त्सोंगा",
      "de-DE": "Tsonga",
      "pt-BR": "Tsonga",
    },
  },
  {
    alpha2: "tt",
    label: {
      "en-US": "Tatar",
      "hi-IN": "ताटार",
      "de-DE": "Tatarisch",
      "pt-BR": "Tatar",
    },
  },
  {
    alpha2: "tw",
    label: {
      "en-US": "Twi",
      "hi-IN": "त्वी",
      "de-DE": "Twi",
      "pt-BR": "Twi",
    },
  },
  {
    alpha2: "ty",
    label: {
      "en-US": "Tahitian",
      "hi-IN": "ताहिटियन",
      "de-DE": "Tahitisch",
      "pt-BR": "Tahitiano",
    },
  },
  {
    alpha2: "ug",
    label: {
      "en-US": "Uighur; Uyghur",
      "hi-IN": "उइगुर; उइगुर",
      "de-DE": "Uighur; Uyghur",
      "pt-BR": "Uigur; Uigur",
    },
  },
  {
    alpha2: "uk",
    label: {
      "en-US": "Ukrainian",
      "hi-IN": "युक्रेनियन",
      "de-DE": "Ukrainisch",
      "pt-BR": "Ucraniano",
    },
  },
  {
    alpha2: "ur",
    label: {
      "en-US": "Urdu",
      "hi-IN": "उर्दू",
      "de-DE": "Urdu",
      "pt-BR": "Urdu",
    },
  },
  {
    alpha2: "uz",
    label: {
      "en-US": "Uzbek",
      "hi-IN": "उज़बेक",
      "de-DE": "Usbekisch",
      "pt-BR": "Usbeque",
    },
  },
  {
    alpha2: "ve",
    label: {
      "en-US": "Venda",
      "hi-IN": "वेंडा",
      "de-DE": "Venda",
      "pt-BR": "Venda",
    },
  },
  {
    alpha2: "vi",
    label: {
      "en-US": "Vietnamese",
      "hi-IN": "वियतनामी",
      "de-DE": "Vietnamesisch",
      "pt-BR": "Vietnamita",
    },
  },
  {
    alpha2: "vo",
    label: {
      "en-US": "Volapük",
      "hi-IN": "वोलापुक",
      "de-DE": "Volapük",
      "pt-BR": "Volapük",
    },
  },
  {
    alpha2: "wa",
    label: {
      "en-US": "Walloon",
      "hi-IN": "वालोन",
      "de-DE": "Wallonisch",
      "pt-BR": "Valão",
    },
  },
  {
    alpha2: "wo",
    label: {
      "en-US": "Wolof",
      "hi-IN": "वोलोफ",
      "de-DE": "Wolof",
      "pt-BR": "Wolof",
    },
  },
  {
    alpha2: "xh",
    label: {
      "en-US": "Xhosa",
      "hi-IN": "झोसा",
      "de-DE": "Xhosa",
      "pt-BR": "Xhosa",
    },
  },
  {
    alpha2: "yi",
    label: {
      "en-US": "Yiddish",
      "hi-IN": "यिद्दिश",
      "de-DE": "Jiddisch",
      "pt-BR": "Iídiche",
    },
  },
  {
    alpha2: "yo",
    label: {
      "en-US": "Yoruba",
      "hi-IN": "योरुवा",
      "de-DE": "Yoruba",
      "pt-BR": "Iorubá",
    },
  },
  {
    alpha2: "za",
    label: {
      "en-US": "Zhuang; Chuang",
      "hi-IN": "चुंग",
      "de-DE": "Zhuang; Chuang",
      "pt-BR": "Zhuang; Chuang",
    },
  },
  {
    alpha2: "zh-Hans",
    label: {
      "en-US": "Chinese (Simplified)",
      "hi-IN": "चीनी (सरल)",
      "de-DE": "Chinesisch (Vereinfacht)",
      "pt-BR": "Chinês (Simplificado)",
    },
  },
  {
    alpha2: "zh-Hant",
    label: {
      "en-US": "Chinese (Traditional)",
      "hi-IN": "चीनी (प्रतिलिपि)",
      "de-DE": "Chinesisch (Traditionell)",
      "pt-BR": "Chinês (Tradicional)",
    },
  },
  {
    alpha2: "zu",
    label: {
      "en-US": "Zulu",
      "hi-IN": "जुलु",
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
  function addLanguageKeys(obj: { default: string; [key: string]: string }) {
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
      "hi-IN": "अंग्रेज़ी (यूएस)",
      "de-DE": "Englisch (US)",
      "pt-BR": "Inglês (EUA)",
    },
  },
  {
    code: "de-DE",
    label: {
      "en-US": "German",
      "hi-IN": "जर्मन",
      "de-DE": "Deutsch",
      "pt-BR": "Alemão",
    },
  },
  {
    code: "hi-IN",
    label: {
      "en-US": "Hindi",
      "hi-IN": "हिंदी",
      "de-DE": "Hindi",
      "pt-BR": "Hindi",
    },
  },
  {
    code: "pt-BR",
    label: {
      "en-US": "Portuguese (Brazil)",
      "hi-IN": "पुर्तगाली (ब्राज़ील)",
      "de-DE": "Portugiesisch (Brasilien)",
      "pt-BR": "Português (Brasil)",
    },
  },
];
