import { ApiErrorResponse } from "@/modules/api/v2/types/api-error";
import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@formbricks/types/error-handlers";
import { getEnvironmentId } from "../helper";
import { getSurveyAndEnvironmentId } from "../services";

vi.mock("../services", () => ({
  getSurveyAndEnvironmentId: vi.fn(),
}));

describe("Helper Functions", () => {
  it("should return environmentId for surveyId", async () => {
    vi.mocked(getSurveyAndEnvironmentId).mockResolvedValue(
      ok({ surveyId: "survey-id", environmentId: "env-id" })
    );

    const result = await getEnvironmentId("survey-id", false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("env-id");
    }
  });

  it("should return environmentId for responseId", async () => {
    vi.mocked(getSurveyAndEnvironmentId).mockResolvedValue(
      ok({ surveyId: "survey-id", environmentId: "env-id" })
    );

    const result = await getEnvironmentId("response-id", true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("env-id");
    }
  });

  it("should return error if getSurveyAndEnvironmentId fails", async () => {
    vi.mocked(getSurveyAndEnvironmentId).mockResolvedValue(
      err({ type: "not_found" } as unknown as ApiErrorResponse)
    );

    const result = await getEnvironmentId("invalid-id", true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("not_found");
    }
  });
});
