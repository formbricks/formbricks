import { describe, expect, test } from "vitest";
import {
  buildCreativeStatsSearchParams,
  formatClickRate,
  formatStatsRange,
  getRowStatusActions,
  getStatusChangeOutcome,
  getSummaryStatusControl,
  toDailyChartRows,
} from "./summary";

// Late in the UTC day, so any viewer east of UTC is already on the 17th: the counts are cut in UTC days.
const NOW = new Date("2026-10-16T23:30:00Z");

describe("buildCreativeStatsSearchParams", () => {
  test("asks for a preset's UTC days, inclusive, broken down by page", () => {
    const params = buildCreativeStatsSearchParams({ preset: "last 30 days" }, NOW);

    expect([...params.entries()]).toEqual([
      ["from", "2026-09-17"],
      ["to", "2026-10-16"],
      ["groupBy", "page"],
    ]);
  });

  test("asks for the calendar days a custom range picked", () => {
    const params = buildCreativeStatsSearchParams(
      { preset: null, from: new Date(2026, 9, 1), to: new Date(2026, 9, 10) },
      NOW
    );

    expect(params.get("from")).toBe("2026-10-01");
    expect(params.get("to")).toBe("2026-10-10");
  });

  test("ends a custom range today, since later days have nothing counted yet", () => {
    const params = buildCreativeStatsSearchParams(
      { preset: null, from: new Date(2026, 9, 10), to: new Date(2026, 9, 20) },
      NOW
    );

    expect(params.get("from")).toBe("2026-10-10");
    expect(params.get("to")).toBe("2026-10-16");
  });

  test("keeps the latest 366 days of a longer custom range, the most one request may ask for", () => {
    const params = buildCreativeStatsSearchParams(
      { preset: null, from: new Date(2024, 0, 1), to: new Date(2026, 5, 30) },
      NOW
    );

    expect(params.get("from")).toBe("2025-06-30");
    expect(params.get("to")).toBe("2026-06-30");
  });
});

describe("toDailyChartRows", () => {
  test("labels each bar with the UTC day it counts, in the viewer's language", () => {
    const rows = toDailyChartRows(
      [
        { date: "2026-10-15", impressions: 500, clicks: 10, clickRate: 0.02 },
        { date: "2026-10-16", impressions: 0, clicks: 0, clickRate: null },
      ],
      "en-US"
    );

    expect(rows).toEqual([
      { date: "2026-10-15", label: "Oct 15", impressions: 500, clicks: 10 },
      { date: "2026-10-16", label: "Oct 16", impressions: 0, clicks: 0 },
    ]);
  });
});

describe("formatClickRate", () => {
  test.each([
    [0.025, "2.5%"],
    [0, "0%"],
    [1, "100%"],
    [0.12345, "12.3%"],
  ])("shows %s as a percentage to one decimal", (rate, expected) => {
    expect(formatClickRate(rate, "en-US")).toBe(expected);
  });

  test("shows a rate too small to round to 0.1% as below it, not as no clicks at all", () => {
    expect(formatClickRate(0.0004, "en-US")).toBe("<0.1%");
  });

  test("shows a dash without Impressions, where there is no rate", () => {
    expect(formatClickRate(null, "en-US")).toBe("-");
  });

  test("follows the viewer's language", () => {
    expect(formatClickRate(0.025, "de-DE")).toBe("2,5\u00a0%");
  });
});

describe("formatStatsRange", () => {
  test("names the first and last UTC day of the range", () => {
    expect(formatStatsRange({ from: "2026-09-17", to: "2026-10-16" }, "en-US")).toBe("Sep 17 – Oct 16");
  });

  test("names a one-day range once", () => {
    expect(formatStatsRange({ from: "2026-10-16", to: "2026-10-16" }, "en-US")).toBe("Oct 16");
  });
});

describe("getSummaryStatusControl", () => {
  test("lets a writer switch a published creative between Active, Paused and Closed", () => {
    expect(getSummaryStatusControl({ status: "paused", archivedAt: null }, false)).toEqual({
      kind: "select",
      value: "paused",
    });
  });

  test.each([
    ["a draft, which is published from the editor", { status: "draft", archivedAt: null }, false],
    [
      "an archived creative, which can't change",
      { status: "inProgress", archivedAt: "2026-10-01T00:00:00.000Z" },
      false,
    ],
    ["a member who can only read", { status: "inProgress", archivedAt: null }, true],
  ] as const)("only shows the status for %s", (_case, creative, isReadOnly) => {
    expect(getSummaryStatusControl(creative, isReadOnly)).toEqual({ kind: "pill" });
  });
});

describe("getRowStatusActions", () => {
  test.each([
    [
      "Active",
      "inProgress",
      [
        { action: "pause", status: "paused" },
        { action: "close", status: "completed" },
      ],
    ],
    [
      "Paused",
      "paused",
      [
        { action: "resume", status: "inProgress" },
        { action: "close", status: "completed" },
      ],
    ],
    ["Closed", "completed", [{ action: "reopen", status: "inProgress" }]],
  ] as const)("offers what an author's %s creative can become", (_case, status, actions) => {
    expect(getRowStatusActions({ status, archivedAt: null })).toEqual(actions);
  });

  test("sends a draft to the editor to publish, since Publish checks it first", () => {
    expect(getRowStatusActions({ status: "draft", archivedAt: null })).toEqual([{ action: "publish" }]);
  });

  test("offers nothing for an archived creative", () => {
    expect(getRowStatusActions({ status: "paused", archivedAt: "2026-10-01T00:00:00.000Z" })).toEqual([]);
  });
});

describe("getStatusChangeOutcome", () => {
  test.each([
    ["inProgress", "active", null, "active"],
    ["inProgress", "scheduled", null, "scheduled"],
    ["paused", "paused", null, "paused"],
    ["completed", "closed", null, "closed"],
  ] as const)("asking for %s and getting %s confirms it", (requested, displayStatus, reason, expected) => {
    expect(getStatusChangeOutcome(requested, { displayStatus, displayStatusReason: reason })).toEqual({
      kind: "success",
      message: expected,
    });
  });

  test("explains that a reopened creative whose end has passed stays Closed", () => {
    expect(
      getStatusChangeOutcome("inProgress", { displayStatus: "closed", displayStatusReason: "scheduleEnded" })
    ).toEqual({ kind: "notice", message: "scheduleEnded" });
  });

  test("explains that a resumed creative waits for its survey", () => {
    expect(
      getStatusChangeOutcome("inProgress", {
        displayStatus: "paused",
        displayStatusReason: "surveyNotActive",
      })
    ).toEqual({ kind: "notice", message: "surveyNotActive" });
  });
});
