import { TGetContactAttributeKeysFilter } from "@/modules/api/v2/management/contact-attribute-keys/types/contact-attribute-keys";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getContactAttributeKeysQuery } from "../utils";

describe("getContactAttributeKeysQuery", () => {
  const environmentId = "env-123";
  const baseParams: TGetContactAttributeKeysFilter = {
    limit: 10,
    skip: 0,
    order: "asc",
    sortBy: "createdAt",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns query with environmentId in array when no params are provided", () => {
    const environmentIds = ["env-1", "env-2"];
    const result = getContactAttributeKeysQuery(environmentIds);

    expect(result).toEqual({
      where: {
        environmentId: {
          in: environmentIds,
        },
      },
    });
  });

  test("applies common filters when provided", () => {
    const environmentIds = ["env-1", "env-2"];
    const params: TGetContactAttributeKeysFilter = {
      ...baseParams,
      environmentId,
    };
    const result = getContactAttributeKeysQuery(environmentIds, params);

    expect(result).toEqual({
      where: {
        environmentId: {
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
      environmentId,
      startDate,
      endDate,
    };
    const result = getContactAttributeKeysQuery(environmentIds, params);

    expect(result).toEqual({
      where: {
        environmentId: {
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
      environmentId,
      limit: 5,
      skip: 10,
      sortBy: "updatedAt",
      order: "asc",
    };
    const result = getContactAttributeKeysQuery(environmentIds, params);

    expect(result).toEqual({
      where: {
        environmentId: {
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
