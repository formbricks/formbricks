import { describe, expect, test } from "vitest";
import {
  getNormalizedVisibility,
  normalizeSurveyFilters,
  parseStoredSurveyFilters,
  serializeStoredSurveyFilters,
} from "./utils";

describe("normalizeSurveyFilters", () => {
  test("returns the normalized default filters when input is empty", () => {
    expect(normalizeSurveyFilters(undefined)).toEqual({
      name: "",
      status: [],
      type: [],
      visibility: [],
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
        sortBy: "name",
      } as any)
    ).toEqual({
      name: "Customer feedback",
      status: ["draft", "paused"],
      type: ["app", "link"],
      visibility: ["restricted", "workspace"],
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
          sortBy: "updatedAt",
        },
        "link"
      )
    ).toEqual({
      name: "",
      status: [],
      type: [],
      visibility: [],
      sortBy: "updatedAt",
    });
  });
});

describe("parseStoredSurveyFilters", () => {
  test("returns null for invalid JSON", () => {
    expect(parseStoredSurveyFilters("{")).toBeNull();
  });

  test("sanitizes legacy stored filters", () => {
    expect(
      parseStoredSurveyFilters(
        JSON.stringify({
          name: "  NPS  ",
          createdBy: ["you"],
          status: ["completed", "draft"],
          type: ["link"],
          sortBy: "createdAt",
        })
      )
    ).toEqual({
      name: "NPS",
      status: ["completed", "draft"],
      type: ["link"],
      visibility: [],
      sortBy: "createdAt",
    });
  });

  test("drops a stored visibility filter: it is not remembered between visits", () => {
    expect(
      parseStoredSurveyFilters(
        JSON.stringify({ name: "", status: [], type: [], visibility: ["restricted"], sortBy: "name" })
      )
    ).toEqual({ name: "", status: [], type: [], visibility: [], sortBy: "name" });
  });
});

describe("serializeStoredSurveyFilters", () => {
  test("omits visibility and round-trips everything else", () => {
    const filters = {
      name: "NPS",
      status: ["draft" as const],
      type: ["link" as const],
      visibility: ["workspace" as const],
      sortBy: "name" as const,
    };

    const serialized = serializeStoredSurveyFilters(filters);

    expect(JSON.parse(serialized)).not.toHaveProperty("visibility");
    expect(parseStoredSurveyFilters(serialized)).toEqual({ ...filters, visibility: [] });
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
