import { prisma } from "@/lib/__mocks__/database";
import { getActionClasses } from "@/lib/actionClass/service";
import {
  getOrganizationByEnvironmentId,
  subscribeOrganizationMembersToSurveyResponses,
} from "@/lib/organization/service";
import { capturePosthogEnvironmentEvent } from "@/lib/posthogServer";
import { evaluateLogic } from "@/lib/surveyLogic/utils";
import { ActionClass, Prisma, Survey } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { testInputValidation } from "vitestSetup";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import { TActionClass } from "@formbricks/types/action-classes";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyCreateInput, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import {
  mockActionClass,
  mockId,
  mockOrganizationOutput,
  mockSurveyOutput,
  mockSurveyWithLogic,
  mockTransformedSurveyOutput,
  updateSurveyInput,
} from "./__mock__/survey.mock";
import {
  createSurvey,
  getSurvey,
  getSurveyCount,
  getSurveyIdByResultShareKey,
  getSurveys,
  getSurveysByActionClassId,
  getSurveysBySegmentId,
  handleTriggerUpdates,
  loadNewSegmentInSurvey,
  updateSurvey,
} from "./service";

// Mock organization service
vi.mock("@/lib/organization/service", () => ({
  getOrganizationByEnvironmentId: vi.fn().mockResolvedValue({
    id: "org123",
  }),
  subscribeOrganizationMembersToSurveyResponses: vi.fn(),
}));

// Mock posthogServer
vi.mock("@/lib/posthogServer", () => ({
  capturePosthogEnvironmentEvent: vi.fn(),
}));

// Mock actionClass service
vi.mock("@/lib/actionClass/service", () => ({
  getActionClasses: vi.fn(),
}));

beforeEach(() => {
  prisma.survey.count.mockResolvedValue(1);
});

describe("evaluateLogic with mockSurveyWithLogic", () => {
  test("should return true when q1 answer is blue", () => {
    const data = { q1: "blue" };
    const variablesData = {};

    const result = evaluateLogic(
      mockSurveyWithLogic,
      data,
      variablesData,
      mockSurveyWithLogic.questions[0].logic![0].conditions,
      "default"
    );
    expect(result).toBe(true);
  });

  test("should return false when q1 answer is not blue", () => {
    const data = { q1: "red" };
    const variablesData = {};

    const result = evaluateLogic(
      mockSurveyWithLogic,
      data,
      variablesData,
      mockSurveyWithLogic.questions[0].logic![0].conditions,
      "default"
    );
    expect(result).toBe(false);
  });

  test("should return true when q1 is blue and q2 is pizza", () => {
    const data = { q1: "blue", q2: "pizza" };
    const variablesData = {};

    const result = evaluateLogic(
      mockSurveyWithLogic,
      data,
      variablesData,
      mockSurveyWithLogic.questions[1].logic![0].conditions,
      "default"
    );
    expect(result).toBe(true);
  });

  test("should return false when q1 is blue but q2 is not pizza", () => {
    const data = { q1: "blue", q2: "burger" };
    const variablesData = {};

    const result = evaluateLogic(
      mockSurveyWithLogic,
      data,
      variablesData,
      mockSurveyWithLogic.questions[1].logic![0].conditions,
      "default"
    );
    expect(result).toBe(false);
  });

  test("should return true when q2 is pizza or q3 is Inception", () => {
    const data = { q2: "pizza", q3: "Inception" };
    const variablesData = {};

    const result = evaluateLogic(
      mockSurveyWithLogic,
      data,
      variablesData,
      mockSurveyWithLogic.questions[2].logic![0].conditions,
      "default"
    );
    expect(result).toBe(true);
  });

  test("should return true when var1 is equal to single select question value", () => {
    const data = { q4: "lmao" };
    const variablesData = { siog1dabtpo3l0a3xoxw2922: "lmao" };

    const result = evaluateLogic(
      mockSurveyWithLogic,
      data,
      variablesData,
      mockSurveyWithLogic.questions[3].logic![0].conditions,
      "default"
    );
    expect(result).toBe(true);
  });

  test("should return false when var1 is not equal to single select question value", () => {
    const data = { q4: "lol" };
    const variablesData = { siog1dabtpo3l0a3xoxw2922: "damn" };

    const result = evaluateLogic(
      mockSurveyWithLogic,
      data,
      variablesData,
      mockSurveyWithLogic.questions[3].logic![0].conditions,
      "default"
    );
    expect(result).toBe(false);
  });

  test("should return true when var2 is greater than 30 and less than open text number value", () => {
    const data = { q5: "40" };
    const variablesData = { km1srr55owtn2r7lkoh5ny1u: 35 };

    const result = evaluateLogic(
      mockSurveyWithLogic,
      data,
      variablesData,
      mockSurveyWithLogic.questions[4].logic![0].conditions,
      "default"
    );
    expect(result).toBe(true);
  });

  test("should return false when var2 is not greater than 30 or greater than open text number value", () => {
    const data = { q5: "40" };
    const variablesData = { km1srr55owtn2r7lkoh5ny1u: 25 };

    const result = evaluateLogic(
      mockSurveyWithLogic,
      data,
      variablesData,
      mockSurveyWithLogic.questions[4].logic![0].conditions,
      "default"
    );
    expect(result).toBe(false);
  });

  test("should return for complex condition", () => {
    const data = { q6: ["lmao", "XD"], q1: "green", q2: "pizza", q3: "inspection", name: "pizza" };
    const variablesData = { siog1dabtpo3l0a3xoxw2922: "tokyo" };

    const result = evaluateLogic(
      mockSurveyWithLogic,
      data,
      variablesData,
      mockSurveyWithLogic.questions[5].logic![0].conditions,
      "default"
    );
    expect(result).toBe(true);
  });
});

