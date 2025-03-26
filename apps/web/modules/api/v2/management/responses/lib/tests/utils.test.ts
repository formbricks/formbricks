import { TGetResponsesFilter } from "@/modules/api/v2/management/responses/types/responses";
import { describe, expect, test } from "vitest";
import { getResponsesQuery } from "../utils";

describe("getResponsesQuery", () => {
  const environmentId = "env_1";
  const filters: TGetResponsesFilter = {
    limit: 10,
    skip: 0,
    sortBy: "createdAt",
    order: "asc",
  };

  test("return the base query when no params are provided", () => {
    const query = getResponsesQuery([environmentId]);
    expect(query).toEqual({
      where: {
        survey: { environmentId: { in: [environmentId] } },
      },
    });
  });

  test("add surveyId to the query when provided", () => {
    const query = getResponsesQuery([environmentId], { ...filters, surveyId: "survey_1" });
    expect(query.where).toEqual({
      survey: { environmentId: { in: [environmentId] } },
      surveyId: "survey_1",
    });
  });

  test("add startDate filter to the query", () => {
    const startDate = new Date("2023-01-01");
    const query = getResponsesQuery([environmentId], { ...filters, startDate });
    expect(query.where).toEqual({
      survey: { environmentId: { in: [environmentId] } },
      createdAt: { gte: startDate },
    });
  });

  test("add endDate filter to the query", () => {
    const endDate = new Date("2023-01-31");
    const query = getResponsesQuery([environmentId], { ...filters, endDate });
    expect(query.where).toEqual({
      survey: { environmentId: { in: [environmentId] } },
      createdAt: { lte: endDate },
    });
  });

  test("add sortBy and order to the query", () => {
    const query = getResponsesQuery([environmentId], { ...filters, sortBy: "createdAt", order: "desc" });
    expect(query.orderBy).toEqual({
      createdAt: "desc",
    });
  });

  test("add limit (take) to the query", () => {
    const query = getResponsesQuery([environmentId], { ...filters, limit: 10 });
    expect(query.take).toBe(10);
  });

  test("add skip to the query", () => {
    const query = getResponsesQuery([environmentId], { ...filters, skip: 5 });
    expect(query.skip).toBe(5);
  });

  test("add contactId to the query", () => {
    const query = getResponsesQuery([environmentId], { ...filters, contactId: "contact_1" });
    expect(query.where).toEqual({
      survey: { environmentId: { in: [environmentId] } },
      contactId: "contact_1",
    });
  });

  test("combine multiple filters correctly", () => {
    const params = {
      ...filters,
      surveyId: "survey_1",
      startDate: new Date("2023-01-01"),
      endDate: new Date("2023-01-31"),
      limit: 20,
      skip: 10,
      contactId: "contact_1",
    };
    const query = getResponsesQuery([environmentId], params);
    expect(query.where).toEqual({
      survey: { environmentId: { in: [environmentId] } },
      surveyId: "survey_1",
      createdAt: { lte: params.endDate, gte: params.startDate },
      contactId: "contact_1",
    });
    expect(query.orderBy).toEqual({
      createdAt: "asc",
    });
    expect(query.take).toBe(20);
    expect(query.skip).toBe(10);
  });
});
