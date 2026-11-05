import { describe, expect, test } from "vitest";
import {
  appendFilterParams,
  deserializeFilters,
  exceedsFiltersBudget,
  keepValidFilters,
  readFiltersFromUrl,
  writeFiltersToUrl,
} from "./dashboard-filter-state";

const SOURCE = { field: "FeedbackRecords.sourceName", operator: "equals" as const, values: ["Web", "App"] };
const SCORE = { field: "FeedbackRecords.valueNumber", operator: "gt" as const, values: ["7"] };

describe("keepValidFilters", () => {
  test("keeps valid filters with a value, drops the rest, and caps the count", () => {
    expect(
      keepValidFilters([
        SOURCE,
        { field: "FeedbackRecords.notAField", operator: "equals", values: ["x"] },
        { field: "FeedbackRecords.sourceType", operator: "equals", values: [""] },
        { field: "FeedbackRecords.sourceType", operator: "gt", values: ["x"] },
        SCORE,
      ])
    ).toEqual([SOURCE, SCORE]);
    const many = Array.from({ length: 12 }, () => SCORE);
    expect(keepValidFilters(many)).toHaveLength(10);
  });

  test("keeps set / notSet with no values, dropping any they were given", () => {
    expect(
      keepValidFilters([
        { field: "FeedbackRecords.sourceType", operator: "set", values: ["x"] },
        { field: "FeedbackRecords.sourceType", operator: "notSet" },
      ])
    ).toEqual([
      { field: "FeedbackRecords.sourceType", operator: "set", values: [] },
      { field: "FeedbackRecords.sourceType", operator: "notSet", values: [] },
    ]);
  });

  test("a set filter round-trips through the URL with no picks", () => {
    const isSet = { field: "FeedbackRecords.sourceType", operator: "set" as const, values: [] };
    const params = writeFiltersToUrl(new URLSearchParams(), [isSet]);
    expect([...params.keys()]).toEqual(["filter[f1]"]);
    expect(readFiltersFromUrl(params)).toEqual([isSet]);
  });
});

describe("filters in the URL", () => {
  test("round-trip through URL parameters, keeping other parameters", () => {
    const written = writeFiltersToUrl(new URLSearchParams("dateRange=today"), [SOURCE, SCORE]);
    expect(decodeURIComponent(written.toString())).toBe(
      "dateRange=today&filter[f1]=equals:FeedbackRecords.sourceName&picks[f1]=Web&picks[f1]=App&filter[f2]=gt:FeedbackRecords.valueNumber&picks[f2]=7"
    );
    expect(readFiltersFromUrl(written)).toEqual([SOURCE, SCORE]);
    expect(writeFiltersToUrl(written, []).toString()).toBe("dateRange=today");
  });

  test("a URL without filters says so, so the remembered ones apply", () => {
    expect(readFiltersFromUrl(new URLSearchParams("dateRange=today"))).toBeNull();
  });

  test("a filter whose definition is malformed is dropped", () => {
    expect(readFiltersFromUrl(new URLSearchParams("filter[f1]=nonsense&picks[f1]=x"))).toEqual([]);
  });

  test("appendFilterParams adds the parameters of a read", () => {
    expect(appendFilterParams(new URLSearchParams(), [SCORE]).toString()).toBe(
      "filter%5Bf1%5D=gt%3AFeedbackRecords.valueNumber&picks%5Bf1%5D=7"
    );
  });
});

describe("deserializeFilters", () => {
  test("reads remembered filters back, and anything malformed as none", () => {
    expect(deserializeFilters(encodeURIComponent(JSON.stringify([SOURCE])))).toEqual([SOURCE]);
    expect(deserializeFilters(undefined)).toEqual([]);
    // The server's cookie store hands the value over decoded: a `%` in a value must survive.
    const percent = { ...SOURCE, values: ["50% off"] };
    expect(deserializeFilters(JSON.stringify([percent]))).toEqual([percent]);
    expect(deserializeFilters(encodeURIComponent(JSON.stringify([percent])))).toEqual([percent]);
    expect(deserializeFilters("not json")).toEqual([]);
    expect(deserializeFilters(encodeURIComponent(JSON.stringify({ a: 1 })))).toEqual([]);
    expect(deserializeFilters(encodeURIComponent(JSON.stringify([{ field: 1 }])))).toEqual([]);
  });
});

describe("exceedsFiltersBudget", () => {
  test("allows ordinary values and refuses past the picks budget", () => {
    expect(exceedsFiltersBudget([SOURCE])).toBe(false);
    const long = "x".repeat(1000);
    expect(exceedsFiltersBudget([{ ...SOURCE, values: [long, long, long, long, "x"] }])).toBe(true);
  });
});
