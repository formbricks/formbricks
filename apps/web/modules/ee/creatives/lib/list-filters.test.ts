import { describe, expect, test } from "vitest";
import type { TTableFilter } from "@/modules/ui/components/table-toolbar/lib/types";
import { setShowArchived, toCreativeListFilters } from "./list-filters";

const status = (...values: string[]): TTableFilter => ({ property: "status", operator: "in", values });

describe("toCreativeListFilters", () => {
  test("no filters ask for the API default: live creatives, newest edit first", () => {
    expect(toCreativeListFilters([], "  notice ", "updatedAt")).toEqual({
      name: "notice",
      displayStatuses: [],
      types: [],
      sortBy: "updatedAt",
    });
  });

  test("ticked statuses and types are what the API is asked for", () => {
    expect(
      toCreativeListFilters(
        [status("active", "paused"), { property: "type", operator: "in", values: ["banner"] }],
        "",
        "name"
      )
    ).toMatchObject({ displayStatuses: ["active", "paused"], types: ["banner"], sortBy: "name" });
  });

  test("Show archived adds archived on top of the picked statuses, or of every live one", () => {
    expect(toCreativeListFilters(setShowArchived([status("draft")], true), "", "updatedAt")).toMatchObject({
      displayStatuses: ["draft", "archived"],
    });
    expect(toCreativeListFilters(setShowArchived([], true), "", "updatedAt")?.displayStatuses).toEqual([
      "draft",
      "scheduled",
      "active",
      "paused",
      "closed",
      "archived",
    ]);
  });

  test("filters that exclude every status match nothing", () => {
    expect(
      toCreativeListFilters(
        [status("draft"), { property: "status", operator: "notEquals", values: ["draft"] }],
        "",
        "updatedAt"
      )
    ).toBeNull();
  });

  test("an unknown sort in the URL falls back to the default", () => {
    expect(toCreativeListFilters([], "", "runs")?.sortBy).toBe("updatedAt");
  });
});
