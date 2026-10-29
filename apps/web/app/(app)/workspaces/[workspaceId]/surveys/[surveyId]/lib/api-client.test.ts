import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { getResponseFilterOptions } from "./api-client";

const SURVEY_ID = "clsrv11111111111111111111";
const OPTIONS = {
  tags: [{ id: "cltag1111111111111111111", name: "vip" }],
  attributes: { plan: ["Pro"] },
  hiddenFields: {},
  reservedValues: {},
  variableValues: {},
  quotas: [],
};
const PATH = `GET /api/internal/response-filter-options?surveyId=${SURVEY_ID}`;

describe("survey responses API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads the filter options of the survey named in the query", async () => {
    routeFetch({ [PATH]: [json({ data: OPTIONS })] });

    await expect(getResponseFilterOptions(SURVEY_ID)).resolves.toEqual(OPTIONS);
  });

  test("a refused read throws a V3ApiError carrying the status", async () => {
    routeFetch({ [PATH]: [json({ status: 403, detail: "Forbidden", code: "forbidden" }, 403)] });

    const error = await getResponseFilterOptions(SURVEY_ID).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(V3ApiError);
    expect((error as V3ApiError).status).toBe(403);
  });
});
