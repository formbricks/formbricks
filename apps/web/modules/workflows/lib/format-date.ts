import type { TFunction } from "i18next";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const isSameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Formats `iso` as a short relative timestamp ("Today, 4:23 PM" / "Yesterday, 1:00 PM" /
 * "2 days ago, 8:15 AM" / "Jan 15, 4:23 PM"). `anchor` is the "now" reference — using a passed-in
 * anchor (vs. `new Date()`) keeps placeholder data deterministic and avoids SSR/CSR drift. The
 * `t` function localizes the relative tokens; the time and date parts use `Intl` with the user's
 * locale.
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

  if (isSameLocalDay(date, anchor)) {
    return t("workspace.workflows.relative_today", { time });
  }

  const yesterday = new Date(anchor);
  yesterday.setDate(anchor.getDate() - 1);
  if (isSameLocalDay(date, yesterday)) {
    return t("workspace.workflows.relative_yesterday", { time });
  }

  const diffDays = Math.floor((anchor.getTime() - date.getTime()) / ONE_DAY_MS);
  if (diffDays >= 2 && diffDays < 7) {
    return t("workspace.workflows.relative_days_ago", { count: diffDays, time });
  }

  const datePart = date.toLocaleDateString(locale, { month: "short", day: "numeric", timeZone });
  return t("workspace.workflows.relative_date", { date: datePart, time });
};
