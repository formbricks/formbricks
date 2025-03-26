import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { fetchEnvironmentId, fetchEnvironmentIdFromSurveyIds } from "../services";

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("Services", () => {
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

  describe("fetchEnvironmentIdFromSurveyIds", () => {
    test("should return an array of environmentIds if all surveys exist", async () => {
      vi.mocked(prisma.survey.findMany).mockResolvedValue([
        { environmentId: "env-1" },
        { environmentId: "env-2" },
      ]);
      const result = await fetchEnvironmentIdFromSurveyIds(["survey1", "survey2"]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(["env-1", "env-2"]);
      }
    });

    test("should return not_found error if any survey is missing", async () => {
      vi.mocked(prisma.survey.findMany).mockResolvedValue([{ environmentId: "env-1" }]);
      const result = await fetchEnvironmentIdFromSurveyIds(["survey1", "survey2"]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("not_found");
      }
    });

    test("should return internal_server_error if prisma query fails", async () => {
      vi.mocked(prisma.survey.findMany).mockRejectedValue(new Error("Query failed"));
      const result = await fetchEnvironmentIdFromSurveyIds(["survey1", "survey2"]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
      }
    });
  });
});
