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
  clock: vi.fn(),
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
vi.mock("@/lib/utils/database-clock", () => ({ readDatabaseClock: mocks.clock }));
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
const DB_NOW = new Date("2030-06-01T00:00:00.123Z");
const SURVEY = {
  id: SURVEY_ID,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  archivedAt: null,
};

const get = (surveyId = SURVEY_ID) =>
  GET(new NextRequest(`http://localhost/api/internal/survey-retention/${surveyId}`), {
    params: Promise.resolve({ surveyId }),
  } as never);

describe("GET /api/internal/survey-retention/{surveyId}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "cluser1111111111111111111" } });
    mocks.authorizeSurvey.mockResolvedValue({
      survey: SURVEY,
      authResult: { organizationId: ORG_ID },
      response: null,
    });
    mocks.isEnabled.mockResolvedValue(true);
    mocks.clock.mockResolvedValue(DB_NOW);
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
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    // The survey the check already read, not a second read of it; dated on the database's clock, which
    // exemptions and notices are stamped with.
    expect(mocks.facts).toHaveBeenCalledWith(SURVEY, DB_NOW);
    expect(mocks.plan).toHaveBeenCalledWith(expect.objectContaining({ now: DB_NOW }));
  });

  test("hands the active exemptions to the plan, and returns them serialized", async () => {
    mocks.exemptions.mockResolvedValueOnce([
      {
        id: "clexm11111111111111111111",
        entity: "responses",
        until: new Date("2031-03-31T21:59:59.999Z"),
        reason: "Supplier audit",
        createdAt: new Date("2030-01-02T00:00:00.000Z"),
        revokedAt: null,
        surveyId: SURVEY_ID,
        surveyName: "Site visit feedback",
        workspaceId: "clwsp11111111111111111111",
        createdById: "cluser1111111111111111111",
        createdByName: "Anna Keller",
        visibilityVersion: 0,
        visibilityProjectedVersion: 0,
      },
    ]);

    const { data } = await (await get()).json();

    expect(mocks.exemptions).toHaveBeenCalledWith({
      surveyId: SURVEY_ID,
      organizationId: ORG_ID,
      now: DB_NOW,
    });
    // A responses exemption must reach the plan, which holds the survey from the surveys policy too (ENG-3371).
    expect(mocks.plan).toHaveBeenCalledWith(
      expect.objectContaining({ exemptPolicies: new Set(["responses"]) })
    );
    expect(data.exemptions).toEqual([
      expect.objectContaining({
        id: "clexm11111111111111111111",
        policy: "responses",
        surveyName: "Site visit feedback",
        reason: "Supplier audit",
        createdBy: { id: "cluser1111111111111111111", name: "Anna Keller" },
      }),
    ]);
    expect(data.exemptions[0]).not.toHaveProperty("visibilityVersion");
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
