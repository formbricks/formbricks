import { describe, expect, test } from "vitest";
import {
  EMPTY_BOUND,
  type Filters,
  buildListArguments,
  dayBoundary,
  defaultFilters,
  filtersFromQuery,
  isFiltered,
  parseSortBy,
  parseStatusFilter,
  toDayString,
  validateFilters,
} from "./filters";
import type { ListQuery } from "./types";

const query: ListQuery = {
  workspaceId: "ws1",
  surveyId: "sv1",
  limit: 20,
  sortBy: "-createdAt",
};

describe("dayBoundary", () => {
  test("is midnight and the last millisecond in UTC", () => {
    expect(dayBoundary("2026-03-14", "UTC", "start")).toBe("2026-03-14T00:00:00.000Z");
    expect(dayBoundary("2026-03-14", "UTC", "end")).toBe("2026-03-14T23:59:59.999Z");
  });

  test("follows the zone, not the locale, and the offset in force on that day", () => {
    // New York is UTC-5 in January and UTC-4 in July.
    expect(dayBoundary("2026-01-15", "America/New_York", "start")).toBe("2026-01-15T05:00:00.000Z");
    expect(dayBoundary("2026-07-15", "America/New_York", "start")).toBe("2026-07-15T04:00:00.000Z");
    // Kolkata is UTC+5:30, so its day starts the evening before in UTC.
    expect(dayBoundary("2026-03-14", "Asia/Kolkata", "start")).toBe("2026-03-13T18:30:00.000Z");
    expect(dayBoundary("2026-03-14", "Asia/Kolkata", "end")).toBe("2026-03-14T18:29:59.999Z");
  });

  test("is right on the day a clock change falls on", () => {
    // US clocks went forward on 2026-03-08: midnight is still UTC-5, the end of the day is UTC-4.
    expect(dayBoundary("2026-03-08", "America/New_York", "start")).toBe("2026-03-08T05:00:00.000Z");
    expect(dayBoundary("2026-03-08", "America/New_York", "end")).toBe("2026-03-09T03:59:59.999Z");
  });

  test("falls back to UTC for an unknown zone and refuses a day that does not exist", () => {
    expect(dayBoundary("2026-03-14", "Not/AZone", "start")).toBe("2026-03-14T00:00:00.000Z");
    expect(dayBoundary("2026-02-30", "UTC", "start")).toBeUndefined();
    expect(dayBoundary("14/03/2026", "UTC", "start")).toBeUndefined();
    expect(dayBoundary("", "UTC", "start")).toBeUndefined();
  });
});

describe("toDayString", () => {
  test("reads the calendar day in the given zone", () => {
    expect(toDayString("2026-03-13T23:30:00.000Z", "UTC")).toBe("2026-03-13");
    expect(toDayString("2026-03-13T23:30:00.000Z", "Asia/Kolkata")).toBe("2026-03-14");
    expect(toDayString("nonsense", "UTC")).toBe("");
  });
});

describe("filtersFromQuery", () => {
  test("starts from what the tool call asked for", () => {
    const filters = filtersFromQuery(
      { ...query, finished: false, createdAtGte: "2026-03-01T00:00:00.000Z", sortBy: "createdAt" },
      "UTC"
    );
    expect(filters).toEqual({
      status: "partial",
      from: { day: "2026-03-01", iso: "2026-03-01T00:00:00.000Z" },
      to: EMPTY_BOUND,
      sortBy: "createdAt",
    });
    expect(isFiltered(filters)).toBe(true);
    expect(isFiltered(defaultFilters("-createdAt"))).toBe(false);
  });
});

describe("validateFilters", () => {
  const filters = (from: string, to: string): Filters => ({
    ...defaultFilters("-createdAt"),
    from: { day: from },
    to: { day: to },
  });

  test("accepts open ranges and a same-day range", () => {
    expect(validateFilters(filters("", ""), "UTC")).toBeUndefined();
    expect(validateFilters(filters("2026-03-01", ""), "UTC")).toBeUndefined();
    expect(validateFilters(filters("2026-03-01", "2026-03-01"), "UTC")).toBeUndefined();
  });

  test("explains a reversed or impossible range", () => {
    expect(validateFilters(filters("2026-03-05", "2026-03-01"), "UTC")).toBe(
      "The start date is after the end date."
    );
    expect(validateFilters(filters("2026-02-30", ""), "UTC")).toBe("Enter the start date as a real day.");
    expect(validateFilters(filters("", "2026-13-01"), "UTC")).toBe("Enter the end date as a real day.");
  });
});

describe("buildListArguments", () => {
  test("sends only the scope, paging and sort when nothing is filtered", () => {
    expect(buildListArguments(query, defaultFilters("-createdAt"), "UTC")).toEqual({
      workspaceId: "ws1",
      surveyId: "sv1",
      limit: 20,
      sortBy: "-createdAt",
      includeTotalCount: true,
    });
  });

  test("maps status and days to the list tool's filters, in the host zone", () => {
    const args = buildListArguments(
      query,
      {
        status: "finished",
        from: { day: "2026-03-14" },
        to: { day: "2026-03-14" },
        sortBy: "createdAt",
      },
      "Asia/Kolkata"
    );
    expect(args).toMatchObject({
      finished: true,
      createdAtGte: "2026-03-13T18:30:00.000Z",
      createdAtLte: "2026-03-14T18:29:59.999Z",
      sortBy: "createdAt",
    });
  });

  test("keeps the model's exact bound while the day is untouched, and its other narrowing", () => {
    const withBounds: ListQuery = {
      ...query,
      contactId: "c1",
      language: ["de"],
      createdAtGte: "2026-03-01T08:15:00.000Z",
    };
    const args = buildListArguments(withBounds, filtersFromQuery(withBounds, "UTC"), "UTC", "cursor-1");
    expect(args).toMatchObject({
      contactId: "c1",
      language: ["de"],
      createdAtGte: "2026-03-01T08:15:00.000Z",
      cursor: "cursor-1",
    });
    expect(args).not.toHaveProperty("finished");
  });

  test("never emits a key the list tool does not declare", () => {
    const declared = new Set([
      "workspaceId",
      "surveyId",
      "contactId",
      "createdAtGte",
      "createdAtLte",
      "finished",
      "language",
      "limit",
      "cursor",
      "includeTotalCount",
      "sortBy",
    ]);
    const args = buildListArguments(
      { ...query, contactId: "c1", language: ["en"] },
      { status: "partial", from: { day: "2026-03-01" }, to: { day: "2026-03-02" }, sortBy: "createdAt" },
      "UTC",
      "next"
    );
    for (const key of Object.keys(args)) expect(declared.has(key), key).toBe(true);
  });
});

describe("select value guards", () => {
  test("accept only the values the selects offer", () => {
    expect(parseStatusFilter("partial")).toBe("partial");
    expect(parseStatusFilter("everything")).toBeUndefined();
    expect(parseSortBy("-createdAt")).toBe("-createdAt");
    expect(parseSortBy("name")).toBeUndefined();
  });
});
