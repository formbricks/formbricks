import { type Locale } from "date-fns";
import { ar, de, enUS, es, fr, hi, it, ja, nl, pt, ptBR, ro, ru, uz, zhCN, zhTW } from "date-fns/locale";

/**
 * Maps locale codes to date-fns locale objects
 * Supports survey language codes (e.g., "en", "de", "ar", "zh-Hans") and
 * common locale formats (e.g., "en-US", "de-DE", etc.)
 */
export function getDateFnsLocale(localeCode?: string): Locale {
  if (!localeCode) {
    return enUS; // Default to English (US)
  }

  const normalized = localeCode.toLowerCase();

  // Handle special cases for full locale codes first
  if (normalized.startsWith("pt-br")) {
    return ptBR;
  }
  if (normalized.startsWith("pt-pt")) {
    return pt;
  }
  if (normalized.startsWith("zh-hans") || normalized === "zh-cn") {
    return zhCN;
  }
  if (normalized.startsWith("zh-hant") || normalized === "zh-tw" || normalized === "zh-hk") {
    return zhTW;
  }

  // Extract base language code (e.g., "en-US" -> "en", "de-DE" -> "de")
  const baseCode = normalized.split("-")[0];

  // Map survey language codes to date-fns locales
  const localeMap: Record<string, Locale> = {
    en: enUS,
    de,
    es,
    fr,
    ja,
    nl,
    pt: ptBR, // Default Portuguese to Brazilian
    ro,
    ar,
    it,
    ru,
    uz,
    hi,
    zh: zhCN, // Default Chinese to Simplified
  };

  return localeMap[baseCode] ?? enUS;
}
