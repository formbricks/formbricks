import { describe, expect, test, vi } from "vitest";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { getSurvey } from "@/lib/survey/service";
import { getAuthorizedV3Survey } from "./authorization";

vi.mock("@/app/api/v3/lib/auth", () => ({
  requireV3WorkspaceAccess: vi.fn(),
}));

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
    });
  });
});
