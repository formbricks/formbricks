import { Prisma } from "@prisma/client";
import { describe, expect, test } from "vitest";
import { TGetFilter } from "@/modules/api/v2/types/api-filter";
import { buildCommonFilterQuery, pickCommonFilter } from "../utils";

describe("pickCommonFilter", () => {
  test("picks the common filter fields correctly", () => {
    const params = {
      limit: 10,
      skip: 5,
      sortBy: "createdAt",
      order: "asc",
      startDate: new Date("2023-01-01"),
      endDate: new Date("2023-12-31"),
      filterDateField: "createdAt",
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
      filterDateField: undefined,
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
      const createdAt = result.where?.createdAt as Prisma.DateTimeFilter | undefined;
      expect(createdAt?.gte).toEqual(params.startDate);
      expect(createdAt?.lte).toEqual(params.endDate);
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

    test("applies filterDateField with updatedAt when provided", () => {
      const query: Prisma.WebhookFindManyArgs = { where: {} };
      const params = {
        startDate: new Date("2023-01-01"),
        endDate: new Date("2023-12-31"),
        filterDateField: "updatedAt",
      } as TGetFilter;
      const result = buildCommonFilterQuery(query, params);
      const updatedAt = result.where?.updatedAt as Prisma.DateTimeFilter | undefined;
      expect(updatedAt?.gte).toEqual(params.startDate);
      expect(updatedAt?.lte).toEqual(params.endDate);
      expect(result.where?.createdAt).toBeUndefined();
    });

    test("defaults to createdAt when filterDateField is not provided", () => {
      const query: Prisma.WebhookFindManyArgs = { where: {} };
      const params = {
        startDate: new Date("2023-01-01"),
        endDate: new Date("2023-12-31"),
      } as TGetFilter;
      const result = buildCommonFilterQuery(query, params);
      const createdAt = result.where?.createdAt as Prisma.DateTimeFilter | undefined;
      expect(createdAt?.gte).toEqual(params.startDate);
      expect(createdAt?.lte).toEqual(params.endDate);
      expect(result.where?.updatedAt).toBeUndefined();
    });
  });
});
