import { describe, expect, test } from "vitest";
import {
  buildCreativeStatsSearchParams,
  formatClickRate,
  formatStatsRange,
  getRowStatusActions,
  getStatusChangeOutcome,
  getSummaryStatusControl,
  isWaitingForStart,
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
    expect(getSummaryStatusControl({ status: "paused", archivedAt: null }, false, "full")).toEqual({
      kind: "select",
      value: "paused",
      options: ["inProgress", "paused", "completed"],
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
    expect(getSummaryStatusControl(creative, isReadOnly, "full")).toEqual({ kind: "pill" });
    expect(getSummaryStatusControl(creative, isReadOnly, "windDown")).toEqual({ kind: "pill" });
  });

  test.each(["inProgress", "paused", "completed"] as const)(
    "in wind-down, only pauses or closes a %s creative: it can't be turned back on",
    (status) => {
      expect(getSummaryStatusControl({ status, archivedAt: null }, false, "windDown")).toEqual({
        kind: "select",
        value: status,
        options: ["paused", "completed"],
      });
    }
  );
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
    const displayStatus = status === "completed" ? "closed" : status === "paused" ? "paused" : "active";
    expect(getRowStatusActions({ status, displayStatus, archivedAt: null }, "full")).toEqual(actions);
  });

  test("offers to keep paused a creative that shows Paused only because of its survey", () => {
    expect(
      getRowStatusActions({ status: "inProgress", displayStatus: "paused", archivedAt: null }, "full")
    ).toEqual([
      { action: "keepPaused", status: "paused" },
      { action: "close", status: "completed" },
    ]);
  });

  test("sends a draft to the editor to publish, since Publish checks it first", () => {
    expect(
      getRowStatusActions({ status: "draft", displayStatus: "draft", archivedAt: null }, "full")
    ).toEqual([{ action: "publish" }]);
  });

  test("offers nothing for an archived creative", () => {
    expect(
      getRowStatusActions(
        {
          status: "paused",
          displayStatus: "archived",
          archivedAt: "2026-10-01T00:00:00.000Z",
        },
        "full"
      )
    ).toEqual([]);
  });

  describe("in wind-down", () => {
    test.each([
      [
        "an Active creative can still be paused or closed",
        { status: "inProgress", displayStatus: "active" },
        [
          { action: "pause", status: "paused" },
          { action: "close", status: "completed" },
        ],
      ],
      [
        "a creative Paused by its survey can still be kept paused or closed",
        { status: "inProgress", displayStatus: "paused" },
        [
          { action: "keepPaused", status: "paused" },
          { action: "close", status: "completed" },
        ],
      ],
      [
        "a Paused creative can be closed but not resumed",
        { status: "paused", displayStatus: "paused" },
        [{ action: "close", status: "completed" }],
      ],
      ["a Closed creative can't be reopened", { status: "completed", displayStatus: "closed" }, []],
      ["a draft can't be published", { status: "draft", displayStatus: "draft" }, []],
    ] as const)("%s", (_case, creative, actions) => {
      expect(getRowStatusActions({ ...creative, archivedAt: null }, "windDown")).toEqual(actions);
    });
  });

  test("offers nothing when the workspace has no Creatives access", () => {
    expect(
      getRowStatusActions({ status: "inProgress", displayStatus: "active", archivedAt: null }, "none")
    ).toEqual([]);
  });
});

describe("isWaitingForStart", () => {
  test("is true while the start is still ahead, so turning it on only schedules it", () => {
    expect(isWaitingForStart({ startAt: "2026-10-17T02:00:00.000Z" }, NOW)).toBe(true);
  });

  test("is false once the start has passed, or with no start", () => {
    expect(isWaitingForStart({ startAt: "2026-10-16T02:00:00.000Z" }, NOW)).toBe(false);
    expect(isWaitingForStart({ startAt: null }, NOW)).toBe(false);
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
