import { describe, expect, test } from "vitest";
import type { TChartQuery } from "@formbricks/types/analysis";
import { EMOTION_VALUES } from "@/modules/ee/analysis/lib/schema-definition";
import { type TMemoryRecord, recordMatches } from "./cube-memory-test-utils";
import {
  MAX_DASHBOARD_FILTER_PICKS_CHARS,
  UnreadableLockedFiltersError,
  countPickChars,
  exceedsPicksBudget,
  findPickIssues,
  keepCurrentPicks,
  narrowWithFilters,
  pickValuesOf,
  resolvePicksForDataset,
  splitPickParams,
  toPickRule,
  withLockedFilters,
} from "./dashboard-filter-picks";
import { NO_VALUE_PICK, type TDashboardFilter } from "./dashboard-filters";

const SOURCE = "FeedbackRecords.sourceName";
const EMOTIONS = "FeedbackRecords.emotions";
const UTC_CLOCK = { timeZone: "UTC" };
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

describe("set and notSet", () => {
  const isSet: TDashboardFilter = { id: A, field: SOURCE, operator: "set", label: "Source" };

  test("apply with no pick, as a rule without values", () => {
    expect(pickValuesOf(isSet, undefined)).toEqual([]);
    expect(resolvePicksForDataset([isSet], {}, () => true, UTC_CLOCK).rules).toEqual([
      { member: SOURCE, operator: "set" },
    ]);
    expect(
      resolvePicksForDataset([{ ...isSet, operator: "notSet" }], {}, () => true, UTC_CLOCK).rules
    ).toEqual([{ member: SOURCE, operator: "notSet" }]);
  });

  test("refuse a pick, since they compare against nothing", () => {
    expect(findPickIssues([isSet], {})).toEqual([]);
    expect(findPickIssues([isSet], { [A]: ["Web"] })).toEqual([
      expect.objectContaining({ name: `picks[${A}]` }),
    ]);
  });

  test("a locked one applies on every read", () => {
    const locked = withLockedFilters([{ ...isSet, values: [] }], [], {});
    expect(resolvePicksForDataset(locked.filters, locked.picks, () => true, UTC_CLOCK).rules).toEqual([
      { member: SOURCE, operator: "set" },
    ]);
  });
});

describe("the no-value pick", () => {
  const is: TDashboardFilter = { id: A, field: SOURCE, operator: "equals", label: "Source" };
  const isNot: TDashboardFilter = { ...is, operator: "notEquals" };

  test("is any of the values or no value", () => {
    expect(toPickRule(is, ["Web", NO_VALUE_PICK], UTC_CLOCK)).toEqual({
      or: [
        { member: SOURCE, operator: "equals", values: ["Web"] },
        { member: SOURCE, operator: "notSet" },
      ],
    });
    expect(toPickRule(is, [NO_VALUE_PICK], UTC_CLOCK)).toEqual({ member: SOURCE, operator: "notSet" });
  });

  test("is not: has a value, and none of the others", () => {
    expect(toPickRule(isNot, ["Web", NO_VALUE_PICK], UTC_CLOCK)).toEqual({
      and: [
        { member: SOURCE, operator: "set" },
        { member: SOURCE, operator: "notEquals", values: ["Web"] },
      ],
    });
    expect(toPickRule(isNot, [NO_VALUE_PICK], UTC_CLOCK)).toEqual({ member: SOURCE, operator: "set" });
  });

  test("without it, a pick is the plain rule", () => {
    expect(toPickRule(is, ["Web"], UTC_CLOCK)).toEqual({
      member: SOURCE,
      operator: "equals",
      values: ["Web"],
    });
  });

  test("is refused as a real value anywhere but a list filter", () => {
    expect(findPickIssues([is], { [A]: [NO_VALUE_PICK] })).toEqual([]);
    const contains: TDashboardFilter = { ...is, operator: "contains" };
    expect(findPickIssues([contains], { [A]: [NO_VALUE_PICK] })).toEqual([
      expect.objectContaining({ name: `picks[${A}]` }),
    ]);
    const freeText: TDashboardFilter = { ...is, field: "FeedbackRecords.valueText" };
    expect(findPickIssues([freeText], { [A]: [NO_VALUE_PICK] })).toEqual([
      expect.objectContaining({ name: `picks[${A}]` }),
    ]);
  });
});

