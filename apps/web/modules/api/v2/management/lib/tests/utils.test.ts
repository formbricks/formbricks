import { TGetFilter } from "@/modules/api/v2/types/api-filter";
import { Prisma } from "@prisma/client";
import { describe, expect, test } from "vitest";
import { buildCommonFilterQuery, hashApiKey, pickCommonFilter } from "../utils";

describe("hashApiKey", () => {
  test("generate the correct sha256 hash for a given input", () => {
    const input = "test";
    const expectedHash = "fake-hash"; // mocked on the vitestSetup.ts file;
    const result = hashApiKey(input);
    expect(result).toEqual(expectedHash);
  });

  test("return a string with length 64", () => {
    const input = "another-api-key";
    const result = hashApiKey(input);
    expect(result).toHaveLength(9); // mocked on the vitestSetup.ts file;;
  });
});

describe("pickCommonFilter", () => {
  test("picks the common filter fields correctly", () => {
    const params = {
      limit: 10,
      skip: 5,
      sortBy: "createdAt",
      order: "asc",
      startDate: new Date("2023-01-01"),
      endDate: new Date("2023-12-31"),
    } as TGetFilter;
    const result = pickCommonFilter(params);
    expect(result).toEqual(params);
  });

  test("handles missing fields gracefully", () => {
    const params = { limit: 10 } as TGetFilter;
    const result = pickCommonFilter(params);
    expect(result).toEqual({
      limit: 10,
      skip: undefined,
      sortBy: undefined,
      order: undefined,
      startDate: undefined,
      endDate: undefined,
    });
  });

  describe("buildCommonFilterQuery", () => {
    test("applies startDate and endDate when provided", () => {
      const query: Prisma.WebhookFindManyArgs = { where: {} };
      const params = {
        startDate: new Date("2023-01-01"),
        endDate: new Date("2023-12-31"),
      } as TGetFilter;
      const result = buildCommonFilterQuery(query, params);
      expect(result.where?.createdAt?.gte).toEqual(params.startDate);
      expect(result.where?.createdAt?.lte).toEqual(params.endDate);
    });

    test("applies sortBy and order when provided", () => {
      const query: Prisma.WebhookFindManyArgs = { where: {} };
      const params = { sortBy: "createdAt", order: "desc" } as TGetFilter;
      const result = buildCommonFilterQuery(query, params);
      expect(result.orderBy).toEqual({ createdAt: "desc" });
    });

    test("applies limit (take) when provided", () => {
      const query: Prisma.WebhookFindManyArgs = { where: {} };
      const params = { limit: 5 } as TGetFilter;
      const result = buildCommonFilterQuery(query, params);
      expect(result.take).toBe(5);
    });

    test("applies skip when provided", () => {
      const query: Prisma.WebhookFindManyArgs = { where: {} };
      const params = { skip: 10 } as TGetFilter;
      const result = buildCommonFilterQuery(query, params);
      expect(result.skip).toBe(10);
    });

    test("handles missing fields gracefully", () => {
      const query = {};
      const params = {} as TGetFilter;
      const result = buildCommonFilterQuery(query, params);
      expect(result).toEqual({});
    });
  });
});
