import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildCommonFilterQuery } from "./utils";

describe("buildCommonFilterQuery", () => {
  // Test for line 32: spread existing date filter when adding startDate
  it("should preserve existing date filter when adding startDate", () => {
    const query: Prisma.ResponseFindManyArgs = {
      where: {
        createdAt: {
          lte: new Date("2024-12-31"),
        },
      },
    };
    const startDate = new Date("2024-01-01");

    const result = buildCommonFilterQuery(query, { startDate });

    expect(result.where?.createdAt).toEqual({
      lte: new Date("2024-12-31"),
      gte: startDate,
    });
  });

  // Test for line 45: spread existing date filter when adding endDate
  it("should preserve existing date filter when adding endDate", () => {
    const query: Prisma.ResponseFindManyArgs = {
      where: {
        createdAt: {
          gte: new Date("2024-01-01"),
        },
      },
    };
    const endDate = new Date("2024-12-31");

    const result = buildCommonFilterQuery(query, { endDate });

    expect(result.where?.createdAt).toEqual({
      gte: new Date("2024-01-01"),
      lte: endDate,
    });
  });
});
