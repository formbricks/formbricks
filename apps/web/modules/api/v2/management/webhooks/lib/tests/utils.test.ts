import { TGetWebhooksFilter } from "@/modules/api/v2/management/webhooks/types/webhooks";
import { describe, expect, it } from "vitest";
import { getWebhooksQuery } from "../utils";

describe("getWebhooksQuery", () => {
  it("returns basic query with environmentId only", () => {
    const environmentId = "env1";
    const result = getWebhooksQuery(environmentId);
    expect(result).toEqual({
      where: {
        environmentId,
      },
    });
  });

  it("adds surveyIds filter when provided", () => {
    const environmentId = "env1";
    const surveyIds = ["survey1", "survey2"];
    const result = getWebhooksQuery(environmentId, { surveyIds } as TGetWebhooksFilter);
    expect(result.where).toEqual({
      environmentId,
      surveyIds: { hasSome: surveyIds },
    });
  });

  it("adds startDate filter when provided", () => {
    const environmentId = "env1";
    const startDate = "2023-01-01T00:00:00.000Z";
    const result = getWebhooksQuery(environmentId, { startDate } as unknown as TGetWebhooksFilter);
    expect(result.where).toEqual({
      environmentId,
      createdAt: { gte: startDate },
    });
  });

  it("adds endDate filter when provided", () => {
    const environmentId = "env1";
    const endDate = "2023-12-31T23:59:59.999Z";
    const result = getWebhooksQuery(environmentId, { endDate } as unknown as TGetWebhooksFilter);
    expect(result.where).toEqual({
      environmentId,
      createdAt: { lte: endDate },
    });
  });

  it("adds orderBy when sortBy is provided", () => {
    const environmentId = "env1";
    const sortBy = "createdAt";
    const order = "asc";
    const result = getWebhooksQuery(environmentId, { sortBy, order } as TGetWebhooksFilter);
    expect(result.orderBy).toEqual({
      [sortBy]: order,
    });
  });

  it("adds take (limit) when provided", () => {
    const environmentId = "env1";
    const limit = 5;
    const result = getWebhooksQuery(environmentId, { limit } as TGetWebhooksFilter);
    expect(result.take).toBe(limit);
  });

  it("adds skip when provided", () => {
    const environmentId = "env1";
    const skip = 10;
    const result = getWebhooksQuery(environmentId, { skip } as TGetWebhooksFilter);
    expect(result.skip).toBe(skip);
  });

  it("combines multiple filters", () => {
    const environmentId = "env1";
    const params = {
      surveyIds: ["survey1"],
      startDate: "2023-01-01T00:00:00.000Z",
      endDate: "2023-12-31T23:59:59.999Z",
      sortBy: "updatedAt",
      order: "desc",
      limit: 10,
      skip: 5,
    };
    const result = getWebhooksQuery(environmentId, params as unknown as TGetWebhooksFilter);
    expect(result).toEqual({
      where: {
        environmentId,
        surveyIds: { hasSome: params.surveyIds },
        createdAt: { gte: params.startDate, lte: params.endDate },
      },
      orderBy: { [params.sortBy]: params.order },
      take: params.limit,
      skip: params.skip,
    });
  });
});
