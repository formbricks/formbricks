import { describe, expect, test } from "vitest";
import { getNormalizedVisibility, normalizeSurveyFilters } from "./utils";

describe("normalizeSurveyFilters", () => {
  test("returns the normalized default filters when input is empty", () => {
    expect(normalizeSurveyFilters(undefined)).toEqual({
      name: "",
      status: [],
      type: [],
      visibility: [],
      owner: [],
      sortBy: "relevance",
    });
  });

  test("trims names, removes unsupported fields, and sorts filter arrays", () => {
    expect(
      normalizeSurveyFilters({
        name: "  Customer feedback  ",
        createdBy: ["you"],
        status: ["paused", "draft", "paused"],
        type: ["link", "app", "link"],
        visibility: ["workspace", "private", "restricted", "workspace"],
        owner: [],
        sortBy: "name",
      } as any)
    ).toEqual({
      name: "Customer feedback",
      status: ["draft", "paused"],
      type: ["app", "link"],
      visibility: ["restricted", "workspace"],
      owner: [],
      sortBy: "name",
    });
  });

  test("drops type filters when the workspace channel is link-only", () => {
    expect(
      normalizeSurveyFilters(
        {
          name: "",
          status: [],
          type: ["app", "link"],
          visibility: [],
          owner: [],
          sortBy: "updatedAt",
        },
        "link"
      )
    ).toEqual({
      name: "",
      status: [],
      type: [],
      visibility: [],
      owner: [],
      sortBy: "updatedAt",
    });
  });
});

describe("getNormalizedVisibility", () => {
  test("keeps known values, dedupes and sorts them", () => {
    expect(getNormalizedVisibility(["workspace", "restricted", "workspace"])).toEqual([
      "restricted",
      "workspace",
    ]);
  });

  test("drops unknown values and non-arrays", () => {
    expect(getNormalizedVisibility(["private", 1, null])).toEqual([]);
    expect(getNormalizedVisibility("restricted")).toEqual([]);
    expect(getNormalizedVisibility(undefined)).toEqual([]);
  });
});
