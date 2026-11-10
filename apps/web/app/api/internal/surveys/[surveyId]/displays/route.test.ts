import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { GET } from "./route";
import { SURVEY_DISPLAYS_MAX_LIMIT, SURVEY_DISPLAYS_MAX_OFFSET } from "./schemas";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  getDisplaysBySurveyIdWithContact: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can, assertCan: vi.fn() }));
vi.mock("@/lib/display/service", () => ({
  getDisplaysBySurveyIdWithContact: mocks.getDisplaysBySurveyIdWithContact,
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
const actor = { type: "user", id: USER_ID };
const CREATED_AT = new Date("2026-10-01T10:00:00.000Z");

const storedDisplay = {
  id: "cldisplay1111111111111111",
  createdAt: CREATED_AT,
  surveyId: SURVEY_ID,
  contact: { id: "clcontact1111111111111111", attributes: { email: "a@example.com", userId: "user-1" } },
};

const listDisplays = (query = "limit=15&offset=30") =>
  GET(
    new NextRequest(`http://localhost/api/internal/surveys/${SURVEY_ID}/displays?${query}`, {
      headers: SAME_ORIGIN_HEADERS,
    }),
    { params: Promise.resolve({ surveyId: SURVEY_ID }) } as never
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getDisplaysBySurveyIdWithContact.mockResolvedValue([
    storedDisplay,
    { ...storedDisplay, id: "cldisplay2222222222222222", contact: null },
  ]);
});

describe("GET /api/internal/surveys/{surveyId}/displays", () => {
  test("returns the page of displays with createdAt as an ISO string", async () => {
    const response = await listDisplays();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.json()).data).toEqual([
      { ...storedDisplay, createdAt: CREATED_AT.toISOString() },
      {
        ...storedDisplay,
        id: "cldisplay2222222222222222",
        createdAt: CREATED_AT.toISOString(),
        contact: null,
      },
    ]);
    expect(mocks.getDisplaysBySurveyIdWithContact).toHaveBeenCalledWith(SURVEY_ID, 15, 30);
  });

  test("asks survey.response_read on the survey, spends the default API budget and writes no audit entry", async () => {
    await listDisplays();

    expect(mocks.can).toHaveBeenCalledWith(actor, "survey.response_read", { type: "survey", id: SURVEY_ID });
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3, USER_ID);
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("refuses a caller without survey.response_read with 403 and reads nothing", async () => {
    mocks.can.mockResolvedValue(false);

    expect((await listDisplays()).status).toBe(403);
    expect(mocks.getDisplaysBySurveyIdWithContact).not.toHaveBeenCalled();
  });

  test("refuses an unauthenticated caller with 401", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await listDisplays()).status).toBe(401);
  });

  test.each([
    [
      "the limit and offset at their caps",
      `limit=${SURVEY_DISPLAYS_MAX_LIMIT}&offset=${SURVEY_DISPLAYS_MAX_OFFSET}`,
    ],
    ["the first page", "limit=1&offset=0"],
  ])("accepts %s", async (_name, query) => {
    expect((await listDisplays(query)).status).toBe(200);
  });

  test.each([
    ["a limit past the action's cap", `limit=${SURVEY_DISPLAYS_MAX_LIMIT + 1}&offset=0`],
    ["a limit of 0", "limit=0&offset=0"],
    ["an offset past its cap", `limit=15&offset=${SURVEY_DISPLAYS_MAX_OFFSET + 1}`],
    ["a negative offset", "limit=15&offset=-1"],
    ["a fractional offset", "limit=15&offset=1.5"],
    ["a missing limit", "offset=0"],
    ["a missing offset", "limit=15"],
    ["an unknown query parameter", "limit=15&offset=0&cursor=x"],
  ])("rejects %s with 400", async (_name, query) => {
    expect((await listDisplays(query)).status).toBe(400);
    expect(mocks.getDisplaysBySurveyIdWithContact).not.toHaveBeenCalled();
  });

  test("a failed read is mapped, not leaked", async () => {
    mocks.getDisplaysBySurveyIdWithContact.mockRejectedValue(new DatabaseError("connection reset"));

    const response = await listDisplays();

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("connection reset");
  });
});
