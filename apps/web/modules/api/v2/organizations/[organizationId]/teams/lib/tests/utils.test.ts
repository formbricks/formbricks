import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { Prisma } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import { getTeamsQuery } from "../utils";

// Mock the common utils functions
vi.mock("@/modules/api/v2/management/lib/utils", () => ({
  pickCommonFilter: vi.fn(),
  buildCommonFilterQuery: vi.fn(),
}));

describe("getTeamsQuery", () => {
  const organizationId = "org123";

  test("returns base query when no params provided", () => {
    const result = getTeamsQuery(organizationId);
    expect(result.where).toEqual({ organizationId });
  });

  test("returns unchanged query if pickCommonFilter returns null/undefined", () => {
    vi.mocked(pickCommonFilter).mockReturnValueOnce(null as any);
    const params: any = { someParam: "test" };
    const result = getTeamsQuery(organizationId, params);
    expect(pickCommonFilter).toHaveBeenCalledWith(params);
    // Since pickCommonFilter returns undefined, query remains as base query.
    expect(result.where).toEqual({ organizationId });
  });

  test("calls buildCommonFilterQuery and returns updated query when base filter exists", () => {
    const baseFilter = { key: "value" };
    vi.mocked(pickCommonFilter).mockReturnValueOnce(baseFilter as any);
    // Simulate buildCommonFilterQuery to merge base query with baseFilter
    const updatedQuery = { where: { organizationId, combined: true } } as Prisma.TeamFindManyArgs;
    vi.mocked(buildCommonFilterQuery).mockReturnValueOnce(updatedQuery);

    const params: any = { someParam: "test" };
    const result = getTeamsQuery(organizationId, params);

    expect(pickCommonFilter).toHaveBeenCalledWith(params);
    expect(buildCommonFilterQuery).toHaveBeenCalledWith({ where: { organizationId } }, baseFilter);
    expect(result).toEqual(updatedQuery);
  });
});
