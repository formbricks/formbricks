import { fetchEnvironmentIdFromSurveyIds } from "@/modules/api/v2/management/lib/services";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@formbricks/types/error-handlers";
import { getEnvironmentId, getEnvironmentIdFromSurveyIds } from "../helper";
import { fetchEnvironmentId } from "../services";

vi.mock("../services", () => ({
  fetchEnvironmentId: vi.fn(),
  fetchEnvironmentIdFromSurveyIds: vi.fn(),
}));

describe("Tests for getEnvironmentId", () => {
  it("should return environmentId for surveyId", async () => {
    vi.mocked(fetchEnvironmentId).mockResolvedValue(ok({ environmentId: "env-id" }));

    const result = await getEnvironmentId("survey-id", false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("env-id");
    }
  });

  it("should return environmentId for responseId", async () => {
    vi.mocked(fetchEnvironmentId).mockResolvedValue(ok({ environmentId: "env-id" }));

    const result = await getEnvironmentId("response-id", true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("env-id");
    }
  });

  it("should return error if getSurveyAndEnvironmentId fails", async () => {
    vi.mocked(fetchEnvironmentId).mockResolvedValue(
      err({ type: "not_found" } as unknown as ApiErrorResponseV2)
    );

    const result = await getEnvironmentId("invalid-id", true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("not_found");
    }
  });
});

describe("getEnvironmentIdFromSurveyIds", () => {
  it("returns the common environment id when all survey ids are in the same environment", async () => {
    vi.mocked(fetchEnvironmentIdFromSurveyIds).mockResolvedValueOnce({
      ok: true,
      data: ["env123", "env123"],
    });
    const result = await getEnvironmentIdFromSurveyIds(["survey1", "survey2"]);
    expect(result).toEqual(ok("env123"));
  });

  it("returns error when surveys are not in the same environment", async () => {
    vi.mocked(fetchEnvironmentIdFromSurveyIds).mockResolvedValueOnce({
      ok: true,
      data: ["env123", "env456"],
    });
    const result = await getEnvironmentIdFromSurveyIds(["survey1", "survey2"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        type: "bad_request",
        details: [{ field: "surveyIds", issue: "not all surveys are in the same environment" }],
      });
    }
  });

  it("returns error when API call fails", async () => {
    const apiError = {
      type: "server_error",
      details: [{ field: "api", issue: "failed" }],
    } as unknown as ApiErrorResponseV2;
    vi.mocked(fetchEnvironmentIdFromSurveyIds).mockResolvedValueOnce({ ok: false, error: apiError });
    const result = await getEnvironmentIdFromSurveyIds(["survey1", "survey2"]);
    expect(result).toEqual({ ok: false, error: apiError });
  });
});
