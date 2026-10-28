import type { ListQuery, SortBy } from "./types";

export type StatusFilter = "all" | "finished" | "partial";

/** A day the person picked, plus the exact instant the model asked for when the day is unchanged. */
export interface DayBound {
  /** `YYYY-MM-DD`, or empty for no bound. */
  day: string;
  /** Kept only while `day` is untouched, so a non-midnight bound from the model survives a re-query. */
  iso?: string;
}

export interface Filters {
  status: StatusFilter;
  from: DayBound;
  to: DayBound;
  sortBy: SortBy;
}

/** The status a `<select>` value names, or `undefined` for anything else. */
export const parseStatusFilter = (value: string): StatusFilter | undefined =>
  value === "all" || value === "finished" || value === "partial" ? value : undefined;

/** The sort order a `<select>` value names, or `undefined` for anything else. */
export const parseSortBy = (value: string): SortBy | undefined =>
  value === "-createdAt" || value === "createdAt" ? value : undefined;

export const EMPTY_BOUND: DayBound = { day: "" };

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const safeTimeZone = (timeZone: string): string => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
};

const wallClockParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
};

/** `YYYY-MM-DD` of an instant on the calendar of `timeZone`. */
export const toDayString = (iso: string, timeZone: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const { year, month, day } = wallClockParts(date, safeTimeZone(timeZone));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const isRealDay = (year: number, month: number, day: number): boolean => {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
};

/**
 * The first (`start`) or last (`end`) millisecond of a calendar day in `timeZone`, as a UTC ISO string
 * (the only spelling the v3 date filters accept). Locale never enters into it: the zone alone decides
 * which instant "the 14th" begins at. Returns `undefined` for anything that is not a real day.
 */
export const dayBoundary = (day: string, timeZone: string, edge: "start" | "end"): string | undefined => {
  const match = DAY_PATTERN.exec(day);
  if (!match) return undefined;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (!isRealDay(year, month, date)) return undefined;

  const zone = safeTimeZone(timeZone);
  const [h, mi, s, ms] = edge === "start" ? [0, 0, 0, 0] : [23, 59, 59, 999];
  const wall = Date.UTC(year, month - 1, date, h, mi, s, ms);

  // The zone's offset depends on the instant being asked about, so converge on it: two passes settle
  // every real zone, including the days a clock change falls on.
  const offsetAt = (at: number): number => {
    const seen = wallClockParts(new Date(at), zone);
    return (
      Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second) -
      Math.floor(at / 1000) * 1000
    );
  };
  let instant = wall;
  for (let pass = 0; pass < 2; pass += 1) {
    instant = wall - offsetAt(instant);
  }
  return new Date(instant).toISOString();
};

export const filtersFromQuery = (query: ListQuery, timeZone: string): Filters => ({
  status: query.finished === undefined ? "all" : query.finished ? "finished" : "partial",
  from: query.createdAtGte
    ? { day: toDayString(query.createdAtGte, timeZone), iso: query.createdAtGte }
    : EMPTY_BOUND,
  to: query.createdAtLte
    ? { day: toDayString(query.createdAtLte, timeZone), iso: query.createdAtLte }
    : EMPTY_BOUND,
  sortBy: query.sortBy,
});

export const defaultFilters = (sortBy: SortBy): Filters => ({
  status: "all",
  from: EMPTY_BOUND,
  to: EMPTY_BOUND,
  sortBy,
});

/** True when anything narrows the list beyond "every response, newest first". */
export const isFiltered = (filters: Filters): boolean =>
  filters.status !== "all" || filters.from.day !== "" || filters.to.day !== "";

/** What is wrong with the filters, in words the person can act on, or `undefined` when they are fine. */
export const validateFilters = (filters: Filters, timeZone: string): string | undefined => {
  const { from, to } = filters;
  if (from.day !== "" && dayBoundary(from.day, timeZone, "start") === undefined) {
    return "Enter the start date as a real day.";
  }
  if (to.day !== "" && dayBoundary(to.day, timeZone, "end") === undefined) {
    return "Enter the end date as a real day.";
  }
  if (from.day !== "" && to.day !== "" && from.day > to.day) {
    return "The start date is after the end date.";
  }
  return undefined;
};

const resolveBound = (bound: DayBound, timeZone: string, edge: "start" | "end"): string | undefined =>
  bound.day === "" ? undefined : (bound.iso ?? dayBoundary(bound.day, timeZone, edge));

/**
 * The `list_responses` arguments for these filters. Only keys that tool declares are emitted (its schema
 * is strict), scope and the model's own `contactId` / `language` narrowing are carried through, and the
 * total is always requested so the header can say "20 of 134".
 */
export const buildListArguments = (
  query: ListQuery,
  filters: Filters,
  timeZone: string,
  cursor?: string
): Record<string, unknown> => {
  const createdAtGte = resolveBound(filters.from, timeZone, "start");
  const createdAtLte = resolveBound(filters.to, timeZone, "end");

  return {
    workspaceId: query.workspaceId,
    surveyId: query.surveyId,
    limit: query.limit,
    sortBy: filters.sortBy,
    includeTotalCount: true,
    ...(query.contactId ? { contactId: query.contactId } : {}),
    ...(query.language ? { language: query.language } : {}),
    ...(createdAtGte ? { createdAtGte } : {}),
    ...(createdAtLte ? { createdAtLte } : {}),
    ...(filters.status === "all" ? {} : { finished: filters.status === "finished" }),
    ...(cursor ? { cursor } : {}),
  };
};
