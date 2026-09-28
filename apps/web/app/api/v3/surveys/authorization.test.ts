import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { can } from "@/lib/authorization";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { getSurvey } from "@/lib/survey/service";
import { getAuthorizedV3Survey } from "./authorization";
import { resolveV3SurveyResourceVisibility } from "./visibility-context";

vi.mock("@/app/api/v3/lib/auth", () => ({
  getV3AuthorizationActor: vi.fn(() => ({ type: "user", id: "user_1" })),
  requireV3WorkspaceAccess: vi.fn(),
}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn() }));
vi.mock("./visibility-context", () => ({ resolveV3SurveyResourceVisibility: vi.fn() }));

const VISIBILITY = { actorContext: {}, gates: { entitled: false, ready: false }, ownerName: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isSurveyVisibilityReady).mockResolvedValue(false);
  vi.mocked(resolveV3SurveyResourceVisibility).mockResolvedValue(VISIBILITY as never);
});

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

const survey = {
  id: "clsv1234567890123456789012",
  workspaceId: "clxx1234567890123456789012",
};
const surveyRecord = survey as unknown as NonNullable<Awaited<ReturnType<typeof getSurvey>>>;

describe("getAuthorizedV3Survey", () => {
  test("returns a generic forbidden response when the survey does not exist", async () => {
    vi.mocked(getSurvey).mockResolvedValue(null);

    const result = await getAuthorizedV3Survey({
      surveyId: survey.id,
      authentication: null,
      access: "read",
      requestId: "req_1",
      instance: "/api/v3/surveys/clsv1234567890123456789012",
    });

    expect(result.response?.status).toBe(403);
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
  });

  test("returns the authorization response when workspace access is denied", async () => {
    const forbiddenResponse = new Response(null, { status: 403 });
    vi.mocked(getSurvey).mockResolvedValue(surveyRecord);
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(forbiddenResponse);

    const result = await getAuthorizedV3Survey({
      surveyId: survey.id,
      authentication: null,
      access: "readWrite",
      requestId: "req_2",
      instance: "/api/v3/surveys/clsv1234567890123456789012",
    });

    expect(result.response).toBe(forbiddenResponse);
  });

  test("returns the survey and authorization context when access is allowed", async () => {
    const authResult = { workspaceId: survey.workspaceId, organizationId: "org_1" };
    vi.mocked(getSurvey).mockResolvedValue(surveyRecord);
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(authResult);

    const result = await getAuthorizedV3Survey({
      surveyId: survey.id,
      authentication: null,
      access: "read",
      requestId: "req_3",
      instance: "/api/v3/surveys/clsv1234567890123456789012",
    });

    expect(result).toEqual({
      survey,
      authResult,
      response: null,
      visibility: VISIBILITY,
    });
    // Marker off: the workspace check is the whole decision, as before ENG-3282.
    expect(can).not.toHaveBeenCalled();
  });

  test.each([
    ["read", "survey.read"],
    ["readWrite", "survey.write"],
  ] as const)(
    "with visibility enforced, also requires %s on the survey itself (ENG-3282)",
    async (access, action) => {
      vi.mocked(isSurveyVisibilityReady).mockResolvedValue(true);
      vi.mocked(getSurvey).mockResolvedValue(surveyRecord);
      vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({
        workspaceId: survey.workspaceId,
        organizationId: "org_1",
      });
      vi.mocked(can).mockResolvedValueOnce(false);

      const denied = await getAuthorizedV3Survey({
        surveyId: survey.id,
        authentication: null,
        access,
        requestId: "req_4",
        instance: "/api/v3/surveys/clsv1234567890123456789012",
      });

      expect(can).toHaveBeenCalledWith({ type: "user", id: "user_1" }, action, {
        type: "survey",
        id: survey.id,
      });
      // The same body as an unknown id: a restricted survey's existence is not probeable.
      expect(denied.response?.status).toBe(403);
      expect(denied.survey).toBeNull();

      vi.mocked(can).mockResolvedValueOnce(true);
      const allowed = await getAuthorizedV3Survey({
        surveyId: survey.id,
        authentication: null,
        access,
        requestId: "req_5",
        instance: "/api/v3/surveys/clsv1234567890123456789012",
      });
      expect(allowed.response).toBeNull();
    }
  );
});