describe("resolvePicksForDataset", () => {
  const hasField = (field: string) => field !== "FeedbackRecords.ed_region";

  test("turns picks into rules in filter order, drops unknown filters, and leaves the excepted one out", () => {
    const resolved = resolvePicksForDataset(
      filters,
      { [B]: ["late"], [A]: ["Web"], clfi000000000000000000099: ["x"] },
      hasField,
      UTC_CLOCK
    );
    expect(resolved).toEqual({
      rules: [
        { member: SOURCE, operator: "equals", values: ["Web"] },
        { member: "FeedbackRecords.valueText", operator: "contains", values: ["late"] },
      ],
      unfilterable: [],
    });
    expect(
      resolvePicksForDataset(filters, { [A]: ["Web"] }, hasField, { ...UTC_CLOCK, except: A }).rules
    ).toEqual([]);
  });

  test("marks a picked filter the dataset lacks as unfilterable, and ignores it when not picked", () => {
    expect(resolvePicksForDataset(filters, { [C]: ["North"] }, hasField, UTC_CLOCK).unfilterable).toEqual([
      filters[2],
    ]);
    expect(resolvePicksForDataset(filters, {}, hasField, UTC_CLOCK).unfilterable).toEqual([]);
  });

  test("applies nothing with no filters or no picks", () => {
    expect(resolvePicksForDataset([], { [A]: ["Web"] }, hasField, UTC_CLOCK)).toEqual({
      rules: [],
      unfilterable: [],
    });
  });
});

