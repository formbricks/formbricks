import { headers } from "next/headers";
import { TUserLocale } from "@formbricks/types/user";
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from "@/lib/constants";
import { parseAcceptLanguage } from "@/lib/utils/accept-language";

/**
 * The respondent's languages from the request's Accept-Language header, most preferred first. Reading
 * the header makes the calling route dynamic, so the page is rendered per request, never shared.
 */
export const getAcceptedLanguages = async (): Promise<string[]> => {
  const headersList = await headers();
  return parseAcceptLanguage(headersList.get("accept-language"));
};

export const findMatchingLocale = async (): Promise<TUserLocale> => {
  const headersList = await headers();
  const acceptLanguage = headersList.get("accept-language");
  const userLocales = acceptLanguage?.split(",");
  if (!userLocales) {
    return DEFAULT_LOCALE;
  }
  // First, try to find an exact match without normalization
  for (const userLocale of userLocales) {
    const exactMatch = AVAILABLE_LOCALES.find((locale) => locale === userLocale);
    if (exactMatch) return exactMatch;
  }
  // If no exact match is found, try matching with normalization
  const normalizedAvailableLocales = AVAILABLE_LOCALES.map((locale) => locale.toLowerCase().split("-")[0]);

  for (const userLocale of userLocales) {
    const normalizedUserLocale = userLocale.toLowerCase().split("-")[0];
    const matchedIndex = normalizedAvailableLocales.findIndex((locale) =>
      locale.startsWith(normalizedUserLocale)
    );
    if (matchedIndex !== -1) return AVAILABLE_LOCALES[matchedIndex];
  }

  return DEFAULT_LOCALE;
};
