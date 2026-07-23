import { describe, expect, test } from "vitest";
import { computeStatusIn, parseStoredWorkflowFilters } from "./list-filters";

describe("computeStatusIn", () => {
  test("empty selection -> undefined (API default excludes archived)", () => {
    expect(computeStatusIn([])).toBeUndefined();
  });

  test("non-empty selection -> the selected statuses verbatim", () => {
    expect(computeStatusIn(["draft", "disabled"])).toEqual(["draft", "disabled"]);
  });

  test("archived flows through when it is one of the selected statuses", () => {
    expect(computeStatusIn(["enabled", "archived"])).toEqual(["enabled", "archived"]);
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
        JSON.stringify({ searchValue: "x", selectedStatuses: ["bogus"], sortBy: "updatedAt" })
      )
    ).toBeNull();
  });

  test("parses a valid payload (archived is an allowed status)", () => {
    const stored = {
      searchValue: "foo",
      selectedStatuses: ["draft", "archived"],
      sortBy: "name",
    };
    expect(parseStoredWorkflowFilters(JSON.stringify(stored))).toEqual(stored);
  });

  test("strips a legacy showArchived field instead of rejecting it", () => {
    const parsed = parseStoredWorkflowFilters(
      JSON.stringify({ searchValue: "", selectedStatuses: [], sortBy: "updatedAt", showArchived: true })
    );
    expect(parsed).toEqual({ searchValue: "", selectedStatuses: [], sortBy: "updatedAt" });
  });
});
