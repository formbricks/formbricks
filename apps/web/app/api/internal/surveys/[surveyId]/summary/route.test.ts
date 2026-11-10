import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST } from "./queries/route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  getSurveySummary: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can, assertCan: vi.fn() }));
vi.mock(
  "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/surveySummary",
  () => ({
    getSurveySummary: mocks.getSurveySummary,
  })
);
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
const actor = { type: "user", id: USER_ID };
const UPDATED_AT = new Date("2026-10-02T10:00:00.000Z");
const WINDOW_MIN = new Date("2026-09-01T00:00:00.000Z");

const sample = (value: unknown) => ({
  id: "clresp1111111111111111111",
  updatedAt: UPDATED_AT,
  value,
  contact: null,
  contactAttributes: null,
});
const jsonSample = (value: unknown) => ({ ...sample(value), updatedAt: UPDATED_AT.toISOString() });

const meta = {
  displayCount: 10,
  totalResponses: 4,
  startsPercentage: 40,
  completedResponses: 3,
  completedPercentage: 30,
  dropOffCount: 1,
  dropOffPercentage: 25,
  ttcAverage: 1200,
  quotasCompleted: 0,
  quotasCompletedPercentage: 0,
};
const ratingCard = {
  type: TSurveyElementTypeEnum.Rating,
  element: { id: "q9" },
  responseCount: 4,
  average: 4,
};
const storedSummary = {
  meta,
  dropOff: [],
  quotas: [{ id: "clquota111111111111111111", name: "Germany", limit: 100, count: 3, percentage: 3 }],
  summary: [
    {
      type: TSurveyElementTypeEnum.OpenText,
      element: { id: "q1" },
      responseCount: 1,
      samples: [sample("Great")],
    },
    {
      type: TSurveyElementTypeEnum.Date,
      element: { id: "q2" },
      responseCount: 1,
      samples: [sample("2026-09-01")],
    },
    {
      type: TSurveyElementTypeEnum.Address,
      element: { id: "q3" },
      responseCount: 1,
      samples: [sample(["Main St"])],
    },
    {
      type: TSurveyElementTypeEnum.ContactInfo,
      element: { id: "q4" },
      responseCount: 1,
      samples: [sample(["Ada"])],
    },
    { type: "hiddenField", id: "ref", label: "ref", responseCount: 1, samples: [sample("newsletter")] },
    {
      type: TSurveyElementTypeEnum.FileUpload,
      element: { id: "q5" },
      responseCount: 1,
      files: [sample(["a.png"])],
    },
    {
      type: TSurveyElementTypeEnum.Signature,
      element: { id: "q6" },
      responseCount: 1,
      signedCount: 1,
      skippedCount: 0,
      signatures: [sample("sig.png")],
    },
    ratingCard,
  ],
};

const summaryQuery = (body: unknown) =>
  POST(
    new NextRequest(`http://localhost/api/internal/surveys/${SURVEY_ID}/summary/queries`, {
      method: "POST",
      headers: { ...SAME_ORIGIN_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ surveyId: SURVEY_ID }) } as never
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getSurveySummary.mockResolvedValue(storedSummary);
});

describe("POST /api/internal/surveys/{surveyId}/summary/queries", () => {
  test("returns the summary with every sample's updatedAt as an ISO string and the rest as computed", async () => {
    const response = await summaryQuery({});

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const { data } = await response.json();
    expect(data.meta).toEqual(meta);
    expect(data.quotas).toEqual(storedSummary.quotas);
    expect(data.summary).toEqual([
      { ...storedSummary.summary[0], samples: [jsonSample("Great")] },
      { ...storedSummary.summary[1], samples: [jsonSample("2026-09-01")] },
      { ...storedSummary.summary[2], samples: [jsonSample(["Main St"])] },
      { ...storedSummary.summary[3], samples: [jsonSample(["Ada"])] },
      { ...storedSummary.summary[4], samples: [jsonSample("newsletter")] },
      { ...storedSummary.summary[5], files: [jsonSample(["a.png"])] },
      { ...storedSummary.summary[6], signatures: [jsonSample("sig.png")] },
      ratingCard,
    ]);
  });

  test("summarizes the responses the filter matches, its date window revived", async () => {
    await summaryQuery({ filterCriteria: { finished: true, createdAt: { min: WINDOW_MIN.toISOString() } } });

    expect(mocks.getSurveySummary).toHaveBeenCalledWith(SURVEY_ID, {
      finished: true,
      createdAt: { min: WINDOW_MIN },
    });
  });

  test("summarizes every response when the body names no filter", async () => {
    await summaryQuery({});

    expect(mocks.getSurveySummary).toHaveBeenCalledWith(SURVEY_ID, undefined);
  });

  test("asks survey.response_read on the survey, spends the default API budget and writes no audit entry", async () => {
    await summaryQuery({});

    expect(mocks.can).toHaveBeenCalledWith(actor, "survey.response_read", { type: "survey", id: SURVEY_ID });
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3, USER_ID);
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("refuses a caller without survey.response_read with 403 and summarizes nothing", async () => {
    mocks.can.mockResolvedValue(false);

    expect((await summaryQuery({})).status).toBe(403);
    expect(mocks.getSurveySummary).not.toHaveBeenCalled();
  });

  test("answers a survey deleted after the check with the uniform 403", async () => {
    mocks.getSurveySummary.mockRejectedValue(new ResourceNotFoundError("Survey", SURVEY_ID));

    expect((await summaryQuery({})).status).toBe(403);
  });

  test("refuses an unauthenticated caller with 401", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await summaryQuery({})).status).toBe(401);
    expect(mocks.getSurveySummary).not.toHaveBeenCalled();
  });

  test.each([
    ["an unknown body key", { filterCriteria: {}, limit: 25 }],
    [
      "a filter with an unknown condition",
      { filterCriteria: { data: { q1: { op: "regex", value: ".*" } } } },
    ],
  ])("rejects %s with 400", async (_name, body) => {
    expect((await summaryQuery(body)).status).toBe(400);
    expect(mocks.getSurveySummary).not.toHaveBeenCalled();
  });

  test("a failed summary is mapped, not leaked", async () => {
    mocks.getSurveySummary.mockRejectedValue(new DatabaseError("connection reset"));

    const response = await summaryQuery({});

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("connection reset");
  });
});
