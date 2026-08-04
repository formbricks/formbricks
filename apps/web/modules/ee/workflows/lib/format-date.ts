import type { TFunction } from "i18next";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The calendar day `date` falls on in `timeZone`, keyed as the UTC midnight of that y/m/d. Keys are
 * exact multiples of a day apart, so subtracting two keys yields a calendar-day difference — unlike
 * elapsed-ms division, which drifts across midnight boundaries.
 */
const calendarDayKey = (date: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: "year" | "month" | "day"): number =>
    Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"));
};

/**
 * Formats `iso` as a short relative timestamp ("Today, 4:23 PM" / "Yesterday, 1:00 PM" /
 * "2 days ago, 8:15 AM" / "Jan 15, 4:23 PM"). `anchor` is the "now" reference — using a passed-in
 * anchor (vs. `new Date()`) keeps placeholder data deterministic and avoids SSR/CSR drift. The
 * `t` function localizes the relative tokens; the time and date parts use `Intl` with the user's
 * locale. Today/Yesterday/N-days-ago are calendar days in the supplied `timeZone` — the same zone
 * the rendered time uses — never the machine's local zone.
 */
export const formatRelativeDate = (
  iso: string,
  anchor: Date,
  t: TFunction,
  locale = "en-US",
  timeZone = "UTC"
): string => {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", timeZone });

  const diffDays = Math.round(
    (calendarDayKey(anchor, timeZone) - calendarDayKey(date, timeZone)) / ONE_DAY_MS
  );

  if (diffDays === 0) {
    return t("workspace.workflows.relative_today", { time });
  }

  if (diffDays === 1) {
    return t("workspace.workflows.relative_yesterday", { time });
  }

  if (diffDays >= 2 && diffDays < 7) {
    return t("workspace.workflows.relative_days_ago", { count: diffDays, time });
  }

  const datePart = date.toLocaleDateString(locale, { month: "short", day: "numeric", timeZone });
  return t("workspace.workflows.relative_date", { date: datePart, time });
};