describe("Tests for getSurvey", () => {
  describe("Happy Path", () => {
    test("Returns a survey", async () => {
      prisma.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      const survey = await getSurvey(mockId);
      expect(survey).toEqual(mockTransformedSurveyOutput);
    });

    test("Returns null if survey is not found", async () => {
      prisma.survey.findUnique.mockResolvedValueOnce(null);
      const survey = await getSurvey(mockId);
      expect(survey).toBeNull();
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getSurvey, "123#");

    test("should throw a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });
      prisma.survey.findUnique.mockRejectedValue(errToThrow);
      await expect(getSurvey(mockId)).rejects.toThrow(DatabaseError);
    });

    test("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.survey.findUnique.mockRejectedValue(new Error(mockErrorMessage));
      await expect(getSurvey(mockId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSurveysByActionClassId", () => {
  describe("Happy Path", () => {
    test("Returns an array of surveys for a given actionClassId", async () => {
      prisma.survey.findMany.mockResolvedValueOnce([mockSurveyOutput]);
      const surveys = await getSurveysByActionClassId(mockId);
      expect(surveys).toEqual([mockTransformedSurveyOutput]);
    });

    test("Returns an empty array if no surveys are found", async () => {
      prisma.survey.findMany.mockResolvedValueOnce([]);
      const surveys = await getSurveysByActionClassId(mockId);
      expect(surveys).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getSurveysByActionClassId, "123#");

    test("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prisma.survey.findMany.mockRejectedValue(new Error(mockErrorMessage));
      await expect(getSurveysByActionClassId(mockId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSurveys", () => {
  describe("Happy Path", () => {
    test("Returns an array of surveys for a given environmentId, limit(optional) and offset(optional)", async () => {
      prisma.survey.findMany.mockResolvedValueOnce([mockSurveyOutput]);
      const surveys = await getSurveys(mockId);
      expect(surveys).toEqual([mockTransformedSurveyOutput]);
    });

    test("Returns an empty array if no surveys are found", async () => {
      prisma.survey.findMany.mockResolvedValueOnce([]);

      const surveys = await getSurveys(mockId);
      expect(surveys).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getSurveysByActionClassId, "123#");

    test("should throw a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      prisma.survey.findMany.mockRejectedValue(errToThrow);
      await expect(getSurveys(mockId)).rejects.toThrow(DatabaseError);
    });

    test("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prisma.survey.findMany.mockRejectedValue(new Error(mockErrorMessage));
      await expect(getSurveys(mockId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for updateSurvey", () => {
  beforeEach(() => {
    vi.mocked(getActionClasses).mockResolvedValueOnce([mockActionClass] as TActionClass[]);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce(mockOrganizationOutput);
  });

  describe("Happy Path", () => {
    test("Updates a survey successfully", async () => {
      prisma.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      prisma.survey.update.mockResolvedValueOnce(mockSurveyOutput);
      const updatedSurvey = await updateSurvey(updateSurveyInput);
      expect(updatedSurvey).toEqual(mockTransformedSurveyOutput);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(updateSurvey, "123#");

    test("Throws ResourceNotFoundError if the survey does not exist", async () => {
      prisma.survey.findUnique.mockRejectedValueOnce(
        new ResourceNotFoundError("Survey", updateSurveyInput.id)
      );
      await expect(updateSurvey(updateSurveyInput)).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });
      prisma.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      prisma.survey.update.mockRejectedValue(errToThrow);
      await expect(updateSurvey(updateSurveyInput)).rejects.toThrow(DatabaseError);
    });

    test("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prisma.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      prisma.survey.update.mockRejectedValue(new Error(mockErrorMessage));
      await expect(updateSurvey(updateSurveyInput)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSurveyCount service", () => {
  describe("Happy Path", () => {
    test("Counts the total number of surveys for a given environment ID", async () => {
      const count = await getSurveyCount(mockId);
      expect(count).toEqual(1);
    });

    test("Returns zero count when there are no surveys for a given environment ID", async () => {
      prisma.survey.count.mockResolvedValue(0);
      const count = await getSurveyCount(mockId);
      expect(count).toEqual(0);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getSurveyCount, "123#");

    test("Throws a generic Error for other unexpected issues", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.survey.count.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getSurveyCount(mockId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for handleTriggerUpdates", () => {
  const mockEnvironmentId = "env-123";
  const mockActionClassId1 = "action-123";
  const mockActionClassId2 = "action-456";

  const mockActionClasses: ActionClass[] = [
    {
      id: mockActionClassId1,
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: mockEnvironmentId,
      name: "Test Action 1",
      description: "Test action description 1",
      type: "code",
      key: "test-action-1",
      noCodeConfig: null,
    },
    {
      id: mockActionClassId2,
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: mockEnvironmentId,
      name: "Test Action 2",
      description: "Test action description 2",
      type: "code",
      key: "test-action-2",
      noCodeConfig: null,
    },
  ];

  test("adds new triggers correctly", () => {
    const updatedTriggers = [
      {
        actionClass: {
          id: mockActionClassId1,
          name: "Test Action 1",
          environmentId: mockEnvironmentId,
          type: "code",
          key: "test-action-1",
        },
      },
    ] as TSurvey["triggers"];
    const currentTriggers = [];

    const result = handleTriggerUpdates(updatedTriggers, currentTriggers, mockActionClasses);

    expect(result).toHaveProperty("create");
    expect(result.create).toEqual([{ actionClassId: mockActionClassId1 }]);
    expect(surveyCache.revalidate).toHaveBeenCalledWith({ actionClassId: mockActionClassId1 });
  });

  test("removes deleted triggers correctly", () => {
    const updatedTriggers = [];
    const currentTriggers = [
      {
        actionClass: {
          id: mockActionClassId1,
          name: "Test Action 1",
          environmentId: mockEnvironmentId,
          type: "code",
          key: "test-action-1",
        },
      },
    ] as TSurvey["triggers"];

    const result = handleTriggerUpdates(updatedTriggers, currentTriggers, mockActionClasses);

    expect(result).toHaveProperty("deleteMany");
    expect(result.deleteMany).toEqual({ actionClassId: { in: [mockActionClassId1] } });
    expect(surveyCache.revalidate).toHaveBeenCalledWith({ actionClassId: mockActionClassId1 });
  });

  test("handles both adding and removing triggers", () => {
    const updatedTriggers = [
      {
        actionClass: {
          id: mockActionClassId2,
          name: "Test Action 2",
          environmentId: mockEnvironmentId,
          type: "code",
          key: "test-action-2",
        },
      },
    ] as TSurvey["triggers"];

    const currentTriggers = [
      {
        actionClass: {
          id: mockActionClassId1,
          name: "Test Action 1",
          environmentId: mockEnvironmentId,
          type: "code",
          key: "test-action-1",
        },
      },
    ] as TSurvey["triggers"];

    const result = handleTriggerUpdates(updatedTriggers, currentTriggers, mockActionClasses);

    expect(result).toHaveProperty("create");
    expect(result).toHaveProperty("deleteMany");
    expect(result.create).toEqual([{ actionClassId: mockActionClassId2 }]);
    expect(result.deleteMany).toEqual({ actionClassId: { in: [mockActionClassId1] } });
    expect(surveyCache.revalidate).toHaveBeenCalledTimes(2);
  });

  test("returns empty object when no triggers provided", () => {
    // @ts-expect-error -- This is a test case to check the empty input
    const result = handleTriggerUpdates(undefined, [], mockActionClasses);
    expect(result).toEqual({});
  });

  test("throws InvalidInputError for invalid trigger IDs", () => {
    const updatedTriggers = [
      {
        actionClass: {
          id: "invalid-action-id",
          name: "Invalid Action",
          environmentId: mockEnvironmentId,
          type: "code",
          key: "invalid-action",
        },
      },
    ] as TSurvey["triggers"];

    const currentTriggers = [];

    expect(() => handleTriggerUpdates(updatedTriggers, currentTriggers, mockActionClasses)).toThrow(
      InvalidInputError
    );
  });

  test("throws InvalidInputError for duplicate trigger IDs", () => {
    const updatedTriggers = [
      {
        actionClass: {
          id: mockActionClassId1,
          name: "Test Action 1",
          environmentId: mockEnvironmentId,
          type: "code",
          key: "test-action-1",
        },
      },
      {
        actionClass: {
          id: mockActionClassId1, // Duplicated ID
          name: "Test Action 1",
          environmentId: mockEnvironmentId,
          type: "code",
          key: "test-action-1",
        },
      },
    ] as TSurvey["triggers"];
    const currentTriggers = [];

    expect(() => handleTriggerUpdates(updatedTriggers, currentTriggers, mockActionClasses)).toThrow(
      InvalidInputError
    );
  });
});

describe("Tests for createSurvey", () => {
  const mockEnvironmentId = "env123";
  const mockUserId = "user123";

  const mockCreateSurveyInput = {
    name: "Test Survey",
    type: "app" as const,
    createdBy: mockUserId,
    status: "inProgress" as const,
    welcomeCard: {
      enabled: true,
      headline: { default: "Welcome" },
      html: { default: "<p>Welcome to our survey</p>" },
    },
    questions: [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        inputType: "text",
        headline: { default: "What is your favorite color?" },
        required: true,
        charLimit: {
          enabled: false,
        },
      },
      {
        id: "q2",
        type: TSurveyQuestionTypeEnum.OpenText,
        inputType: "text",
        headline: { default: "What is your favorite food?" },
        required: true,
        charLimit: {
          enabled: false,
        },
      },
      {
        id: "q3",
        type: TSurveyQuestionTypeEnum.OpenText,
        inputType: "text",
        headline: { default: "What is your favorite movie?" },
        required: true,
        charLimit: {
          enabled: false,
        },
      },
      {
        id: "q4",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { default: "Select a number:" },
        choices: [
          { id: "mvedaklp0gxxycprpyhhwen7", label: { default: "lol" } },
          { id: "i7ws8uqyj66q5x086vbqtm8n", label: { default: "lmao" } },
          { id: "cy8hbbr9e2q6ywbfjbzwdsqn", label: { default: "XD" } },
          { id: "sojc5wwxc5gxrnuib30w7t6s", label: { default: "hehe" } },
        ],
        required: true,
      },
      {
        id: "q5",
        type: TSurveyQuestionTypeEnum.OpenText,
        inputType: "number",
        headline: { default: "Select your age group:" },
        required: true,
        charLimit: {
          enabled: false,
        },
      },
      {
        id: "q6",
        type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
        headline: { default: "Select your age group:" },
        required: true,
        choices: [
          { id: "mvedaklp0gxxycprpyhhwen7", label: { default: "lol" } },
          { id: "i7ws8uqyj66q5x086vbqtm8n", label: { default: "lmao" } },
          { id: "cy8hbbr9e2q6ywbfjbzwdsqn", label: { default: "XD" } },
          { id: "sojc5wwxc5gxrnuib30w7t6s", label: { default: "hehe" } },
        ],
      },
    ],
    variables: [],
    hiddenFields: { enabled: false, fieldIds: [] },
    endings: [],
    displayOption: "respondMultiple" as const,
    languages: [],
  } as TSurveyCreateInput;

  const mockActionClasses = [
    {
      id: "action-123",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: mockEnvironmentId,
      name: "Test Action",
      description: "Test action description",
      type: "code",
      key: "test-action",
      noCodeConfig: null,
    },
  ];

  beforeEach(() => {
    vi.mocked(getActionClasses).mockResolvedValue(mockActionClasses as TActionClass[]);
  });

  describe("Happy Path", () => {
    test("creates a survey successfully", async () => {
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce(mockOrganizationOutput);
      prisma.survey.create.mockResolvedValueOnce({
        ...mockSurveyOutput,
      });

      const result = await createSurvey(mockEnvironmentId, mockCreateSurveyInput);

      expect(prisma.survey.create).toHaveBeenCalled();
      expect(result.name).toEqual(mockSurveyOutput.name);
      expect(subscribeOrganizationMembersToSurveyResponses).toHaveBeenCalled();
      expect(capturePosthogEnvironmentEvent).toHaveBeenCalled();
    });

    test("creates a private segment for app surveys", async () => {
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce(mockOrganizationOutput);
      prisma.survey.create.mockResolvedValueOnce({
        ...mockSurveyOutput,
        type: "app",
      });

      prisma.segment.create.mockResolvedValueOnce({
        id: "segment-123",
        environmentId: mockEnvironmentId,
        title: mockSurveyOutput.id,
        isPrivate: true,
        filters: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as TSegment);

      await createSurvey(mockEnvironmentId, {
        ...mockCreateSurveyInput,
        type: "app",
      });

      expect(prisma.segment.create).toHaveBeenCalled();
      expect(prisma.survey.update).toHaveBeenCalled();
      expect(segmentCache.revalidate).toHaveBeenCalled();
    });

    test("creates survey with follow-ups", async () => {
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce(mockOrganizationOutput);
      const followUp = {
        id: "followup1",
        name: "Follow up 1",
        trigger: { type: "response", properties: null },
        action: {
          type: "send-email",
          properties: {
            to: "abc@example.com",
            attachResponseData: true,
            body: "Hello",
            from: "hello@exmaple.com",
            replyTo: ["hello@example.com"],
            subject: "Follow up",
          },
        },
        surveyId: mockSurveyOutput.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as TSurveyFollowUp;

      const surveyWithFollowUps = {
        ...mockCreateSurveyInput,
        followUps: [followUp],
      };

      prisma.survey.create.mockResolvedValueOnce({
        ...mockSurveyOutput,
      });

      await createSurvey(mockEnvironmentId, surveyWithFollowUps);

      expect(prisma.survey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            followUps: {
              create: [
                expect.objectContaining({
                  name: "Follow up 1",
                }),
              ],
            },
          }),
        })
      );
    });
  });

  describe("Sad Path", () => {
    testInputValidation(createSurvey, "123#", mockCreateSurveyInput);

    test("throws ResourceNotFoundError if organization not found", async () => {
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce(null);
      await expect(createSurvey(mockEnvironmentId, mockCreateSurveyInput)).rejects.toThrow(
        ResourceNotFoundError
      );
    });

    test("throws DatabaseError if there is a Prisma error", async () => {
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce(mockOrganizationOutput);
      const mockError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "1.0.0",
      });
      prisma.survey.create.mockRejectedValueOnce(mockError);

      await expect(createSurvey(mockEnvironmentId, mockCreateSurveyInput)).rejects.toThrow(DatabaseError);
    });
  });
});

describe("Tests for getSurveyIdByResultShareKey", () => {
  const mockResultShareKey = "share-key-123";

  describe("Happy Path", () => {
    test("returns survey ID when found", async () => {
      prisma.survey.findFirst.mockResolvedValueOnce({
        id: mockId,
      } as Survey);

      const result = await getSurveyIdByResultShareKey(mockResultShareKey);

      expect(prisma.survey.findFirst).toHaveBeenCalledWith({
        where: { resultShareKey: mockResultShareKey },
        select: { id: true },
      });
      expect(result).toBe(mockId);
    });

    test("returns null when survey not found", async () => {
      prisma.survey.findFirst.mockResolvedValueOnce(null);

      const result = await getSurveyIdByResultShareKey(mockResultShareKey);

      expect(result).toBeNull();
    });
  });

  describe("Sad Path", () => {
    test("throws DatabaseError on Prisma error", async () => {
      const mockError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "1.0.0",
      });
      prisma.survey.findFirst.mockRejectedValueOnce(mockError);

      await expect(getSurveyIdByResultShareKey(mockResultShareKey)).rejects.toThrow(DatabaseError);
    });

    test("throws error on unexpected error", async () => {
      prisma.survey.findFirst.mockRejectedValueOnce(new Error("Unexpected error"));

      await expect(getSurveyIdByResultShareKey(mockResultShareKey)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for loadNewSegmentInSurvey", () => {
  const mockSurveyId = mockId;
  const mockNewSegmentId = "segment456";
  const mockCurrentSegmentId = "segment-123";
  const mockEnvironmentId = "env-123";

  describe("Happy Path", () => {
    test("loads new segment successfully", async () => {
      // Set up mocks for existing survey
      prisma.survey.findUnique.mockResolvedValueOnce({
        ...mockSurveyOutput,
      });
      // Mock segment exists
      prisma.segment.findUnique.mockResolvedValueOnce({
        id: mockNewSegmentId,
        environmentId: mockEnvironmentId,
        filters: [],
        title: "Test Segment",
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: "Test Segment Description",
      });
      // Mock survey update
      prisma.survey.update.mockResolvedValueOnce({
        ...mockSurveyOutput,
        segmentId: mockNewSegmentId,
      });
      const result = await loadNewSegmentInSurvey(mockSurveyId, mockNewSegmentId);
      expect(prisma.survey.update).toHaveBeenCalledWith({
        where: { id: mockSurveyId },
        data: {
          segment: {
            connect: {
              id: mockNewSegmentId,
            },
          },
        },
        select: expect.anything(),
      });
      expect(result).toEqual(
        expect.objectContaining({
          segmentId: mockNewSegmentId,
        })
      );
      expect(surveyCache.revalidate).toHaveBeenCalledWith({ id: mockSurveyId });
      expect(segmentCache.revalidate).toHaveBeenCalledWith({ id: mockNewSegmentId });
    });

    test("deletes private segment when changing to a new segment", async () => {
      const mockSegment = {
        id: mockCurrentSegmentId,
        environmentId: mockEnvironmentId,
        title: mockId, // Private segments have title = surveyId
        isPrivate: true,
        filters: [],
        surveys: [mockSurveyId],
        createdAt: new Date(),
        updatedAt: new Date(),
        description: "Test Segment Description",
      };

      // Set up mocks for existing survey with private segment
      prisma.survey.findUnique.mockResolvedValueOnce({
        ...mockSurveyOutput,
        segment: mockSegment,
      } as Survey);

      // Mock segment exists
      prisma.segment.findUnique.mockResolvedValueOnce({
        ...mockSegment,
        id: mockNewSegmentId,
        environmentId: mockEnvironmentId,
      });

      // Mock survey update
      prisma.survey.update.mockResolvedValueOnce({
        ...mockSurveyOutput,
        segment: {
          id: mockNewSegmentId,
          environmentId: mockEnvironmentId,
          title: "Test Segment",
          isPrivate: false,
          filters: [],
          surveys: [{ id: mockSurveyId }],
        },
      } as Survey);

      // Mock segment delete
      prisma.segment.delete.mockResolvedValueOnce({
        id: mockCurrentSegmentId,
        environmentId: mockEnvironmentId,
        surveys: [{ id: mockSurveyId }],
      } as unknown as TSegment);

      await loadNewSegmentInSurvey(mockSurveyId, mockNewSegmentId);

      // Verify the private segment was deleted
      expect(prisma.segment.delete).toHaveBeenCalledWith({
        where: { id: mockCurrentSegmentId },
        select: expect.anything(),
      });
      // Verify the cache was invalidated
      expect(segmentCache.revalidate).toHaveBeenCalledWith({ id: mockCurrentSegmentId });
    });
  });

  describe("Sad Path", () => {
    testInputValidation(loadNewSegmentInSurvey, "123#", "123#");

    test("throws ResourceNotFoundError when survey not found", async () => {
      prisma.survey.findUnique.mockResolvedValueOnce(null);

      await expect(loadNewSegmentInSurvey(mockSurveyId, mockNewSegmentId)).rejects.toThrow(
        ResourceNotFoundError
      );
    });

    test("throws ResourceNotFoundError when segment not found", async () => {
      // Set up mock for existing survey
      prisma.survey.findUnique.mockResolvedValueOnce({
        ...mockSurveyOutput,
      });

      // Segment not found
      prisma.segment.findUnique.mockResolvedValueOnce(null);

      await expect(loadNewSegmentInSurvey(mockSurveyId, mockNewSegmentId)).rejects.toThrow(
        ResourceNotFoundError
      );
    });

    test("throws DatabaseError on Prisma error", async () => {
      // Set up mock for existing survey
      prisma.survey.findUnique.mockResolvedValueOnce({
        ...mockSurveyOutput,
      });

      //   // Mock segment exists
      prisma.segment.findUnique.mockResolvedValueOnce({
        id: mockNewSegmentId,
        environmentId: mockEnvironmentId,
        filters: [],
        title: "Test Segment",
        isPrivate: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        description: "Test Segment Description",
      });

      // Mock Prisma error on update
      const mockError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "1.0.0",
      });

      prisma.survey.update.mockRejectedValueOnce(mockError);

      await expect(loadNewSegmentInSurvey(mockSurveyId, mockNewSegmentId)).rejects.toThrow(DatabaseError);
    });
  });
});

describe("Tests for getSurveysBySegmentId", () => {
  const mockSegmentId = "segment-123";

  describe("Happy Path", () => {
    test("returns surveys associated with a segment", async () => {
      prisma.survey.findMany.mockResolvedValueOnce([mockSurveyOutput]);

      const result = await getSurveysBySegmentId(mockSegmentId);

      expect(prisma.survey.findMany).toHaveBeenCalledWith({
        where: { segmentId: mockSegmentId },
        select: expect.anything(),
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: mockSurveyOutput.id,
        })
      );
    });

    test("returns empty array when no surveys found", async () => {
      prisma.survey.findMany.mockResolvedValueOnce([]);

      const result = await getSurveysBySegmentId(mockSegmentId);

      expect(result).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    test("throws DatabaseError on Prisma error", async () => {
      const mockError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "1.0.0",
      });
      prisma.survey.findMany.mockRejectedValueOnce(mockError);

      await expect(getSurveysBySegmentId(mockSegmentId)).rejects.toThrow(DatabaseError);
    });

    test("throws error on unexpected error", async () => {
      prisma.survey.findMany.mockRejectedValueOnce(new Error("Unexpected error"));

      await expect(getSurveysBySegmentId(mockSegmentId)).rejects.toThrow(Error);
    });
  });
});
