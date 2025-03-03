import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@formbricks/types/error-handlers";
import { getEnvironmentId } from "../helper";
import { fetchEnvironmentId } from "../services";

vi.mock("../services", () => ({
  fetchEnvironmentId: vi.fn(),
}));

describe("Helper Functions", () => {
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
