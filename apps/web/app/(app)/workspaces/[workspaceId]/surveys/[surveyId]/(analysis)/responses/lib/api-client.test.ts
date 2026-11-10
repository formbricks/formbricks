import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { countSurveyResponses, querySurveyResponses } from "./api-client";

const SURVEY_ID = "clsurvey11111111111111111";
const BASE = `/api/internal/surveys/${SURVEY_ID}/responses`;
const CREATED_AT = "2026-10-01T10:00:00.000Z";
const UPDATED_AT = "2026-10-02T10:00:00.000Z";
const filterCriteria: TResponseFilterCriteria = {
  finished: true,
  createdAt: { min: new Date("2026-09-01T00:00:00.000Z") },
};

const wireResponse = {
  id: "clresp1111111111111111111",
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  surveyId: SURVEY_ID,
  displayId: null,
  contact: null,
  contactAttributes: null,
  finished: true,
  endingId: null,
  data: { q1: "Great" },
  variables: {},
  ttc: {},
  tags: [
    {
      id: "cltag11111111111111111111",
      name: "vip",
      workspaceId: "clwork1111111111111111111",
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    },
  ],
  meta: {},
  singleUseId: null,
  language: null,
  outcome: null,
  quotas: [],
  notShown: null,
};

const init = () => vi.mocked(global.fetch).mock.calls[0][1];
const sentBody = () => JSON.parse(String(init()?.body));

describe("survey responses API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("POSTs the page and filter, and revives every timestamp to a Date", async () => {
    routeFetch({ [`POST ${BASE}/queries`]: [json({ data: [wireResponse] })] });

    const [response] = await querySurveyResponses({
      surveyId: SURVEY_ID,
      limit: 25,
      offset: 50,
      filterCriteria,
    });

    expect(sentBody()).toEqual({
      limit: 25,
      offset: 50,
      filterCriteria: { finished: true, createdAt: { min: "2026-09-01T00:00:00.000Z" } },
    });
    expect(response.createdAt).toEqual(new Date(CREATED_AT));
    expect(response.updatedAt).toEqual(new Date(UPDATED_AT));
    expect(response.tags[0].createdAt).toEqual(new Date(CREATED_AT));
    expect(response.tags[0].updatedAt).toEqual(new Date(UPDATED_AT));
  });

  // The server actions had no client timeout; a large filtered survey can take a while.
  test("waits as long as the server takes", async () => {
    routeFetch({ [`POST ${BASE}/queries`]: [json({ data: [] })] });

    await querySurveyResponses({ surveyId: SURVEY_ID, limit: 25, offset: 0, filterCriteria: {} });

    expect(init()?.signal).toBeUndefined();
  });

  test("counts the matching responses, forwarding the query's cancellation", async () => {
    routeFetch({ [`POST ${BASE}/counts`]: [json({ data: { count: 42 } })] });
    const controller = new AbortController();

    await expect(
      countSurveyResponses({ surveyId: SURVEY_ID, filterCriteria, signal: controller.signal })
    ).resolves.toBe(42);
    expect(sentBody()).toEqual({
      filterCriteria: { finished: true, createdAt: { min: "2026-09-01T00:00:00.000Z" } },
    });
    expect(init()?.signal).toBe(controller.signal);
  });

  test("a refused read throws a V3ApiError carrying the status", async () => {
    routeFetch({
      [`POST ${BASE}/queries`]: [json({ status: 403, detail: "Forbidden", code: "forbidden" }, 403)],
    });

    const error = await querySurveyResponses({
      surveyId: SURVEY_ID,
      limit: 25,
      offset: 0,
      filterCriteria: {},
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(V3ApiError);
    expect((error as V3ApiError).status).toBe(403);
  });
});
