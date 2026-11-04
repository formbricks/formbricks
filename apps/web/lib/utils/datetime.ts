import { type Locale } from "date-fns";
import { de, enUS, es, fr, hu, ja, nl, pt, ptBR, ro, ru, sv, tr, zhCN, zhTW } from "date-fns/locale";

const DEFAULT_LOCALE = "en-US";

const DEFAULT_DATE_DISPLAY_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

/** The app's day format: the date picker's and Embedded Data's ("Nov 4, 2026", "4 Nov 2026"). */
export const DATE_DISPLAY_OPTIONS: Intl.DateTimeFormatOptions = DEFAULT_DATE_DISPLAY_OPTIONS;

const DEFAULT_DATE_TIME_DISPLAY_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

// Helper function to calculate difference in days between two dates
export const diffInDays = (date1: Date, date2: Date) => {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

export const formatDateForDisplay = (
  date: Date,
  locale: string = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_DISPLAY_OPTIONS
): string => {
  return new Intl.DateTimeFormat(locale, options).format(date);
};

export const formatDateTimeForDisplay = (
  date: Date,
  locale: string = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_TIME_DISPLAY_OPTIONS
): string => {
  return new Intl.DateTimeFormat(locale, options).format(date);
};

const STORED_CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
// The shape of an ISO timestamp; `Date` decides the rest (a value it can't read is not one).
const STORED_TIMESTAMP_START = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * A stored date value as people read it (P65): a calendar date (`2026-11-04`) as that day only, in
 * the app's day format; a timestamp (`now()`, `2026-11-04T10:12:30.000Z`) as the same day format
 * plus the time, in the viewer's time zone (`timeZone`, else the runtime's). `null` for anything
 * else, so the caller shows the value as it is. Callers keep the stored value as a tooltip.
 */
export const formatStoredDateValue = (
  value: string,
  locale: string = DEFAULT_LOCALE,
  timeZone?: string
): string | null => {
  if (STORED_CALENDAR_DATE.test(value)) {
    // Read as UTC midnight and shown in UTC: the day named, not the day it is somewhere else.
    const day = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== value) return null;
    return formatDateForDisplay(day, locale, { ...DATE_DISPLAY_OPTIONS, timeZone: "UTC" });
  }
  if (!STORED_TIMESTAMP_START.test(value)) return null;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  return formatDateTimeForDisplay(instant, locale, {
    ...DATE_DISPLAY_OPTIONS,
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
};

export const formatDateWithOrdinal = (date: Date, locale: string = DEFAULT_LOCALE): string => {
  return formatDateForDisplay(date, locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const isValidDateString = (value: string) => {
  const regex = /^(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}-\d{1,2}-\d{4})$/;

  if (!regex.test(value)) {
    return false;
  }

  const normalizedValue = /^\d{1,2}-\d{1,2}-\d{4}$/.test(value)
    ? value.replace(/(\d{1,2})-(\d{1,2})-(\d{4})/, "$3-$2-$1")
    : value;

  const date = new Date(normalizedValue);
  return !Number.isNaN(date.getTime());
};

export const getFormattedDateTimeString = (date: Date, timeZone: string = "UTC"): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    // Append the zone (e.g. "UTC", "GMT+8") so every exported/integrated Timestamp is
    // self-describing: rows written under different org settings stay distinguishable,
    // and downstream ETL never has to guess the zone.
    timeZoneName: "short",
    timeZone,
  };

  // An invalid IANA zone makes Intl.DateTimeFormat throw a RangeError. Degrade to UTC
  // rather than failing the entire export or integration delivery.
  try {
    return new Intl.DateTimeFormat("en-CA", options).format(date).replace(",", "");
  } catch {
    return new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "UTC" }).format(date).replace(",", "");
  }
};

/**
 * Maps an app locale code to the date-fns locale the calendar needs for month names, weekday headers
 * and the first day of the week.
 *
 * `Intl` (which the formatters above use) takes the BCP 47 tag directly, but `react-day-picker` wants a
 * date-fns `Locale` object, so the app's locale codes have to be mapped explicitly. The keys mirror
 * `apps/web/locales/*.json`; anything else — including a survey language code that never became an app
 * locale — falls back to en-US rather than throwing.
 */
export const getDateFnsLocale = (localeCode?: string): Locale => {
  if (!localeCode) return enUS;

  const normalized = localeCode.toLowerCase();

  // Script-and-region-specific tags first: these do not survive being cut down to a base language
  // (pt-BR and pt-PT differ, and zh-Hans/zh-Hant are different scripts, not different regions).
  if (normalized.startsWith("pt-br")) return ptBR;
  if (normalized.startsWith("pt-pt")) return pt;
  if (normalized.startsWith("zh-hans") || normalized === "zh-cn") return zhCN;
  if (normalized.startsWith("zh-hant") || normalized === "zh-tw" || normalized === "zh-hk") return zhTW;

  const localeMap: Record<string, Locale> = {
    de,
    en: enUS,
    es,
    fr,
    hu,
    ja,
    nl,
    pt: ptBR, // Bare "pt" is ambiguous; Brazilian is the larger audience and matches the survey packages.
    ro,
    ru,
    sv,
    tr,
    zh: zhCN,
  };

  return localeMap[normalized.split("-")[0]] ?? enUS;
};

/**
 * Serialises a local calendar day as `yyyy-MM-dd`.
 *
 * Machine-facing on purpose — this is the value chart and dashboard time filters hand to Cube — so it
 * stays non-localized. Deliberately not `toISOString().slice(0, 10)`: that converts to UTC first, so
 * a user east of UTC would emit tomorrow's date and one west of it yesterday's.
 */
export const formatLocalDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/**
 * Parses a `yyyy-MM-dd` day back to local midnight — the inverse of `formatLocalDay`.
 *
 * `new Date("2026-08-05")` parses as UTC midnight, which displays (and re-emits) a day earlier for
 * anyone west of UTC, so the value is rebuilt from its parts to keep the round trip symmetric.
 */
export const parseLocalDay = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
};

/**
 * Parses a stored date value — a bare `yyyy-MM-dd` or a full ISO timestamp — to the local midnight of
 * the calendar day it names, or `null` when it names none.
 *
 * The time part is dropped before parsing rather than handed to `Date`: a stored
 * `2026-08-05T00:00:00.000Z` is the 5th as written, and reading it as an instant would select the 4th
 * for any viewer west of UTC. Round-tripping through `formatLocalDay` accepts exactly the values an
 * `<input type="date">` did, so a value that predates the picker still renders, a rolled-over one
 * (`2026-13-45`) is refused rather than silently shown as a different day, and an unparseable one
 * yields `null` instead of the Invalid Date that would break the calendar.
 *
 * Only the day is validated, so a well-formed day followed by a malformed time still resolves to that
 * day. That is deliberate: the day is the part a date picker shows, these values can arrive from the
 * Management API rather than only from this UI, and the `<input type="date">` this replaced split on
 * `T` the same way — blanking a readable day over a broken time suffix would lose information.
 */
export const parseStoredDay = (value: string | null | undefined): Date | null => {
  if (!value) return null;

  const day = value.split("T")[0];
  const parsed = parseLocalDay(day);

  return formatLocalDay(parsed) === day ? parsed : null;
};
