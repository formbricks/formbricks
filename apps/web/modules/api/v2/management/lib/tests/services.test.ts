import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { fetchEnvironmentId } from "../services";

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: { findFirst: vi.fn() },
  },
}));

describe("Services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSurveyAndEnvironmentId", () => {
    test("should return surveyId and environmentId for responseId", async () => {
      vi.mocked(prisma.survey.findFirst).mockResolvedValue({
        environmentId: "env-id",
        responses: [{ surveyId: "survey-id" }],
      });

      const result = await fetchEnvironmentId("response-id", true);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ environmentId: "env-id" });
      }
    });

    test("should return surveyId and environmentId for surveyId", async () => {
      vi.mocked(prisma.survey.findFirst).mockResolvedValue({
        id: "survey-id",
        environmentId: "env-id",
      });

      const result = await fetchEnvironmentId("survey-id", false);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ environmentId: "env-id" });
      }
    });

    test("should return error if response is not found", async () => {
      vi.mocked(prisma.survey.findFirst).mockResolvedValue(null);

      const result = await fetchEnvironmentId("invalid-id", true);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("not_found");
      }
    });

    test("should return error if survey is not found", async () => {
      vi.mocked(prisma.survey.findFirst).mockResolvedValue(null);

      const result = await fetchEnvironmentId("invalid-id", false);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("not_found");
      }
    });

    test("should return internal_server_error if prisma query fails for responseId", async () => {
      vi.mocked(prisma.survey.findFirst).mockRejectedValue(new Error("Internal server error"));

      const result = await fetchEnvironmentId("response-id", true);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });

    test("should return internal_server_error if prisma query fails for surveyId", async () => {
      vi.mocked(prisma.survey.findFirst).mockRejectedValue(new Error("Internal server error"));

      const result = await fetchEnvironmentId("survey-id", false);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });
});
