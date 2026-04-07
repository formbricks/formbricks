import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { fetchWorkspaceId, fetchWorkspaceIdFromSurveyIds } from "../services";

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

type PrismaSurveyFindFirst = Awaited<ReturnType<typeof prisma.survey.findFirst>>;
type PrismaSurveyFindMany = Awaited<ReturnType<typeof prisma.survey.findMany>>;

describe("Services", () => {
  describe("getSurveyAndEnvironmentId", () => {
    test("should return workspaceId and environmentId for responseId", async () => {
      vi.mocked(prisma.survey.findFirst).mockResolvedValue({
        workspaceId: "workspace-id",
        environmentId: "env-id",
        responses: [{ surveyId: "survey-id" }],
      } as unknown as PrismaSurveyFindFirst);

      const result = await fetchWorkspaceId("response-id", true);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ workspaceId: "workspace-id", environmentId: "env-id" });
      }
    });

    test("should return workspaceId and environmentId for surveyId", async () => {
      vi.mocked(prisma.survey.findFirst).mockResolvedValue({
        id: "survey-id",
        workspaceId: "workspace-id",
        environmentId: "env-id",
      } as unknown as PrismaSurveyFindFirst);

      const result = await fetchWorkspaceId("survey-id", false);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ workspaceId: "workspace-id", environmentId: "env-id" });
      }
    });

    test("should return error if response is not found", async () => {
      vi.mocked(prisma.survey.findFirst).mockResolvedValue(null);

      const result = await fetchWorkspaceId("invalid-id", true);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect((result.error as { type: string }).type).toBe("not_found");
      }
    });

    test("should return error if survey is not found", async () => {
      vi.mocked(prisma.survey.findFirst).mockResolvedValue(null);

      const result = await fetchWorkspaceId("invalid-id", false);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect((result.error as { type: string }).type).toBe("not_found");
      }
    });

    test("should return internal_server_error if prisma query fails for responseId", async () => {
      vi.mocked(prisma.survey.findFirst).mockRejectedValue(new Error("Internal server error"));

      const result = await fetchWorkspaceId("response-id", true);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect((result.error as { type: string }).type).toBe("internal_server_error");
      }
    });

    test("should return internal_server_error if prisma query fails for surveyId", async () => {
      vi.mocked(prisma.survey.findFirst).mockRejectedValue(new Error("Internal server error"));

      const result = await fetchWorkspaceId("survey-id", false);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect((result.error as { type: string }).type).toBe("internal_server_error");
      }
    });
  });

  describe("fetchWorkspaceIdFromSurveyIds", () => {
    test("should return an array of workspaceIds if all surveys exist", async () => {
      vi.mocked(prisma.survey.findMany).mockResolvedValue([
        { workspaceId: "ws-1" },
        { workspaceId: "ws-2" },
      ] as unknown as PrismaSurveyFindMany);
      const result = await fetchWorkspaceIdFromSurveyIds(["survey1", "survey2"]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(["ws-1", "ws-2"]);
      }
    });

    test("should return not_found error if any survey is missing", async () => {
      vi.mocked(prisma.survey.findMany).mockResolvedValue([
        { workspaceId: "ws-1" },
      ] as unknown as PrismaSurveyFindMany);
      const result = await fetchWorkspaceIdFromSurveyIds(["survey1", "survey2"]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect((result.error as { type: string }).type).toBe("not_found");
      }
    });

    test("should return internal_server_error if prisma query fails", async () => {
      vi.mocked(prisma.survey.findMany).mockRejectedValue(new Error("Query failed"));
      const result = await fetchWorkspaceIdFromSurveyIds(["survey1", "survey2"]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect((result.error as { type: string }).type).toBe("internal_server_error");
      }
    });
  });
});
