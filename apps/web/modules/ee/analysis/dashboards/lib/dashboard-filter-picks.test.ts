import { describe, expect, test } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import {
  MAX_DASHBOARD_FILTER_PICKS_CHARS,
  appendPickParams,
  countPickChars,
  deserializeFilterPicks,
  exceedsPicksBudget,
  findPickIssues,
  keepCurrentPicks,
  narrowWithFilters,
  pickValuesOf,
  readFilterPicksFromUrl,
  resolvePicksForDataset,
  splitPickParams,
  writeFilterPicksToUrl,
} from "./dashboard-filter-picks";
import type { TDashboardFilter } from "./dashboard-filters";

const SOURCE = "FeedbackRecords.sourceName";
const A = "clfi000000000000000000001";
const B = "clfi000000000000000000002";
const C = "clfi000000000000000000003";

const filters: TDashboardFilter[] = [
  { id: A, field: SOURCE, operator: "equals", label: "Source" },
  { id: B, field: "FeedbackRecords.valueText", operator: "contains", label: "Answer" },
  { id: C, field: "FeedbackRecords.ed_region", operator: "equals", label: "Region" },
];

describe("narrowWithFilters", () => {
  test("appends picks after the saved filters, keeping a saved top-level rule and nested groups as they are", () => {
    const saved: TChartQuery = {
      measures: ["FeedbackRecords.count"],
      filters: [
        { member: SOURCE, operator: "equals", values: ["Web", "Email"] },
        { or: [{ member: "FeedbackRecords.language", operator: "equals", values: ["en"] }, { and: [] }] },
      ],
    };
    const pick = { member: SOURCE, operator: "equals", values: ["App"] };

    expect(narrowWithFilters(saved, [pick]).filters).toEqual([...(saved.filters ?? []), pick]);
    expect(narrowWithFilters(saved, [])).toBe(saved);
    expect(narrowWithFilters({ measures: [] }, [pick]).filters).toEqual([pick]);
  });
});

describe("pickValuesOf", () => {
  test("keeps every value of a list filter, the first of a typed one, and none when blank", () => {
    expect(pickValuesOf(filters[0], ["Web", "App"])).toEqual(["Web", "App"]);
    expect(pickValuesOf(filters[1], ["late", "early"])).toEqual(["late"]);
    expect(pickValuesOf(filters[0], [" ", ""])).toBeNull();
    expect(pickValuesOf(filters[0], undefined)).toBeNull();
  });
});

describe("resolvePicksForDataset", () => {
  const hasField = (field: string) => field !== "FeedbackRecords.ed_region";

  test("turns picks into rules in filter order, drops unknown filters, and leaves the excepted one out", () => {
    const resolved = resolvePicksForDataset(
      filters,
      { [B]: ["late"], [A]: ["Web"], clfi000000000000000000099: ["x"] },
      hasField
    );
    expect(resolved).toEqual({
      rules: [
        { member: SOURCE, operator: "equals", values: ["Web"] },
        { member: "FeedbackRecords.valueText", operator: "contains", values: ["late"] },
      ],
      unfilterable: [],
    });
    expect(resolvePicksForDataset(filters, { [A]: ["Web"] }, hasField, { except: A }).rules).toEqual([]);
  });

  test("marks a picked filter the dataset lacks as unfilterable, and ignores it when not picked", () => {
    expect(resolvePicksForDataset(filters, { [C]: ["North"] }, hasField).unfilterable).toEqual([filters[2]]);
    expect(resolvePicksForDataset(filters, {}, hasField).unfilterable).toEqual([]);
  });

  test("applies nothing with no filters or no picks", () => {
    expect(resolvePicksForDataset([], { [A]: ["Web"] }, hasField)).toEqual({ rules: [], unfilterable: [] });
  });
});

describe("splitPickParams", () => {
  test("gathers picks[id] parameters, repeated or single, and leaves the rest", () => {
    expect(
      splitPickParams({ dateRange: "today", [`picks[${A}]`]: ["Web", "App"], [`picks[${B}]`]: "late" })
    ).toEqual({ dateRange: "today", picks: { [A]: ["Web", "App"], [B]: ["late"] } });
    expect(splitPickParams({ dateRange: "today" })).toEqual({ dateRange: "today" });
  });
});

