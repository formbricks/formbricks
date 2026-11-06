import { describe, expect, test } from "vitest";
import type { TFilterProperty } from "./types";
import { MAX_LABEL_SEARCH_LENGTH, collectValueLabels, valuesToLabel, valuesToSearch } from "./value-labels";

const loadOptions = async () => ({ options: [], hasMore: false });
const option: TFilterProperty = {
  id: "FeedbackRecords.valueId",
  label: "Value (Option)",
  valueType: "enum",
  options: [{ value: "none", label: "(No value)" }],
  labelledValues: true,
  loadOptions,
};

describe("valuesToLabel", () => {
  test("each distinct picked value of a labelled property its fixed options do not name", () => {
    expect(valuesToLabel(option, ["late", "late", "none", "", "ontime"])).toEqual(["late", "ontime"]);
  });

  test("none for a property whose listed values are their own labels, or that lists nothing", () => {
    expect(valuesToLabel({ ...option, labelledValues: undefined }, ["late"])).toEqual([]);
    expect(valuesToLabel({ ...option, loadOptions: undefined }, ["late"])).toEqual([]);
  });
});

describe("valuesToSearch", () => {
  test("the values the first page does not hold, once it is loaded", () => {
    const page = { options: [{ value: "late", label: "Late" }], hasMore: true };
    expect(valuesToSearch(["late", "ontime"], page)).toEqual(["ontime"]);
    expect(valuesToSearch(["late", "ontime"], undefined)).toEqual([]);
  });

  test("never a value too long to search for", () => {
    const long = "x".repeat(MAX_LABEL_SEARCH_LENGTH + 1);
    expect(valuesToSearch([long], { options: [], hasMore: true })).toEqual([]);
  });
});

describe("collectValueLabels", () => {
  test("the label of each wanted value any page lists, the first page's first", () => {
    expect(
      collectValueLabels(
        ["late", "ontime"],
        [
          {
            options: [
              { value: "late", label: "Late" },
              { value: "other", label: "Other" },
            ],
            hasMore: true,
          },
          undefined,
          {
            options: [
              { value: "ontime", label: "On time" },
              { value: "late", label: "Later" },
            ],
            hasMore: false,
          },
        ]
      )
    ).toEqual({ late: "Late", ontime: "On time" });
  });
});
