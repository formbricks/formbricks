/**
 * Dates and durations for the view. Locale and time zone come from the host (`hostContext.locale`,
 * `hostContext.timeZone`); a value the runtime rejects falls back to its defaults rather than throwing
 * inside render.
 */
export const formatDateTime = (iso: string, locale?: string, timeZone?: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const format = (formatLocale: string | undefined, formatTimeZone: string | undefined): string =>
    new Intl.DateTimeFormat(formatLocale, {
      dateStyle: "medium",
      timeStyle: "short",
      ...(formatTimeZone ? { timeZone: formatTimeZone } : {}),
    }).format(date);

  try {
    return format(locale, timeZone);
  } catch {
    // The host sent a locale or time zone this runtime does not know: UTC in the default locale.
    return format(undefined, "UTC");
  }
};

/** "850 ms", "4.2 s", "3 min 5 s", "2 h 10 min". */
export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${Number(seconds.toFixed(1))} s`;
  const totalSeconds = Math.round(seconds);
  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60);
    const rest = totalSeconds % 60;
    return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
};
