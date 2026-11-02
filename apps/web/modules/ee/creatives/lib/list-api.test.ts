import { describe, expect, test } from "vitest";
import { buildCreativeListSearchParams } from "./list-api";
import { INITIAL_CREATIVE_FILTERS } from "./list-filters";

const WORKSPACE_ID = "clxworkspace0000000000000";

describe("buildCreativeListSearchParams", () => {
  test("asks for the first page in the chosen sort, leaving archived out by sending no status", () => {
    const params = buildCreativeListSearchParams({
      workspaceId: WORKSPACE_ID,
      limit: 12,
      filters: INITIAL_CREATIVE_FILTERS,
    });

    expect([...params.entries()]).toEqual([
      ["workspaceId", WORKSPACE_ID],
      ["limit", "12"],
      ["sortBy", "updatedAt"],
    ]);
  });

  test("sends the trimmed search, each picked status and type, and the cursor", () => {
    const params = buildCreativeListSearchParams({
      workspaceId: WORKSPACE_ID,
      limit: 12,
      cursor: "next-page",
      filters: {
        name: "  notice ",
        displayStatuses: ["active", "archived"],
        types: ["banner"],
        sortBy: "name",
      },
    });

    expect(params.get("filter[name][contains]")).toBe("notice");
    expect(params.getAll("filter[displayStatus][in]")).toEqual(["active", "archived"]);
    expect(params.getAll("filter[type][in]")).toEqual(["banner"]);
    expect(params.get("sortBy")).toBe("name");
    expect(params.get("cursor")).toBe("next-page");
  });

  test("drops a search that is only spaces", () => {
    const params = buildCreativeListSearchParams({
      workspaceId: WORKSPACE_ID,
      limit: 12,
      filters: { ...INITIAL_CREATIVE_FILTERS, name: "   " },
    });

    expect(params.has("filter[name][contains]")).toBe(false);
  });
});
