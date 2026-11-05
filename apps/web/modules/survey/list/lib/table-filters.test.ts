import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import {
  getSurveyFilterProperties,
  isShowingArchived,
  setShowArchived,
  toSurveyListFilters,
} from "./table-filters";

const t = ((key: string) => key) as unknown as TFunction;

describe("getSurveyFilterProperties", () => {
  test("offers Type only outside link-only workspaces and Visibility only while it is on", () => {
    const linkOnly = getSurveyFilterProperties(t, { channel: "link", isVisibilityEnabled: false }).map(
      (p) => p.id
    );
    expect(linkOnly).toEqual(["status", "owner", "archived"]);
    const full = getSurveyFilterProperties(t, { channel: null, isVisibilityEnabled: true }).map((p) => p.id);
    expect(full).toEqual(["status", "type", "owner", "visibility", "archived"]);
  });
});

describe("toSurveyListFilters", () => {
  test("maps quick filters, search and sort onto the v3 list filters", () => {
    expect(
      toSurveyListFilters(
        [
          { property: "status", operator: "in", values: ["draft", "paused"] },
          { property: "owner", operator: "in", values: ["me"] },
        ],
        "  nps ",
        "name"
      )
    ).toEqual({
      name: "nps",
      status: ["draft", "paused"],
      type: [],
      owner: ["me"],
      visibility: [],
      sortBy: "name",
    });
  });

  test("a rule narrows its quick filter", () => {
    expect(
      toSurveyListFilters(
        [
          { property: "status", operator: "in", values: ["draft", "paused"] },
          { property: "status", operator: "notEquals", values: ["draft"] },
        ],
        "",
        "relevance"
      )?.status
    ).toEqual(["paused"]);
  });

  test("filters that exclude every status match nothing", () => {
    expect(
      toSurveyListFilters(
        [
          { property: "status", operator: "equals", values: ["draft"] },
          { property: "status", operator: "notEquals", values: ["draft"] },
        ],
        "",
        "relevance"
      )
    ).toBeNull();
  });

  test("Show archived adds archived on top of every live status when none is picked", () => {
    const filters = setShowArchived([], true);
    expect(isShowingArchived(filters)).toBe(true);
    expect(toSurveyListFilters(filters, "", "relevance")?.status).toEqual([
      "draft",
      "inProgress",
      "paused",
      "completed",
      "archived",
    ]);
    expect(isShowingArchived(setShowArchived(filters, false))).toBe(false);
  });

  test("Show archived keeps a picked status", () => {
    const filters = [
      ...setShowArchived([], true),
      { property: "status", operator: "in" as const, values: ["draft"] },
    ];
    expect(toSurveyListFilters(filters, "", "relevance")?.status).toEqual(["draft", "archived"]);
  });

  test("both values of a two-value enum is no filter, and an unknown sort falls back", () => {
    expect(
      toSurveyListFilters([{ property: "type", operator: "in", values: ["link", "app"] }], "", "bogus")
    ).toMatchObject({ type: [], sortBy: "relevance" });
  });
});
