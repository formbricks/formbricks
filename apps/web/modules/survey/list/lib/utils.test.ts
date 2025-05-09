import { describe, expect, test } from "vitest";
import type { TSurveyFilters } from "@formbricks/types/surveys/types";
import { getFormattedFilters } from "./utils";

describe("getFormattedFilters", () => {
  test("returns empty object when no filters provided", () => {
    const result = getFormattedFilters({} as TSurveyFilters, "user1");
    expect(result).toEqual({});
  });

  test("includes name filter", () => {
    const result = getFormattedFilters({ name: "surveyName" } as TSurveyFilters, "user1");
    expect(result).toEqual({ name: "surveyName" });
  });

  test("includes status filter when array is non-empty", () => {
    const result = getFormattedFilters({ status: ["active", "inactive"] } as any, "user1");
    expect(result).toEqual({ status: ["active", "inactive"] });
  });

  test("ignores status filter when empty array", () => {
    const result = getFormattedFilters({ status: [] } as any, "user1");
    expect(result).toEqual({});
  });

  test("includes type filter when array is non-empty", () => {
    const result = getFormattedFilters({ type: ["typeA"] } as any, "user1");
    expect(result).toEqual({ type: ["typeA"] });
  });

  test("ignores type filter when empty array", () => {
    const result = getFormattedFilters({ type: [] } as any, "user1");
    expect(result).toEqual({});
  });

  test("includes createdBy filter when array is non-empty", () => {
    const result = getFormattedFilters({ createdBy: ["ownerA", "ownerB"] } as any, "user1");
    expect(result).toEqual({ createdBy: { userId: "user1", value: ["ownerA", "ownerB"] } });
  });

  test("ignores createdBy filter when empty array", () => {
    const result = getFormattedFilters({ createdBy: [] } as any, "user1");
    expect(result).toEqual({});
  });

  test("includes sortBy filter", () => {
    const result = getFormattedFilters({ sortBy: "date" } as any, "user1");
    expect(result).toEqual({ sortBy: "date" });
  });

  test("combines multiple filters", () => {
    const input: TSurveyFilters = {
      name: "nameVal",
      status: ["draft"],
      type: ["link", "app"],
      createdBy: ["you"],
      sortBy: "name",
    };
    const result = getFormattedFilters(input, "userX");
    expect(result).toEqual({
      name: "nameVal",
      status: ["draft"],
      type: ["link", "app"],
      createdBy: { userId: "userX", value: ["you"] },
      sortBy: "name",
    });
  });
});