describe("picks in the URL and the cookie", () => {
  test("round-trip through URL parameters in filter order, keeping other parameters", () => {
    const params = writeFilterPicksToUrl(
      new URLSearchParams(`dateRange=today&picks[${C}]=old`),
      { [B]: ["late"], [A]: ["Web", "App"] },
      [A, B, C]
    );
    expect([...params.keys()]).toEqual(["dateRange", `picks[${A}]`, `picks[${A}]`, `picks[${B}]`]);
    expect(readFilterPicksFromUrl(params)).toEqual({ [A]: ["Web", "App"], [B]: ["late"] });
  });

  test("a URL without picks says so, so the remembered ones apply", () => {
    expect(readFilterPicksFromUrl(new URLSearchParams("dateRange=today"))).toBeNull();
    expect(readFilterPicksFromUrl(new URLSearchParams(`picks[${A}]=`))).toEqual({});
  });

  test("appends picks without an order sorted by id", () => {
    expect(appendPickParams(new URLSearchParams(), { [B]: ["x"], [A]: ["y"] }).toString()).toBe(
      new URLSearchParams([
        [`picks[${A}]`, "y"],
        [`picks[${B}]`, "x"],
      ]).toString()
    );
  });

  test("reads remembered picks back, and anything malformed as none", () => {
    expect(deserializeFilterPicks(encodeURIComponent(JSON.stringify({ [A]: ["Web"], [B]: [] })))).toEqual({
      [A]: ["Web"],
    });
    expect(deserializeFilterPicks("%7Bnot json")).toEqual({});
    expect(deserializeFilterPicks(encodeURIComponent("[1]"))).toEqual({});
    expect(deserializeFilterPicks(undefined)).toEqual({});
  });
});

describe("keepCurrentPicks", () => {
  test("drops picks for removed filters and empty picks, and keeps a remembered value", () => {
    expect(
      keepCurrentPicks([{ id: A }], {
        [A]: ["Gone from the data"],
        [B]: ["x"],
        clfi000000000000000000099: [],
      })
    ).toEqual({ [A]: ["Gone from the data"] });
  });
});

describe("the total picks budget", () => {
  test("counts every picked character across filters", () => {
    expect(countPickChars({})).toBe(0);
    expect(countPickChars({ [A]: ["Web", "App"], [B]: ["late"] })).toBe(10);
  });

  test("allows exactly the budget and refuses one character more", () => {
    const half = "x".repeat(MAX_DASHBOARD_FILTER_PICKS_CHARS / 2);
    expect(exceedsPicksBudget({ [A]: [half], [B]: [half] })).toBe(false);
    expect(exceedsPicksBudget({ [A]: [half], [B]: [`${half}x`] })).toBe(true);
  });

  test("is far below what 10 filters of 100 values of 1000 characters could carry", () => {
    expect(MAX_DASHBOARD_FILTER_PICKS_CHARS).toBe(4000);
  });
});

describe("findPickIssues", () => {
  const typed: TDashboardFilter[] = [
    { id: A, field: "FeedbackRecords.valueNumber", operator: "gt", label: "Score" },
    { id: B, field: "FeedbackRecords.collectedAt", operator: "gte", label: "Since" },
    { id: C, field: SOURCE, operator: "equals", label: "Source" },
  ];

  test("no picks, and picks of the field's type, are fine", () => {
    expect(findPickIssues(typed, {})).toEqual([]);
    expect(findPickIssues(typed, { [A]: ["7.5"], [B]: ["2026-01-31"], [C]: ["anything"] })).toEqual([]);
  });

  test("names a pick that is not a number or not a date, by its filter", () => {
    expect(findPickIssues(typed, { [A]: ["seven"], [B]: ["yesterday-ish"] })).toEqual([
      { name: `picks[${A}]`, reason: "Must be a number." },
      { name: `picks[${B}]`, reason: "Must be a date (YYYY-MM-DD or an ISO 8601 timestamp)." },
    ]);
  });

  test("ignores picks for filters the dashboard does not have", () => {
    expect(findPickIssues(typed, { clfi000000000000000000099: ["seven"] })).toEqual([]);
  });

  test("names the total budget when the picks hold more than it", () => {
    expect(findPickIssues(typed, { [C]: ["x".repeat(MAX_DASHBOARD_FILTER_PICKS_CHARS + 1)] })).toEqual([
      {
        name: "picks",
        reason: `Picks may hold at most ${MAX_DASHBOARD_FILTER_PICKS_CHARS} characters in all (MAX_DASHBOARD_FILTER_PICKS_CHARS).`,
        code: "limit_exceeded",
      },
    ]);
  });
});