describe("splitPickParams", () => {
  test("gathers picks[id] parameters, repeated or single, and leaves the rest", () => {
    expect(
      splitPickParams({ dateRange: "today", [`picks[${A}]`]: ["Web", "App"], [`picks[${B}]`]: "late" })
    ).toEqual({ dateRange: "today", picks: { [A]: ["Web", "App"], [B]: ["late"] } });
    expect(splitPickParams({ dateRange: "today" })).toEqual({ dateRange: "today" });
  });

  test("gathers filter[id] parameters into the filters of the request", () => {
    expect(
      splitPickParams({ [`filter[f1]`]: "equals:FeedbackRecords.sourceName", [`picks[f1]`]: "Web" })
    ).toEqual({ rules: { f1: "equals:FeedbackRecords.sourceName" }, picks: { f1: ["Web"] } });
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

  test("counts each value as it travels in the URL, so text outside ASCII costs what it takes there", () => {
    // "日" is three UTF-8 bytes, nine characters once percent-encoded; a space is three ("%20").
    expect(countPickChars({ [A]: ["日本"], [B]: ["a b"] })).toBe(18 + 5);
    const cjk = "日".repeat(Math.floor(MAX_DASHBOARD_FILTER_PICKS_CHARS / 9));
    expect(exceedsPicksBudget({ [A]: [cjk] })).toBe(false);
    expect(exceedsPicksBudget({ [A]: [`${cjk}日`] })).toBe(true);
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

  test("refuses a day the calendar does not have, which Date.parse would roll over", () => {
    expect(findPickIssues(typed, { [B]: ["2026-02-30"] })).toEqual([
      { name: `picks[${B}]`, reason: "Must be a date (YYYY-MM-DD or an ISO 8601 timestamp)." },
    ]);
  });

  test("takes only an emotion's own labels for contains any of / none of, and no no-value pick", () => {
    const emotions: TDashboardFilter[] = [
      { id: A, field: EMOTIONS, operator: "contains", label: "Emotions" },
      { id: B, field: EMOTIONS, operator: "notContains", label: "Emotions" },
    ];
    expect(findPickIssues(emotions, { [A]: ["joy", "fear"], [B]: ["anger"] })).toEqual([]);
    expect(findPickIssues(emotions, { [A]: ["jo"], [B]: [NO_VALUE_PICK] })).toEqual([
      { name: `picks[${A}]`, reason: "Must be one of: joy, anger, sadness, fear, surprise, disgust." },
      {
        name: `picks[${B}]`,
        reason: "The no-value pick only goes with equals or notEquals on a field that has a value list.",
      },
    ]);
  });

  test("ignores picks for filters the dashboard does not have", () => {
    expect(findPickIssues(typed, { clfi000000000000000000099: ["seven"] })).toEqual([]);
  });

  test("names the total budget when the picks hold more than it", () => {
    expect(findPickIssues(typed, { [C]: ["x".repeat(MAX_DASHBOARD_FILTER_PICKS_CHARS + 1)] })).toEqual([
      {
        name: "picks",
        reason: `Picks may take at most ${MAX_DASHBOARD_FILTER_PICKS_CHARS} characters in all, each value counted percent-encoded (MAX_DASHBOARD_FILTER_PICKS_CHARS).`,
        code: "limit_exceeded",
      },
    ]);
  });
});

describe("withLockedFilters", () => {
  const LOCKED = { id: A, field: SOURCE, operator: "equals", label: "Source", values: ["Web"] };

  test("puts the dashboard's locked filters, with their values, before the request's own", () => {
    expect(withLockedFilters([LOCKED], [filters[1]], { [B]: ["x"] })).toEqual({
      filters: [{ id: "locked.0", field: SOURCE, operator: "equals", label: "Source" }, filters[1]],
      picks: { [B]: ["x"], "locked.0": ["Web"] },
    });
    expect(withLockedFilters(null, [], {})).toEqual({ filters: [], picks: {} });
  });

  test("fails closed: a stored locked filter that does not read refuses the read rather than dropping it", () => {
    expect(() => withLockedFilters([LOCKED, { ...LOCKED, operator: "between" }], [], {})).toThrow(
      UnreadableLockedFiltersError
    );
    expect(() => withLockedFilters({ not: "a list" }, [], {})).toThrow(UnreadableLockedFiltersError);
  });
});

describe("emotions: contains any of / none of", () => {
  const anyOf: TDashboardFilter = { id: A, field: EMOTIONS, operator: "contains", label: "Emotions" };
  const noneOf: TDashboardFilter = { ...anyOf, operator: "notContains" };
  // Cube joins a record's emotions into one text, as FeedbackRecords.emotions reads them.
  const records: TMemoryRecord[] = [
    { id: "joy", [EMOTIONS]: "joy" },
    { id: "joy+surprise", [EMOTIONS]: "joy, surprise" },
    { id: "fear", [EMOTIONS]: "fear" },
    { id: "anger", [EMOTIONS]: "anger" },
    { id: "none", [EMOTIONS]: null },
  ];
  const matching = (filter: TDashboardFilter, values: string[]) => {
    const { rules } = resolvePicksForDataset([filter], { [A]: values }, () => true, UTC_CLOCK);
    return records.filter((record) => recordMatches(record, { filters: rules })).map(({ id }) => id);
  };

  test("keeps every picked label, as one rule Cube ORs (contains) or ANDs (notContains)", () => {
    expect(pickValuesOf(anyOf, ["joy", "fear"])).toEqual(["joy", "fear"]);
    expect(toPickRule(anyOf, ["joy", "fear"], UTC_CLOCK)).toEqual({
      member: EMOTIONS,
      operator: "contains",
      values: ["joy", "fear"],
    });
  });

  test("any of matches a record holding a picked emotion beside others", () => {
    expect(matching(anyOf, ["joy", "fear"])).toEqual(["joy", "joy+surprise", "fear"]);
  });

  test("none of keeps records with none of them, records without emotions included", () => {
    expect(matching(noneOf, ["joy", "fear"])).toEqual(["anger", "none"]);
  });

  test("no emotion is part of another, so matching one as a substring never matches another", () => {
    for (const label of EMOTION_VALUES) {
      expect(EMOTION_VALUES.filter((other) => other.includes(label))).toEqual([label]);
    }
  });
});

describe("a picked day on a time field", () => {
  const COLLECTED_AT = "FeedbackRecords.collectedAt";
  const BERLIN = { timeZone: "Europe/Berlin" };
  const filterOf = (operator: TDashboardFilter["operator"]): TDashboardFilter => ({
    id: A,
    field: COLLECTED_AT,
    operator,
    label: "Collected",
  });
  // Berlin is two hours ahead of UTC in early October (CEST), so each is on another day there than in UTC.
  const at = (id: string, instant: string): TMemoryRecord => ({ id, [COLLECTED_AT]: instant });
  const records = [
    at("Oct 4 23:30 Berlin", "2026-10-04T21:30:00.000Z"),
    at("Oct 5 00:30 Berlin", "2026-10-04T22:30:00.000Z"),
    at("Oct 5 23:30 Berlin", "2026-10-05T21:30:00.000Z"),
    at("Oct 6 00:30 Berlin", "2026-10-05T22:30:00.000Z"),
  ];
  const matching = (operator: TDashboardFilter["operator"], day: string) => {
    const { rules } = resolvePicksForDataset([filterOf(operator)], { [A]: [day] }, () => true, BERLIN);
    return records.filter((record) => recordMatches(record, { filters: rules })).map(({ id }) => id);
  };

  test("after Oct 5 starts when Oct 6 starts in the organization's zone", () => {
    expect(matching("gt", "2026-10-05")).toEqual(["Oct 6 00:30 Berlin"]);
    expect(toPickRule(filterOf("gt"), ["2026-10-05"], BERLIN)).toEqual({
      member: COLLECTED_AT,
      operator: "gte",
      values: ["2026-10-05T22:00:00.000Z"],
    });
  });

  test("before Oct 5 ends when Oct 5 starts in the organization's zone", () => {
    expect(matching("lt", "2026-10-05")).toEqual(["Oct 4 23:30 Berlin"]);
  });

  test("on or after, on or before, on and not on Oct 5 are whole days there too", () => {
    expect(matching("gte", "2026-10-05")).toEqual([
      "Oct 5 00:30 Berlin",
      "Oct 5 23:30 Berlin",
      "Oct 6 00:30 Berlin",
    ]);
    expect(matching("lte", "2026-10-05")).toEqual([
      "Oct 4 23:30 Berlin",
      "Oct 5 00:30 Berlin",
      "Oct 5 23:30 Berlin",
    ]);
    expect(matching("equals", "2026-10-05")).toEqual(["Oct 5 00:30 Berlin", "Oct 5 23:30 Berlin"]);
    expect(matching("notEquals", "2026-10-05")).toEqual(["Oct 4 23:30 Berlin", "Oct 6 00:30 Berlin"]);
  });

  test("a timestamp is compared as the instant it names", () => {
    expect(toPickRule(filterOf("gt"), ["2026-10-05T12:00:00Z"], BERLIN)).toEqual({
      member: COLLECTED_AT,
      operator: "gt",
      values: ["2026-10-05T12:00:00Z"],
    });
  });
});
