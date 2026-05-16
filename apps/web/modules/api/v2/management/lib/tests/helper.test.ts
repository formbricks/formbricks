import { createId } from "@paralleldrive/cuid2";
import { describe, expect, test, vi } from "vitest";
import { err, ok } from "@formbricks/types/error-handlers";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { getWorkspaceId, getWorkspaceIdFromSurveyIds } from "../helper";
import { fetchWorkspaceId, fetchWorkspaceIdFromSurveyIds } from "../services";

vi.mock("../services", () => ({
  fetchWorkspaceId: vi.fn(),
  fetchWorkspaceIdFromSurveyIds: vi.fn(),
}));

describe("Tests for getWorkspaceId", () => {
  test("should return workspaceId for surveyId", async () => {
    vi.mocked(fetchWorkspaceId).mockResolvedValue(ok({ workspaceId: "ws-id" }));

    const result = await getWorkspaceId("survey-id", false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ workspaceId: "ws-id" });
    }
  });

  test("should return workspaceId for responseId", async () => {
    vi.mocked(fetchWorkspaceId).mockResolvedValue(ok({ workspaceId: "ws-id" }));

    const result = await getWorkspaceId("response-id", true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ workspaceId: "ws-id" });
    }
  });

  test("should return error if fetchWorkspaceId fails", async () => {
    vi.mocked(fetchWorkspaceId).mockResolvedValue(
      err({ type: "not_found" } as unknown as ApiErrorResponseV2)
    );

    const result = await getWorkspaceId("invalid-id", true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("not_found");
    }
  });
});

describe("getWorkspaceIdFromSurveyIds", () => {
  const wsId1 = createId();
  const wsId2 = createId();

  test("returns the common workspace id when all survey ids are in the same workspace", async () => {
    vi.mocked(fetchWorkspaceIdFromSurveyIds).mockResolvedValueOnce({
      ok: true,
      data: [wsId1, wsId1],
    });
    const result = await getWorkspaceIdFromSurveyIds(["survey1", "survey2"]);
    expect(result).toEqual(ok(wsId1));
  });

  test("returns error when surveys are not in the same workspace", async () => {
    vi.mocked(fetchWorkspaceIdFromSurveyIds).mockResolvedValueOnce({
      ok: true,
      data: [wsId1, wsId2],
    });
    const result = await getWorkspaceIdFromSurveyIds(["survey1", "survey2"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        type: "bad_request",
        details: [{ field: "surveyIds", issue: "not all surveys are in the same workspace" }],
      });
    }
  });

  test("returns error when API call fails", async () => {
    const apiError = {
      type: "server_error",
      details: [{ field: "api", issue: "failed" }],
    } as unknown as ApiErrorResponseV2;
    vi.mocked(fetchWorkspaceIdFromSurveyIds).mockResolvedValueOnce({ ok: false, error: apiError });
    const result = await getWorkspaceIdFromSurveyIds(["survey1", "survey2"]);
    expect(result).toEqual({ ok: false, error: apiError });
  });
});
