import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST as COUNT } from "./counts/route";
import { POST as QUERY } from "./queries/route";
import { SURVEY_RESPONSES_QUERY_MAX_LIMIT, SURVEY_RESPONSES_QUERY_MAX_OFFSET } from "./schemas";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  getResponses: vi.fn(),
  getResponseCountBySurveyId: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can, assertCan: vi.fn() }));
vi.mock("@/lib/response/service", () => ({
  getResponses: mocks.getResponses,
  getResponseCountBySurveyId: mocks.getResponseCountBySurveyId,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const SURVEY_ID = "clsurvey11111111111111111";
const RESPONSE_ID = "clresp1111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const actor = { type: "user", id: USER_ID };
const CREATED_AT = new Date("2026-10-01T10:00:00.000Z");
const UPDATED_AT = new Date("2026-10-02T10:00:00.000Z");
const WINDOW_MIN = new Date("2026-09-01T00:00:00.000Z");
const WINDOW_MAX = new Date("2026-09-30T23:59:59.999Z");

const storedResponse = {
  id: RESPONSE_ID,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  surveyId: SURVEY_ID,
  displayId: null,
  contact: { id: "clcontact1111111111111111", userId: "user-1" },
  contactAttributes: { email: "a@example.com" },
  finished: true,
  endingId: null,
  data: { q1: "Great" },
  variables: {},
  ttc: { q1: 1200 },
  tags: [
    {
      id: "cltag11111111111111111111",
      name: "vip",
      workspaceId: WORKSPACE_ID,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    },
  ],
  meta: { source: "web" },
  singleUseId: null,
  language: "en",
  outcome: null,
  quotas: [{ id: "clquota111111111111111111", name: "Germany" }],
  notShown: { blocks: [], elements: ["q2"] },
};

// What the Responses page sends: a response filter whose date window crosses the wire as ISO text.
const filterCriteria = {
  finished: true,
  createdAt: { min: WINDOW_MIN.toISOString(), max: WINDOW_MAX.toISOString() },
  data: { q1: { op: "equals", value: "Great" } },
  tags: { applied: ["vip"] },
};
const revivedFilterCriteria = { ...filterCriteria, createdAt: { min: WINDOW_MIN, max: WINDOW_MAX } };

const post = (
  handler: typeof QUERY,
  resource: "queries" | "counts",
  body: unknown,
  {
    surveyId = SURVEY_ID,
    headers = SAME_ORIGIN_HEADERS,
  }: { surveyId?: string; headers?: Record<string, string> } = {}
) =>
  handler(
    new NextRequest(`http://localhost/api/internal/surveys/${surveyId}/responses/${resource}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ surveyId }) } as never
  );

const queryResponses = (body: unknown, options?: Parameters<typeof post>[3]) =>
  post(QUERY, "queries", body, options);
const countResponses = (body: unknown, options?: Parameters<typeof post>[3]) =>
  post(COUNT, "counts", body, options);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getResponses.mockResolvedValue([storedResponse]);
  mocks.getResponseCountBySurveyId.mockResolvedValue(42);
});

describe("POST /api/internal/surveys/{surveyId}/responses/queries", () => {
  test("returns the page of responses with their timestamps as ISO strings", async () => {
    const response = await queryResponses({ limit: 25, offset: 50, filterCriteria });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.json()).data).toEqual([
      {
        ...storedResponse,
        createdAt: CREATED_AT.toISOString(),
        updatedAt: UPDATED_AT.toISOString(),
        tags: [
          {
            ...storedResponse.tags[0],
            createdAt: CREATED_AT.toISOString(),
            updatedAt: UPDATED_AT.toISOString(),
          },
        ],
      },
    ]);
  });

  test("reads the page the action read: the filter's dates revived, with what each respondent was not shown", async () => {
    await queryResponses({ limit: 25, offset: 50, filterCriteria });

    expect(mocks.getResponses).toHaveBeenCalledWith(SURVEY_ID, 25, 50, revivedFilterCriteria, undefined, {
      withNotShown: true,
    });
  });

  test("leaves the page size, offset and filter to the service when the body names none", async () => {
    await queryResponses({});

    expect(mocks.getResponses).toHaveBeenCalledWith(SURVEY_ID, undefined, undefined, undefined, undefined, {
      withNotShown: true,
    });
  });

  test("asks survey.response_read on the survey, spends the default API budget and writes no audit entry", async () => {
    await queryResponses({ limit: 25 });

    expect(mocks.can).toHaveBeenCalledWith(actor, "survey.response_read", { type: "survey", id: SURVEY_ID });
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3, USER_ID);
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("refuses a caller without survey.response_read with 403 and reads nothing", async () => {
    mocks.can.mockResolvedValue(false);

    expect((await queryResponses({ limit: 25 })).status).toBe(403);
    expect(mocks.getResponses).not.toHaveBeenCalled();
  });

  test("refuses an unauthenticated caller with 401", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await queryResponses({ limit: 25 })).status).toBe(401);
    expect(mocks.getResponses).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request with 403", async () => {
    const response = await queryResponses({ limit: 25 }, { headers: { "sec-fetch-site": "cross-site" } });

    expect(response.status).toBe(403);
    expect(mocks.getResponses).not.toHaveBeenCalled();
  });

  test.each([
    ["the limit at its cap", { limit: SURVEY_RESPONSES_QUERY_MAX_LIMIT }],
    ["the offset at its cap", { offset: SURVEY_RESPONSES_QUERY_MAX_OFFSET }],
  ])("accepts %s", async (_name, body) => {
    expect((await queryResponses(body)).status).toBe(200);
  });

  test.each([
    ["a limit past its cap", { limit: SURVEY_RESPONSES_QUERY_MAX_LIMIT + 1 }],
    ["a limit of 0", { limit: 0 }],
    ["a fractional limit", { limit: 2.5 }],
    ["an offset past its cap", { offset: SURVEY_RESPONSES_QUERY_MAX_OFFSET + 1 }],
    ["a negative offset", { offset: -1 }],
    ["an unknown body key", { limit: 25, cursor: "x" }],
    [
      "a filter with an unknown condition",
      { filterCriteria: { data: { q1: { op: "regex", value: ".*" } } } },
    ],
    ["a date window that is not a date", { filterCriteria: { createdAt: { min: "yesterday" } } }],
  ])("rejects %s with 400", async (_name, body) => {
    expect((await queryResponses(body)).status).toBe(400);
    expect(mocks.getResponses).not.toHaveBeenCalled();
  });

  test("a failed read is mapped, not leaked", async () => {
    mocks.getResponses.mockRejectedValue(new DatabaseError("connection reset"));

    const response = await queryResponses({ limit: 25 });

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("connection reset");
  });
});

describe("POST /api/internal/surveys/{surveyId}/responses/counts", () => {
  test("counts the responses matching the filter, its dates revived", async () => {
    const response = await countResponses({ filterCriteria });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.json()).data).toEqual({ count: 42 });
    expect(mocks.getResponseCountBySurveyId).toHaveBeenCalledWith(SURVEY_ID, revivedFilterCriteria);
  });

  test("counts every response when the body names no filter", async () => {
    await countResponses({});

    expect(mocks.getResponseCountBySurveyId).toHaveBeenCalledWith(SURVEY_ID, undefined);
  });

  test("asks survey.response_read on the survey and writes no audit entry", async () => {
    await countResponses({});

    expect(mocks.can).toHaveBeenCalledWith(actor, "survey.response_read", { type: "survey", id: SURVEY_ID });
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3, USER_ID);
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("refuses a caller without survey.response_read with 403 and counts nothing", async () => {
    mocks.can.mockResolvedValue(false);

    expect((await countResponses({})).status).toBe(403);
    expect(mocks.getResponseCountBySurveyId).not.toHaveBeenCalled();
  });

  test.each([
    ["an unknown body key", { filterCriteria: {}, limit: 25 }],
    ["a filter that is not an object", { filterCriteria: "finished" }],
  ])("rejects %s with 400", async (_name, body) => {
    expect((await countResponses(body)).status).toBe(400);
    expect(mocks.getResponseCountBySurveyId).not.toHaveBeenCalled();
  });

  test("a failed count is mapped, not leaked", async () => {
    mocks.getResponseCountBySurveyId.mockRejectedValue(new DatabaseError("connection reset"));

    const response = await countResponses({});

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("connection reset");
  });
});
