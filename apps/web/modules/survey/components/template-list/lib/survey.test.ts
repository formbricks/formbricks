import {
  getOrganizationByEnvironmentId,
  subscribeOrganizationMembersToSurveyResponses,
} from "@/lib/organization/service";
import { capturePosthogEnvironmentEvent } from "@/lib/posthogServer";
import { getActionClasses } from "@/modules/survey/lib/action-class";
import { selectSurvey } from "@/modules/survey/lib/survey";
import { ActionClass, Prisma } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurveyCreateInput } from "@formbricks/types/surveys/types";
import { createSurvey, handleTriggerUpdates } from "./survey";

// Mock dependencies
vi.mock("@/lib/posthogServer", () => ({
  capturePosthogEnvironmentEvent: vi.fn(),
}));

vi.mock("@/lib/survey/utils", () => ({
  checkForInvalidImagesInQuestions: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  subscribeOrganizationMembersToSurveyResponses: vi.fn(),
  getOrganizationByEnvironmentId: vi.fn(),
}));

vi.mock("@/modules/survey/lib/action-class", () => ({
  getActionClasses: vi.fn(),
}));

vi.mock("@/modules/survey/lib/survey", () => ({
  selectSurvey: {
    id: true,
    createdAt: true,
    updatedAt: true,
    name: true,
    type: true,
    status: true,
    environmentId: true,
    resultShareKey: true,
    segment: true,
  },
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      create: vi.fn(),
      update: vi.fn(),
    },
    segment: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("survey module", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("createSurvey", () => {
    test("creates a survey successfully", async () => {
      // Mock input data
      const environmentId = "env-123";
      const surveyBody: TSurveyCreateInput = {
        name: "Test Survey",
        type: "app",
        status: "draft",
        questions: [],
        createdBy: "user-123",
      };

      // Mock dependencies
      const mockActionClasses: ActionClass[] = [];
      vi.mocked(getActionClasses).mockResolvedValue(mockActionClasses);
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue({ id: "org-123", name: "Org" } as any);

      const mockCreatedSurvey = {
        id: "survey-123",
        environmentId,
        type: "app",
        resultShareKey: "key-123",
        segment: {
          surveys: [{ id: "survey-123" }],
        },
      } as any;

      vi.mocked(prisma.survey.create).mockResolvedValue(mockCreatedSurvey);

      const mockSegment = { id: "segment-123" } as any;
      vi.mocked(prisma.segment.create).mockResolvedValue(mockSegment);

      // Execute function
      const result = await createSurvey(environmentId, surveyBody);

      // Verify results
      expect(getActionClasses).toHaveBeenCalledWith(environmentId);
      expect(getOrganizationByEnvironmentId).toHaveBeenCalledWith(environmentId);
      expect(prisma.survey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: surveyBody.name,
          type: surveyBody.type,
          environment: { connect: { id: environmentId } },
          creator: { connect: { id: surveyBody.createdBy } },
        }),
        select: selectSurvey,
      });
      expect(prisma.segment.create).toHaveBeenCalled();
      expect(prisma.survey.update).toHaveBeenCalled();
      expect(subscribeOrganizationMembersToSurveyResponses).toHaveBeenCalledWith(
        "survey-123",
        "user-123",
        "org-123"
      );
      expect(capturePosthogEnvironmentEvent).toHaveBeenCalledWith(
        environmentId,
        "survey created",
        expect.objectContaining({ surveyId: "survey-123" })
      );
      expect(result).toBeDefined();
      expect(result.id).toBe("survey-123");
    });

    test("handles empty languages array", async () => {
      const environmentId = "env-123";
      const surveyBody: TSurveyCreateInput = {
        name: "Test Survey",
        type: "app",
        status: "draft",
        languages: [],
        questions: [],
      };

      vi.mocked(getActionClasses).mockResolvedValue([]);
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue({ id: "org-123" } as any);
      vi.mocked(prisma.survey.create).mockResolvedValue({
        id: "survey-123",
        environmentId,
        type: "link",
        segment: null,
      } as any);

      await createSurvey(environmentId, surveyBody);

      expect(prisma.survey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ languages: [] }),
        })
      );
    });

    test("handles follow-ups properly", async () => {
      const environmentId = "env-123";
      const surveyBody: TSurveyCreateInput = {
        name: "Test Survey",
        type: "app",
        status: "draft",
        questions: [],
        followUps: [{ name: "Follow Up 1", trigger: "trigger1", action: "action1" } as any],
      };

      vi.mocked(getActionClasses).mockResolvedValue([]);
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue({ id: "org-123" } as any);
      vi.mocked(prisma.survey.create).mockResolvedValue({
        id: "survey-123",
        environmentId,
        type: "link",
        segment: null,
      } as any);

      await createSurvey(environmentId, surveyBody);

      expect(prisma.survey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            followUps: {
              create: [{ name: "Follow Up 1", trigger: "trigger1", action: "action1" }],
            },
          }),
        })
      );
    });

    test("throws error when organization not found", async () => {
      const environmentId = "env-123";
      const surveyBody: TSurveyCreateInput = {
        name: "Test Survey",
        type: "app",
        status: "draft",
        questions: [],
      };

      vi.mocked(getActionClasses).mockResolvedValue([]);
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(null);

      await expect(createSurvey(environmentId, surveyBody)).rejects.toThrow(ResourceNotFoundError);
    });

    test("handles database errors", async () => {
      const environmentId = "env-123";
      const surveyBody: TSurveyCreateInput = {
        name: "Test Survey",
        type: "app",
        status: "draft",
        questions: [],
      };

      vi.mocked(getActionClasses).mockResolvedValue([]);
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue({ id: "org-123" } as any);

      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.survey.create).mockRejectedValue(prismaError);

      await expect(createSurvey(environmentId, surveyBody)).rejects.toThrow(DatabaseError);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("handleTriggerUpdates", () => {
    test("handles empty triggers", () => {
      const result = handleTriggerUpdates(undefined as any, [], []);
      expect(result).toEqual({});
    });

    test("adds new triggers", () => {
      const updatedTriggers = [
        { actionClass: { id: "action-1" } },
        { actionClass: { id: "action-2" } },
      ] as any;
      const currentTriggers = [] as any;
      const actionClasses = [{ id: "action-1" }, { id: "action-2" }] as ActionClass[];

      const result = handleTriggerUpdates(updatedTriggers, currentTriggers, actionClasses);

      expect(result).toEqual({
        create: [{ actionClassId: "action-1" }, { actionClassId: "action-2" }],
      });
    });

    test("removes triggers", () => {
      const updatedTriggers = [] as any;
      const currentTriggers = [
        { actionClass: { id: "action-1" } },
        { actionClass: { id: "action-2" } },
      ] as any;
      const actionClasses = [{ id: "action-1" }, { id: "action-2" }] as ActionClass[];

      const result = handleTriggerUpdates(updatedTriggers, currentTriggers, actionClasses);

      expect(result).toEqual({
        deleteMany: {
          actionClassId: {
            in: ["action-1", "action-2"],
          },
        },
      });
    });

    test("throws error for invalid trigger", () => {
      const updatedTriggers = [{ actionClass: { id: "action-3" } }] as any;
      const currentTriggers = [] as any;
      const actionClasses = [{ id: "action-1" }] as ActionClass[];

      expect(() => handleTriggerUpdates(updatedTriggers, currentTriggers, actionClasses)).toThrow(
        InvalidInputError
      );
    });

    test("throws error for duplicate triggers", () => {
      const updatedTriggers = [
        { actionClass: { id: "action-1" } },
        { actionClass: { id: "action-1" } },
      ] as any;
      const currentTriggers = [] as any;
      const actionClasses = [{ id: "action-1" }] as ActionClass[];

      expect(() => handleTriggerUpdates(updatedTriggers, currentTriggers, actionClasses)).toThrow(
        InvalidInputError
      );
    });
  });
});
