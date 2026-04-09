import { beforeEach, describe, expect, test, vi } from "vitest";
import { TGetContactAttributeKeysFilter } from "@/modules/api/v2/management/contact-attribute-keys/types/contact-attribute-keys";
import { getContactAttributeKeysQuery } from "../utils";

describe("getContactAttributeKeysQuery", () => {
  const baseParams: TGetContactAttributeKeysFilter = {
    limit: 10,
    skip: 0,
    order: "asc",
    sortBy: "createdAt",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns query with workspaceId in array when no params are provided", () => {
    const workspaceIds = ["ws-1", "ws-2"];
    const result = getContactAttributeKeysQuery(workspaceIds);

    expect(result).toEqual({
      where: {
        workspaceId: {
          in: workspaceIds,
        },
      },
    });
  });

  test("applies common filters when provided", () => {
    const workspaceIds = ["ws-1", "ws-2"];
    const params: TGetContactAttributeKeysFilter = {
      ...baseParams,
    };
    const result = getContactAttributeKeysQuery(workspaceIds, params);

    expect(result).toEqual({
      where: {
        workspaceId: {
          in: workspaceIds,
        },
      },
      take: 10,
      orderBy: {
        createdAt: "asc",
      },
    });
  });

  test("applies date filters when provided", () => {
    const workspaceIds = ["ws-1", "ws-2"];
    const startDate = new Date("2023-01-01");
    const endDate = new Date("2023-12-31");

    const params: TGetContactAttributeKeysFilter = {
      ...baseParams,
      startDate,
      endDate,
    };
    const result = getContactAttributeKeysQuery(workspaceIds, params);

    expect(result).toEqual({
      where: {
        workspaceId: {
          in: workspaceIds,
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      take: 10,
      orderBy: {
        createdAt: "asc",
      },
    });
  });

  test("handles multiple filter parameters correctly", () => {
    const workspaceIds = ["ws-1", "ws-2"];
    const params: TGetContactAttributeKeysFilter = {
      limit: 5,
      skip: 10,
      sortBy: "updatedAt",
      order: "asc",
    };
    const result = getContactAttributeKeysQuery(workspaceIds, params);

    expect(result).toEqual({
      where: {
        workspaceId: {
          in: workspaceIds,
        },
      },
      take: 5,
      skip: 10,
      orderBy: {
        updatedAt: "asc",
      },
    });
  });
});
