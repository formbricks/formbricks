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
    const environmentIds = ["env-1", "env-2"];
    const result = getContactAttributeKeysQuery(environmentIds);

    expect(result).toEqual({
      where: {
        workspaceId: {
          in: environmentIds,
        },
      },
    });
  });

  test("applies common filters when provided", () => {
    const environmentIds = ["env-1", "env-2"];
    const params: TGetContactAttributeKeysFilter = {
      ...baseParams,
    };
    const result = getContactAttributeKeysQuery(environmentIds, params);

    expect(result).toEqual({
      where: {
        workspaceId: {
          in: environmentIds,
        },
      },
      take: 10,
      orderBy: {
        createdAt: "asc",
      },
    });
  });

  test("applies date filters when provided", () => {
    const environmentIds = ["env-1", "env-2"];
    const startDate = new Date("2023-01-01");
    const endDate = new Date("2023-12-31");

    const params: TGetContactAttributeKeysFilter = {
      ...baseParams,
      startDate,
      endDate,
    };
    const result = getContactAttributeKeysQuery(environmentIds, params);

    expect(result).toEqual({
      where: {
        workspaceId: {
          in: environmentIds,
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
    const environmentIds = ["env-1", "env-2"];
    const params: TGetContactAttributeKeysFilter = {
      limit: 5,
      skip: 10,
      sortBy: "updatedAt",
      order: "asc",
    };
    const result = getContactAttributeKeysQuery(environmentIds, params);

    expect(result).toEqual({
      where: {
        workspaceId: {
          in: environmentIds,
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
