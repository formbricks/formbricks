import { describe, expect, test } from "vitest";
import { collectAttributeKeysFromSegmentFilters } from "./segment-filter-keys";

const attribute = (key: string) => ({
  id: `f-${key}`,
  connector: "and",
  resource: {
    id: `r-${key}`,
    root: { type: "attribute", contactAttributeKey: key },
    value: "x",
    qualifier: { operator: "equals" },
  },
});

describe("collectAttributeKeysFromSegmentFilters", () => {
  test("collects attribute keys at any depth and ignores other filter types", () => {
    const filters = [
      attribute("email"),
      {
        id: "group",
        connector: "or",
        resource: [
          attribute("plan"),
          { id: "seg", connector: null, resource: { id: "s", root: { type: "segment", segmentId: "x" } } },
        ],
      },
    ];

    expect(collectAttributeKeysFromSegmentFilters(filters)).toEqual(["email", "plan"]);
  });

  test("reads nothing from a stored value that is not a filter list", () => {
    expect(collectAttributeKeysFromSegmentFilters([])).toEqual([]);
    expect(collectAttributeKeysFromSegmentFilters(null)).toEqual([]);
    expect(collectAttributeKeysFromSegmentFilters({ root: { type: "attribute" } })).toEqual([]);
  });
});
