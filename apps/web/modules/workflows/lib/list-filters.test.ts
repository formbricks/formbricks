import { describe, expect, test } from "vitest";
import { ZWorkflowStatus } from "@formbricks/workflows";
import { computeStatusIn, parseStoredWorkflowFilters } from "./list-filters";

describe("computeStatusIn", () => {
  test("filter empty + toggle OFF -> undefined (API default excludes archived)", () => {
    expect(computeStatusIn([], false)).toBeUndefined();
  });

  test("filter empty + toggle ON -> all four statuses including archived", () => {
    expect(computeStatusIn([], true)).toEqual([...ZWorkflowStatus.options]);
    expect(computeStatusIn([], true)).toContain("archived");
  });

  test("filter non-empty + toggle OFF -> the selected statuses only", () => {
    expect(computeStatusIn(["draft", "disabled"], false)).toEqual(["draft", "disabled"]);
  });

  test("filter non-empty + toggle ON -> selected statuses plus archived", () => {
    expect(computeStatusIn(["enabled"], true)).toEqual(["enabled", "archived"]);
  });
});

describe("parseStoredWorkflowFilters", () => {
  test("returns null for null or empty input", () => {
    expect(parseStoredWorkflowFilters(null)).toBeNull();
    expect(parseStoredWorkflowFilters("")).toBeNull();
  });

  test("returns null for invalid JSON", () => {
    expect(parseStoredWorkflowFilters("{not json")).toBeNull();
  });

  test("returns null for a payload that does not match the schema", () => {
    expect(parseStoredWorkflowFilters(JSON.stringify({ searchValue: 5 }))).toBeNull();
    expect(
      parseStoredWorkflowFilters(
        JSON.stringify({
          searchValue: "x",
          selectedStatuses: ["bogus"],
          sortBy: "updatedAt",
          showArchived: false,
        })
      )
    ).toBeNull();
  });

  test("parses a valid payload", () => {
    const stored = {
      searchValue: "foo",
      selectedStatuses: ["draft", "enabled"],
      sortBy: "name",
      showArchived: true,
    };
    expect(parseStoredWorkflowFilters(JSON.stringify(stored))).toEqual(stored);
  });
});
