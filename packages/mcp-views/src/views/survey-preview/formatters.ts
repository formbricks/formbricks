import type { Formatters } from "./outline";

/**
 * Dates and numbers in the host's locale and time zone (`hostContext`), falling back to the runtime's own
 * when the host sends none or sends one `Intl` rejects.
 */
export const createFormatters = (locale: string | undefined, timeZone: string | undefined): Formatters => {
  const build = <T>(make: (locale: string | undefined, timeZone: string | undefined) => T, fallback: () => T): T => {
    try {
      return make(locale, timeZone);
    } catch {
      return fallback();
    }
  };
  const dateFormat = build(
    (loc, zone) => new Intl.DateTimeFormat(loc, { dateStyle: "medium", timeStyle: "short", timeZone: zone }),
    () => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })
  );
  const numberFormat = build(
    (loc) => new Intl.NumberFormat(loc),
    () => new Intl.NumberFormat()
  );
  return {
    date: (iso) => {
      const date = new Date(iso);
      return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date);
    },
    number: (value) => numberFormat.format(value),
  };
};
