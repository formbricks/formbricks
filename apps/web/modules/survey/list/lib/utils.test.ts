import { describe, expect, test } from "vitest";
import { hasActiveSurveyFilters, normalizeSurveyFilters, parseStoredSurveyFilters } from "./utils";

describe("normalizeSurveyFilters", () => {
  test("returns the normalized default filters when input is empty", () => {
    expect(normalizeSurveyFilters(undefined)).toEqual({
      name: "",
      status: [],
      type: [],
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
        sortBy: "name",
      } as any)
    ).toEqual({
      name: "Customer feedback",
      status: ["draft", "paused"],
      type: ["app", "link"],
      sortBy: "name",
    });
  });

  test("drops type filters when the project channel is link-only", () => {
    expect(
      normalizeSurveyFilters(
        {
          name: "",
          status: [],
          type: ["app", "link"],
          sortBy: "updatedAt",
        },
        "link"
      )
    ).toEqual({
      name: "",
      status: [],
      type: [],
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
      sortBy: "createdAt",
    });
  });
});

describe("hasActiveSurveyFilters", () => {
  test("ignores sort-only changes", () => {
    expect(
      hasActiveSurveyFilters({
        name: "",
        status: [],
        type: [],
        sortBy: "createdAt",
      })
    ).toBe(false);
  });

  test("detects active filters", () => {
    expect(
      hasActiveSurveyFilters({
        name: "CSAT",
        status: [],
        type: [],
        sortBy: "relevance",
      })
    ).toBe(true);
  });
});
