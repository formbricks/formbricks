import { type Locale, formatDistance, intlFormat } from "date-fns";
import { de, enUS, es, fr, hu, ja, nl, pt, ptBR, ro, ru, sv, zhCN, zhTW } from "date-fns/locale";
import { TUserLocale } from "@formbricks/types/user";
import { formatDateForDisplay, formatDateTimeForDisplay } from "./utils/datetime";

const DEFAULT_LOCALE: TUserLocale = "en-US";
const TIME_SINCE_LOCALES: Record<TUserLocale, Locale> = {
  "de-DE": de,
  "en-US": enUS,
  "es-ES": es,
  "fr-FR": fr,
  "hu-HU": hu,
  "ja-JP": ja,
  "nl-NL": nl,
  "pt-BR": ptBR,
  "pt-PT": pt,
  "ro-RO": ro,
  "ru-RU": ru,
  "sv-SE": sv,
  "zh-Hans-CN": zhCN,
  "zh-Hant-TW": zhTW,
};

const isUserLocale = (locale: string): locale is TUserLocale => Object.hasOwn(TIME_SINCE_LOCALES, locale);

export const convertDateString = (dateString: string | null, locale: string = DEFAULT_LOCALE) => {
  if (dateString === null) return null;
  if (!dateString) {
    return dateString;
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return "Invalid Date";
  }
  return formatDateForDisplay(date, locale);
};

export const convertDateTimeString = (dateString: string, locale: string = DEFAULT_LOCALE) => {
  if (!dateString) {
    return dateString;
  }
  const date = new Date(dateString);
  return formatDateTimeForDisplay(date, locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const convertDateTimeStringShort = (dateString: string, locale: string = DEFAULT_LOCALE) => {
  if (!dateString) {
    return dateString;
  }
  const date = new Date(dateString);
  return intlFormat(
    date,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
    {
      locale,
    }
  );
};

export const convertTimeString = (dateString: string, locale: string = DEFAULT_LOCALE) => {
  const date = new Date(dateString);
  return intlFormat(
    date,
    {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    },
    {
      locale,
    }
  );
};

/** Maps locale strings to date-fns locales and falls back to English for unsupported inputs. */
const getLocaleForTimeSince = (locale: string): Locale =>
  isUserLocale(locale) ? TIME_SINCE_LOCALES[locale] : enUS;

export const timeSince = (dateString: string, locale: string = DEFAULT_LOCALE) => {
  const date = new Date(dateString);
  return formatDistance(date, new Date(), {
    addSuffix: true,
    locale: getLocaleForTimeSince(locale),
  });
};

export const timeSinceDate = (date: Date, locale: string = DEFAULT_LOCALE) => {
  return formatDistance(date, new Date(), {
    addSuffix: true,
    locale: getLocaleForTimeSince(locale),
  });
};

export const formatDate = (date: Date, locale: string = DEFAULT_LOCALE) => {
  return formatDateForDisplay(date, locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const getTodaysDateFormatted = (seperator: string) => {
  const date = new Date();
  const formattedDate = date.toISOString().split("T")[0].split("-").join(seperator);

  return formattedDate;
};

export const getTodaysDateTimeFormatted = (seperator: string) => {
  const date = new Date();
  const formattedDate = date.toISOString().split("T")[0].split("-").join(seperator);
  const formattedTime = date.toTimeString().split(" ")[0].split(":").join(seperator);

  return [formattedDate, formattedTime].join(seperator);
};

export const convertDatesInObject = <T>(obj: T, keysToIgnore?: Set<string>): T => {
  if (obj === null || typeof obj !== "object") {
    return obj; // Return if obj is not an object
  }
  if (Array.isArray(obj)) {
    // Handle arrays by mapping each element through the function
    return obj.map((item) => convertDatesInObject(item, keysToIgnore)) as unknown as T;
  }
  const newObj: Record<string, unknown> = {};
  for (const key in obj) {
    if (keysToIgnore?.has(key)) {
      newObj[key] = obj[key];
      continue;
    }
    if (
      (key === "createdAt" || key === "updatedAt") &&
      typeof obj[key] === "string" &&
      !isNaN(Date.parse(obj[key] as unknown as string))
    ) {
      newObj[key] = new Date(obj[key] as unknown as string);
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      newObj[key] = convertDatesInObject(obj[key], keysToIgnore);
    } else {
      newObj[key] = obj[key];
    }
  }
  return newObj as T;
};
