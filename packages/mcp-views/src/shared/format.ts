/** Locale and time zone the host reports (`hostContext.locale`, `hostContext.timeZone`). Both are optional. */
export interface FormatContext {
  locale?: string;
  timeZone?: string;
}

/** Shown when the host sends no locale, or one the runtime's `Intl` rejects. Never the browser's own. */
const FALLBACK_LOCALE = "en-US";

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * A cached `Intl.NumberFormat`. An unknown locale falls back to `en-US` instead of throwing inside render,
 * and an absent one never means "whatever the browser uses".
 */
export const numberFormat = (
  locale: string | undefined,
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat => {
  const key = `${locale ?? ""}|${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (!format) {
    try {
      format = new Intl.NumberFormat(locale ?? FALLBACK_LOCALE, options);
    } catch {
      format = new Intl.NumberFormat(FALLBACK_LOCALE, options);
    }
    numberFormats.set(key, format);
  }
  return format;
};

/**
 * A cached `Intl.DateTimeFormat`. The host's zone is used when given; a locale or zone `Intl` rejects falls
 * back to `en-US` and UTC.
 */
export const dateFormat = (
  { locale, timeZone }: FormatContext,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat => {
  const key = `${locale ?? ""}|${timeZone ?? ""}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat(locale ?? FALLBACK_LOCALE, { ...options, timeZone });
    } catch {
      format = new Intl.DateTimeFormat(FALLBACK_LOCALE, { ...options, timeZone: "UTC" });
    }
    dateFormats.set(key, format);
  }
  return format;
};

export const formatNumber = (
  value: number,
  { locale }: FormatContext = {},
  options: Intl.NumberFormatOptions = {}
): string => numberFormat(locale, options).format(value);

/** "Oct 28, 2026, 9:05 AM" in the host's locale and zone; the raw text when `iso` is not a date. */
export const formatDateTime = (iso: string, context: FormatContext = {}): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return dateFormat(context, { dateStyle: "medium", timeStyle: "short" }).format(date);
};
