import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authorizeSurvey: vi.fn(),
  isEnabled: vi.fn(),
  policies: vi.fn(),
  facts: vi.fn(),
  exemptions: vi.fn(),
  count: vi.fn(),
  plan: vi.fn(),
}));

vi.mock("@/app/api/v3/surveys/authorization", () => ({ getAuthorizedV3Survey: mocks.authorizeSurvey }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDataRetentionEnabled: mocks.isEnabled }));
vi.mock("@/modules/ee/data-retention/lib/survey-retention-service", () => ({
  getSurveyRetentionPolicies: mocks.policies,
  getSurveyRetentionFacts: mocks.facts,
  countSurveyResponsesCreatedAtOrBefore: mocks.count,
}));
vi.mock("@/modules/ee/data-retention/lib/exemptions-service", () => ({
  listActiveSurveyRetentionExemptions: mocks.exemptions,
}));
vi.mock("@/modules/ee/data-retention/lib/survey-retention", () => ({ getSurveyRetentionPlan: mocks.plan }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const ORG_ID = "clorg11111111111111111111";
const SURVEY_ID = "clsrv11111111111111111111";
const CUTOFF = new Date("2029-01-01T00:00:00.000Z");

const get = (surveyId = SURVEY_ID) =>
  GET(new NextRequest(`http://localhost/api/internal/survey-retention/${surveyId}`), {
    params: Promise.resolve({ surveyId }),
  } as never);

describe("GET /api/internal/survey-retention/{surveyId}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "cluser1111111111111111111" } });
    mocks.authorizeSurvey.mockResolvedValue({ authResult: { organizationId: ORG_ID }, response: null });
    mocks.isEnabled.mockResolvedValue(true);
    mocks.policies.mockResolvedValue({});
    mocks.facts.mockResolvedValue({ createdAt: new Date() });
    mocks.exemptions.mockResolvedValue([]);
    mocks.count.mockResolvedValue({ count: 214, relation: "eq" });
    mocks.plan.mockReturnValue([
      {
        policy: "responses",
        exempt: false,
        nextAction: "delete",
        nextDate: new Date("2030-10-03T00:00:00.000Z"),
        dueCreatedAtOrBefore: CUTOFF,
      },
      { policy: "surveys", exempt: false, nextAction: "archive", nextDate: null, dueCreatedAtOrBefore: null },
    ]);
  });

  test("dates what each active policy does next, with the responses already due", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      governed: true,
      policies: [
        {
          policy: "responses",
          exempt: false,
          nextAction: "delete",
          nextDate: "2030-10-03T00:00:00.000Z",
          dueCount: { count: 214, relation: "eq" },
        },
        { policy: "surveys", exempt: false, nextAction: "archive", nextDate: null, dueCount: null },
      ],
      exemptions: [],
    });
    expect(mocks.authorizeSurvey).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: SURVEY_ID, access: "read" })
    );
    expect(mocks.count).toHaveBeenCalledWith(SURVEY_ID, CUTOFF);
  });

  test("answers not governed, rather than 403, for an organisation without the entitlement", async () => {
    mocks.isEnabled.mockResolvedValueOnce(false);

    expect((await (await get()).json()).data).toEqual({ governed: false, policies: [], exemptions: [] });
    expect(mocks.policies).not.toHaveBeenCalled();
  });

  test("is not governed when every policy is paused, and shows no count when none is due", async () => {
    mocks.plan.mockReturnValueOnce([]);
    expect((await (await get()).json()).data.governed).toBe(false);

    mocks.count.mockResolvedValueOnce({ count: 0, relation: "eq" });
    expect((await (await get()).json()).data.policies[0].dueCount).toBeNull();
  });

  test("passes on the survey check's refusal unchanged", async () => {
    mocks.authorizeSurvey.mockResolvedValueOnce({
      authResult: null,
      response: Response.json({ status: 403, code: "forbidden" }, { status: 403 }),
    });

    const response = await get();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ status: 403, code: "forbidden" });
    expect(mocks.isEnabled).not.toHaveBeenCalled();
  });

  test("returns 400 on an id that isn't one", async () => {
    expect((await get("not an id")).status).toBe(400);
    expect(mocks.authorizeSurvey).not.toHaveBeenCalled();
  });
});
