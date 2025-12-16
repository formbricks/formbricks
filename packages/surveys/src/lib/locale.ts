import { type Locale } from "date-fns";
import { enUS } from "date-fns/locale/en-US";

/**
 * Lazy loads date-fns locales based on the language code.
 * Falls back to en-US if the locale is not found.
 */
export async function loadLocale(localeCode?: string): Promise<Locale> {
  if (!localeCode) {
    return enUS;
  }

  const normalized = localeCode.toLowerCase();

  try {
    // Handle special cases for full locale codes
    if (normalized.startsWith("pt-br")) {
      return (await import("date-fns/locale/pt-BR")).ptBR;
    }
    if (normalized.startsWith("pt")) {
      return (await import("date-fns/locale/pt")).pt;
    }
    if (normalized.startsWith("zh-hans") || normalized === "zh-cn") {
      return (await import("date-fns/locale/zh-CN")).zhCN;
    }
    if (normalized.startsWith("zh-hant") || normalized === "zh-tw") {
      return (await import("date-fns/locale/zh-TW")).zhTW;
    }

    const baseCode = normalized.split("-")[0];

    switch (baseCode) {
      case "de":
        return (await import("date-fns/locale/de")).de;
      case "es":
        return (await import("date-fns/locale/es")).es;
      case "fr":
        return (await import("date-fns/locale/fr")).fr;
      case "ja":
        return (await import("date-fns/locale/ja")).ja;
      case "nl":
        return (await import("date-fns/locale/nl")).nl;
      case "ro":
        return (await import("date-fns/locale/ro")).ro;
      case "ar":
        return (await import("date-fns/locale/ar")).ar;
      case "it":
        return (await import("date-fns/locale/it")).it;
      case "ru":
        return (await import("date-fns/locale/ru")).ru;
      case "uz":
        return (await import("date-fns/locale/uz")).uz;
      case "hi":
        return (await import("date-fns/locale/hi")).hi;
      default:
        return enUS;
    }
  } catch (error) {
    console.warn(`Failed to load locale: ${localeCode}, falling back to en-US`);
    return enUS;
  }
}
