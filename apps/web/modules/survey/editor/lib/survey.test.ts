import { surveyCache } from "@/lib/survey/cache";
// Import mocked functions
import { getActionClasses } from "@/modules/survey/lib/action-class";
import { getOrganizationAIKeys, getOrganizationIdFromEnvironmentId } from "@/modules/survey/lib/organization";
import { getSurvey } from "@/modules/survey/lib/survey";
import { ActionClass, Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { checkTriggersValidity, handleTriggerUpdates, updateSurvey } from "./survey";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      update: vi.fn(),
    },
    segment: {
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache/segment", () => ({
  segmentCache: {
    revalidate: vi.fn(),
  },
}));

vi.mock("@/lib/survey/cache", () => ({
  surveyCache: {
    revalidate: vi.fn(),
  },
}));

vi.mock("@/lib/survey/utils", () => ({
  checkForInvalidImagesInQuestions: vi.fn(),
}));

vi.mock("@/modules/survey/lib/action-class", () => ({
  getActionClasses: vi.fn(),
}));

vi.mock("@/modules/survey/lib/organization", () => ({
  getOrganizationIdFromEnvironmentId: vi.fn(),
  getOrganizationAIKeys: vi.fn(),
}));

vi.mock("@/modules/survey/lib/survey", () => ({
  getSurvey: vi.fn(),
  selectSurvey: {
    id: true,
    createdAt: true,
    updatedAt: true,
    name: true,
    type: true,
    environmentId: true,
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("Survey Editor Library Tests", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("updateSurvey", () => {
    const mockSurvey = {
      id: "survey123",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      type: "app",
      environmentId: "env123",
      createdBy: "user123",
      status: "draft",
      displayOption: "displayOnce",
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Question 1" },
          required: false,
          inputType: "text",
          charLimit: { enabled: false },
        },
      ],
      welcomeCard: {
        enabled: false,
        timeToFinish: true,
        showResponseCount: false,
      },
      triggers: [],
      endings: [],
      hiddenFields: { enabled: false },
      delay: 0,
      autoComplete: null,
      closeOnDate: null,
      runOnDate: null,
      projectOverwrites: null,
      styling: null,
      showLanguageSwitch: false,
      segment: null,
      surveyClosedMessage: null,
      singleUse: null,
      isVerifyEmailEnabled: false,
      recaptcha: null,
      isSingleResponsePerEmailEnabled: false,
      isBackButtonHidden: false,
      pin: null,
      resultShareKey: null,
      displayPercentage: null,
      languages: [
        {
          language: {
            id: "en",
            code: "en",
            createdAt: new Date(),
            updatedAt: new Date(),
            alias: null,
            projectId: "project1",
          },
          default: true,
          enabled: true,
        },
      ],
      variables: [],
      followUps: [],
    } as unknown as TSurvey;

    const mockCurrentSurvey = { ...mockSurvey };
    const mockActionClasses: ActionClass[] = [
      {
        id: "action1",
        name: "Code Action",
        description: "Action from code",
        type: "code" as const,
        environmentId: "env123",
        createdAt: new Date(),
        updatedAt: new Date(),
        key: null,
        noCodeConfig: null,
      },
    ];

    const mockOrganizationId = "org123";
    const mockOrganization = {
      id: mockOrganizationId,
      name: "Test Organization",
      ownerUserId: "user123",
      billing: {
        stripeCustomerId: "cust_123",
        plan: "free" as const,
        features: {},
        period: "monthly" as const,
        periodStart: new Date(),
      },
      isAIEnabled: false,
    };

    beforeEach(() => {
      vi.mocked(prisma.survey.update).mockResolvedValue(mockSurvey as any);
      vi.mocked(prisma.segment.update).mockResolvedValue({
        id: "segment1",
        environmentId: "env123",
        surveys: [{ id: "survey123" }],
      } as any);

      vi.mocked(getSurvey).mockResolvedValue(mockCurrentSurvey);
      vi.mocked(getActionClasses).mockResolvedValue(mockActionClasses);
      vi.mocked(getOrganizationIdFromEnvironmentId).mockResolvedValue(mockOrganizationId);
      vi.mocked(getOrganizationAIKeys).mockResolvedValue(mockOrganization as any);
    });

    test("should handle languages update", async () => {
      const updatedSurvey: TSurvey = {
        ...mockSurvey,
        languages: [
          {
            language: {
              id: "en",
              code: "en",
              createdAt: new Date(),
              updatedAt: new Date(),
              alias: null,
              projectId: "project1",
            },
            default: true,
            enabled: true,
          },
          {
            language: {
              id: "es",
              code: "es",
              createdAt: new Date(),
              updatedAt: new Date(),
              alias: null,
              projectId: "project1",
            },
            default: false,
            enabled: true,
          },
        ],
      };

      await updateSurvey(updatedSurvey);

      expect(prisma.survey.update).toHaveBeenCalledWith({
        where: { id: "survey123" },
        data: expect.objectContaining({
          languages: {
            updateMany: expect.any(Array),
            create: expect.arrayContaining([
              expect.objectContaining({
                languageId: "es",
                default: false,
                enabled: true,
              }),
            ]),
          },
        }),
        select: expect.any(Object),
      });
    });

    test("should delete private segment for non-app type surveys", async () => {
      const mockSegment: TSegment = {
        id: "segment1",
        title: "Test Segment",
        isPrivate: true,
        environmentId: "env123",
        surveys: ["survey123"],
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
        filters: [{ id: "filter1" } as any],
      };

      const updatedSurvey: TSurvey = {
        ...mockSurvey,
        type: "link",
        segment: mockSegment,
      };

      await updateSurvey(updatedSurvey);

      expect(prisma.segment.update).toHaveBeenCalledWith({
        where: { id: "segment1" },
        data: {
          surveys: {
            disconnect: {
              id: "survey123",
            },
          },
        },
      });
      expect(prisma.segment.delete).toHaveBeenCalledWith({
        where: {
          id: "segment1",
        },
      });
    });

    test("should disconnect public segment for non-app type surveys", async () => {
      const mockSegment: TSegment = {
        id: "segment1",
        title: "Test Segment",
        isPrivate: false,
        environmentId: "env123",
        surveys: ["survey123"],
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
        filters: [],
      };

      const updatedSurvey: TSurvey = {
        ...mockSurvey,
        type: "link",
        segment: mockSegment,
      };

      await updateSurvey(updatedSurvey);

      expect(prisma.survey.update).toHaveBeenCalledWith({
        where: {
          id: "survey123",
        },
        data: {
          segment: {
            disconnect: true,
          },
        },
      });
    });

    test("should handle followUps updates", async () => {
      const updatedSurvey: TSurvey = {
        ...mockSurvey,
        followUps: [
          {
            id: "f1",
            name: "Existing Follow Up",
            createdAt: new Date(),
            updatedAt: new Date(),
            surveyId: "survey123",
            trigger: {
              type: "response",
              properties: {
                endingIds: ["ending1"],
              },
            },
            action: {
              type: "send-email",
              properties: {
                to: "test@example.com",
                subject: "Test",
                body: "Test body",
                from: "test@formbricks.com",
                replyTo: ["reply@formbricks.com"],
                attachResponseData: false,
              },
            },
            deleted: false,
          },
          {
            id: "f2",
            name: "New Follow Up",
            createdAt: new Date(),
            updatedAt: new Date(),
            surveyId: "survey123",
            trigger: {
              type: "response",
              properties: {
                endingIds: ["ending1"],
              },
            },
            action: {
              type: "send-email",
              properties: {
                to: "new@example.com",
                subject: "New Test",
                body: "New test body",
                from: "test@formbricks.com",
                replyTo: ["reply@formbricks.com"],
                attachResponseData: false,
              },
            },
            deleted: false,
          },
          {
            id: "f3",
            name: "Follow Up To Delete",
            createdAt: new Date(),
            updatedAt: new Date(),
            surveyId: "survey123",
            trigger: {
              type: "response",
              properties: {
                endingIds: ["ending1"],
              },
            },
            action: {
              type: "send-email",
              properties: {
                to: "delete@example.com",
                subject: "Delete Test",
                body: "Delete test body",
                from: "test@formbricks.com",
                replyTo: ["reply@formbricks.com"],
                attachResponseData: false,
              },
            },
            deleted: true,
          },
        ],
      };

      // Mock current survey with existing followUps
      vi.mocked(getSurvey).mockResolvedValueOnce({
        ...mockCurrentSurvey,
        followUps: [
          {
            id: "f1",
            name: "Existing Follow Up",
            trigger: {
              type: "response",
              properties: {
                endingIds: ["ending1"],
              },
            },
            action: {
              type: "send-email",
              properties: {
                to: "test@example.com",
                subject: "Test",
                body: "Test body",
                from: "test@formbricks.com",
                replyTo: ["reply@formbricks.com"],
                attachResponseData: false,
              },
            },
          },
        ],
      } as any);

      await updateSurvey(updatedSurvey);

      expect(prisma.survey.update).toHaveBeenCalledWith({
        where: { id: "survey123" },
        data: expect.objectContaining({
          followUps: {
            updateMany: [
              {
                where: {
                  id: "f1",
                },
                data: expect.objectContaining({
                  name: "Existing Follow Up",
                }),
              },
            ],
            createMany: {
              data: [
                expect.objectContaining({
                  name: "New Follow Up",
                }),
              ],
            },
            deleteMany: [
              {
                id: "f3",
              },
            ],
          },
        }),
        select: expect.any(Object),
      });
    });

    test("should handle scheduled status based on runOnDate", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const updatedSurvey: TSurvey = {
        ...mockSurvey,
        status: "completed",
        runOnDate: tomorrow,
      };

      await updateSurvey(updatedSurvey);

      expect(prisma.survey.update).toHaveBeenCalledWith({
        where: { id: "survey123" },
        data: expect.objectContaining({
          status: "scheduled", // Should be changed to scheduled because runOnDate is in the future
        }),
        select: expect.any(Object),
      });
    });

    test("should remove scheduled status when runOnDate is not set", async () => {
      const updatedSurvey: TSurvey = {
        ...mockSurvey,
        status: "scheduled",
        runOnDate: null,
      };

      await updateSurvey(updatedSurvey);

      expect(prisma.survey.update).toHaveBeenCalledWith({
        where: { id: "survey123" },
        data: expect.objectContaining({
          status: "inProgress", // Should be changed to inProgress because runOnDate is null
        }),
        select: expect.any(Object),
      });
    });

    test("should throw ResourceNotFoundError when survey is not found", async () => {
      vi.mocked(getSurvey).mockResolvedValueOnce(null as unknown as TSurvey);

      await expect(updateSurvey(mockSurvey)).rejects.toThrow(ResourceNotFoundError);
      expect(getSurvey).toHaveBeenCalledWith("survey123");
    });

    test("should throw ResourceNotFoundError when organization is not found", async () => {
      vi.mocked(getOrganizationAIKeys).mockResolvedValueOnce(null);

      await expect(updateSurvey(mockSurvey)).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw DatabaseError when Prisma throws a known request error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "4.0.0",
      });
      vi.mocked(prisma.survey.update).mockRejectedValueOnce(prismaError);

      await expect(updateSurvey(mockSurvey)).rejects.toThrow(DatabaseError);
    });

    test("should rethrow other errors", async () => {
      const genericError = new Error("Some other error");
      vi.mocked(prisma.survey.update).mockRejectedValueOnce(genericError);

      await expect(updateSurvey(mockSurvey)).rejects.toThrow(genericError);
    });

    test("should throw InvalidInputError for invalid segment filters", async () => {
      const updatedSurvey: TSurvey = {
        ...mockSurvey,
        segment: {
          id: "segment1",
          title: "Test Segment",
          isPrivate: false,
          environmentId: "env123",
          surveys: ["survey123"],
          createdAt: new Date(),
          updatedAt: new Date(),
          description: null,
          filters: "invalid filters" as any,
        },
      };

      await expect(updateSurvey(updatedSurvey)).rejects.toThrow(InvalidInputError);
    });

    test("should handle error in segment update", async () => {
      vi.mocked(prisma.segment.update).mockRejectedValueOnce(new Error("Error updating survey"));

      const updatedSurvey: TSurvey = {
        ...mockSurvey,
        segment: {
          id: "segment1",
          title: "Test Segment",
          isPrivate: false,
          environmentId: "env123",
          surveys: ["survey123"],
          createdAt: new Date(),
          updatedAt: new Date(),
          description: null,
          filters: [],
        },
      };

      await expect(updateSurvey(updatedSurvey)).rejects.toThrow("Error updating survey");
    });
  });

  describe("checkTriggersValidity", () => {
    const mockActionClasses: ActionClass[] = [
      {
        id: "action1",
        name: "Action 1",
        description: "Test Action 1",
        type: "code" as const,
        environmentId: "env123",
        createdAt: new Date(),
        updatedAt: new Date(),
        key: null,
        noCodeConfig: null,
      },
      {
        id: "action2",
        name: "Action 2",
        description: "Test Action 2",
        type: "noCode" as const,
        environmentId: "env123",
        createdAt: new Date(),
        updatedAt: new Date(),
        key: null,
        noCodeConfig: null,
      },
    ];

    const createFullActionClass = (id: string, type: "code" | "noCode" = "code"): ActionClass => ({
      id,
      name: `Action ${id}`,
      description: `Test Action ${id}`,
      type,
      environmentId: "env123",
      createdAt: new Date(),
      updatedAt: new Date(),
      key: null,
      noCodeConfig: null,
    });

    test("should not throw error for valid triggers", () => {
      const triggers = [
        { actionClass: createFullActionClass("action1") },
        { actionClass: createFullActionClass("action2", "noCode") },
      ];

      expect(() => checkTriggersValidity(triggers as any, mockActionClasses)).not.toThrow();
    });

    test("should throw error for invalid trigger id", () => {
      const triggers = [
        { actionClass: createFullActionClass("action1") },
        { actionClass: createFullActionClass("invalid") },
      ];

      expect(() => checkTriggersValidity(triggers as any, mockActionClasses)).toThrow(InvalidInputError);
      expect(() => checkTriggersValidity(triggers as any, mockActionClasses)).toThrow("Invalid trigger id");
    });

    test("should throw error for duplicate trigger ids", () => {
      const triggers = [
        { actionClass: createFullActionClass("action1") },
        { actionClass: createFullActionClass("action1") },
      ];

      expect(() => checkTriggersValidity(triggers as any, mockActionClasses)).toThrow(InvalidInputError);
      expect(() => checkTriggersValidity(triggers as any, mockActionClasses)).toThrow("Duplicate trigger id");
    });

    test("should do nothing when triggers are undefined", () => {
      expect(() => checkTriggersValidity(undefined as any, mockActionClasses)).not.toThrow();
    });
  });

  describe("handleTriggerUpdates", () => {
    const mockActionClasses: ActionClass[] = [
      {
        id: "action1",
        name: "Action 1",
        description: "Test Action 1",
        type: "code" as const,
        environmentId: "env123",
        createdAt: new Date(),
        updatedAt: new Date(),
        key: null,
        noCodeConfig: null,
      },
      {
        id: "action2",
        name: "Action 2",
        description: "Test Action 2",
        type: "noCode" as const,
        environmentId: "env123",
        createdAt: new Date(),
        updatedAt: new Date(),
        key: null,
        noCodeConfig: null,
      },
      {
        id: "action3",
        name: "Action 3",
        description: "Test Action 3",
        type: "noCode" as const,
        environmentId: "env123",
        createdAt: new Date(),
        updatedAt: new Date(),
        key: null,
        noCodeConfig: null,
      },
    ];

    const createActionClassObj = (id: string, type: "code" | "noCode" = "code"): ActionClass => ({
      id,
      name: `Action ${id}`,
      description: `Test Action ${id}`,
      type,
      environmentId: "env123",
      createdAt: new Date(),
      updatedAt: new Date(),
      key: null,
      noCodeConfig: null,
    });

    test("should return empty object when updatedTriggers is undefined", () => {
      const result = handleTriggerUpdates(undefined as any, [], mockActionClasses);
      expect(result).toEqual({});
    });

    test("should identify added triggers correctly", () => {
      const currentTriggers = [{ actionClass: createActionClassObj("action1") }];
      const updatedTriggers = [
        { actionClass: createActionClassObj("action1") },
        { actionClass: createActionClassObj("action2", "noCode") },
      ];

      const result = handleTriggerUpdates(updatedTriggers as any, currentTriggers as any, mockActionClasses);

      expect(result).toEqual({
        create: [{ actionClassId: "action2" }],
      });
      expect(surveyCache.revalidate).toHaveBeenCalledWith({ actionClassId: "action2" });
    });

    test("should identify deleted triggers correctly", () => {
      const currentTriggers = [
        { actionClass: createActionClassObj("action1") },
        { actionClass: createActionClassObj("action2", "noCode") },
      ];
      const updatedTriggers = [{ actionClass: createActionClassObj("action1") }];

      const result = handleTriggerUpdates(updatedTriggers as any, currentTriggers as any, mockActionClasses);

      expect(result).toEqual({
        deleteMany: {
          actionClassId: {
            in: ["action2"],
          },
        },
      });
      expect(surveyCache.revalidate).toHaveBeenCalledWith({ actionClassId: "action2" });
    });

    test("should handle both added and deleted triggers", () => {
      const currentTriggers = [
        { actionClass: createActionClassObj("action1") },
        { actionClass: createActionClassObj("action2", "noCode") },
      ];
      const updatedTriggers = [
        { actionClass: createActionClassObj("action1") },
        { actionClass: createActionClassObj("action3", "noCode") },
      ];

      const result = handleTriggerUpdates(updatedTriggers as any, currentTriggers as any, mockActionClasses);

      expect(result).toEqual({
        create: [{ actionClassId: "action3" }],
        deleteMany: {
          actionClassId: {
            in: ["action2"],
          },
        },
      });
      expect(surveyCache.revalidate).toHaveBeenCalledTimes(2);
      expect(surveyCache.revalidate).toHaveBeenCalledWith({ actionClassId: "action2" });
      expect(surveyCache.revalidate).toHaveBeenCalledWith({ actionClassId: "action3" });
    });

    test("should validate triggers before processing", () => {
      const currentTriggers = [{ actionClass: createActionClassObj("action1") }];
      const updatedTriggers = [
        { actionClass: createActionClassObj("action1") },
        { actionClass: createActionClassObj("invalid") },
      ];

      expect(() =>
        handleTriggerUpdates(updatedTriggers as any, currentTriggers as any, mockActionClasses)
      ).toThrow(InvalidInputError);
    });
  });
});
