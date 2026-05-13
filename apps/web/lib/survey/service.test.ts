import { prisma } from "@/lib/__mocks__/database";
import { ActionClass, Prisma, Survey } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { testInputValidation } from "vitestSetup";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { TSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import { TActionClass } from "@formbricks/types/action-classes";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyCreateInput, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { getActionClasses } from "@/lib/actionClass/service";
import {
  getOrganizationByWorkspaceId,
  subscribeOrganizationMembersToSurveyResponses,
} from "@/lib/organization/service";
import { evaluateLogic } from "@/lib/surveyLogic/utils";
import { handleTriggerUpdates } from "@/modules/survey/lib/trigger-updates";
import {
  mockActionClass,
  mockId,
  mockOrganizationOutput,
  mockSurveyLanguages,
  mockSurveyOutput,
  mockSurveyWithLogic,
  mockTransformedSurveyOutput,
  updateSurveyInput,
} from "./__mock__/survey.mock";
import {
  createSurvey,
  getSurvey,
  getSurveyCount,
  getSurveys,
  getSurveysByActionClassId,
  getSurveysBySegmentId,
  loadNewSegmentInSurvey,
  updateSurvey,
  updateSurveyInternal,
} from "./service";

const SURVEY_SERVICE_TEST_TIMEOUT_MS = 30_000;

// Mock organization service
vi.mock("@/lib/organization/service", () => ({
  getOrganizationByWorkspaceId: vi.fn().mockResolvedValue({
    id: "org123",
  }),
  subscribeOrganizationMembersToSurveyResponses: vi.fn(),
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
      mockSurveyWithLogic.blocks[0].logic![0].conditions,
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
      mockSurveyWithLogic.blocks[0].logic![0].conditions,
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
      mockSurveyWithLogic.blocks[0].logic![1].conditions,
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
      mockSurveyWithLogic.blocks[0].logic![1].conditions,
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
      mockSurveyWithLogic.blocks[0].logic![2].conditions,
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
      mockSurveyWithLogic.blocks[0].logic![3].conditions,
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
      mockSurveyWithLogic.blocks[0].logic![3].conditions,
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
      mockSurveyWithLogic.blocks[0].logic![4].conditions,
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
      mockSurveyWithLogic.blocks[0].logic![4].conditions,
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
      mockSurveyWithLogic.blocks[0].logic![5].conditions,
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
    test("Returns an array of surveys for a given workspaceId, limit(optional) and offset(optional)", async () => {
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
    vi.mocked(getOrganizationByWorkspaceId).mockResolvedValueOnce(mockOrganizationOutput);
  });

  describe("Happy Path", () => {
    test("Updates a survey successfully", async () => {
      prisma.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      prisma.survey.update.mockResolvedValueOnce(mockSurveyOutput);
      const updatedSurvey = await updateSurvey(updateSurveyInput);
      expect(updatedSurvey).toEqual(mockTransformedSurveyOutput);
    });

    // Note: Language handling tests (for languages.length > 0 fix) are covered in
    // apps/web/modules/survey/editor/lib/survey.test.ts where we have better control
    // over the test mocks. The key fix ensures languages.length > 0 (not > 1) is used.
  });

  describe("Sad Path", () => {
    test(
      "throws a ValidationError if the inputs are invalid",
      async () => {
        await expect(updateSurvey("123#" as unknown as TSurvey)).rejects.toThrow(ValidationError);
      },
      SURVEY_SERVICE_TEST_TIMEOUT_MS
    );

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
    test("Counts the total number of surveys for a given workspace ID", async () => {
      const count = await getSurveyCount(mockId);
      expect(count).toEqual(1);
    });

    test("Returns zero count when there are no surveys for a given workspace ID", async () => {
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
  const mockWorkspaceId = "env-123";
  const mockActionClassId1 = "action-123";
  const mockActionClassId2 = "action-456";

  const mockActionClasses: ActionClass[] = [
    {
      id: mockActionClassId1,
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: mockWorkspaceId,
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
      workspaceId: mockWorkspaceId,
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
          workspaceId: mockWorkspaceId,
          type: "code",
          key: "test-action-1",
        },
      },
    ] as TSurvey["triggers"];
    const currentTriggers: TSurvey["triggers"] = [];

    const result = handleTriggerUpdates(updatedTriggers, currentTriggers, mockActionClasses);

    expect(result).toHaveProperty("create");
    expect(result.create).toEqual([{ actionClassId: mockActionClassId1 }]);
  });

  test("removes deleted triggers correctly", () => {
    const updatedTriggers: TSurvey["triggers"] = [];
    const currentTriggers = [
      {
        actionClass: {
          id: mockActionClassId1,
          name: "Test Action 1",
          workspaceId: mockWorkspaceId,
          type: "code",
          key: "test-action-1",
        },
      },
    ] as TSurvey["triggers"];

    const result = handleTriggerUpdates(updatedTriggers, currentTriggers, mockActionClasses);

    expect(result).toHaveProperty("deleteMany");
    expect(result.deleteMany).toEqual({ actionClassId: { in: [mockActionClassId1] } });
  });

  test("handles both adding and removing triggers", () => {
    const updatedTriggers = [
      {
        actionClass: {
          id: mockActionClassId2,
          name: "Test Action 2",
          workspaceId: mockWorkspaceId,
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
          workspaceId: mockWorkspaceId,
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
          workspaceId: mockWorkspaceId,
          type: "code",
          key: "invalid-action",
        },
      },
    ] as TSurvey["triggers"];

    const currentTriggers: TSurvey["triggers"] = [];

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
          workspaceId: mockWorkspaceId,
          type: "code",
          key: "test-action-1",
        },
      },
      {
        actionClass: {
          id: mockActionClassId1, // Duplicated ID
          name: "Test Action 1",
          workspaceId: mockWorkspaceId,
          type: "code",
          key: "test-action-1",
        },
      },
    ] as TSurvey["triggers"];
    const currentTriggers: TSurvey["triggers"] = [];

    expect(() => handleTriggerUpdates(updatedTriggers, currentTriggers, mockActionClasses)).toThrow(
      InvalidInputError
    );
  });
});

describe("Tests for createSurvey", () => {
  const mockWorkspaceId = "clxxxxxxxxxxxxxxxxxxxxxxxxx";
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

  const getMultiLanguageCreateSurveyInput = (): TSurveyCreateInput =>
    ({
      ...mockCreateSurveyInput,
      welcomeCard: {
        ...mockCreateSurveyInput.welcomeCard,
        headline: { default: "Welcome", de: "Willkommen" },
      },
      questions: mockCreateSurveyInput.questions.map((question) => {
        if ("choices" in question && Array.isArray(question.choices)) {
          return {
            ...question,
            headline: { ...question.headline, de: question.headline.default },
            choices: question.choices.map((choice) => ({
              ...choice,
              label: { ...choice.label, de: choice.label.default },
            })),
          };
        }

        return {
          ...question,
          headline: { ...question.headline, de: question.headline.default },
        };
      }),
      languages: mockSurveyLanguages,
    }) as TSurveyCreateInput;

  const mockActionClasses = [
    {
      id: "action-123",
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: mockWorkspaceId,
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
      vi.mocked(getOrganizationByWorkspaceId).mockResolvedValueOnce(mockOrganizationOutput);
      prisma.survey.create.mockResolvedValueOnce({
        ...mockSurveyOutput,
      });

      const result = await createSurvey(mockWorkspaceId, mockCreateSurveyInput);

      expect(prisma.survey.create).toHaveBeenCalled();
      expect(result.name).toEqual(mockSurveyOutput.name);
      expect(subscribeOrganizationMembersToSurveyResponses).toHaveBeenCalled();
    });

    test("enables browser language auto-selection by default for new multi-language surveys", async () => {
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce(mockOrganizationOutput);
      prisma.survey.create.mockResolvedValueOnce({
        ...mockSurveyOutput,
      });

      await createSurvey(mockEnvironmentId, {
        ...getMultiLanguageCreateSurveyInput(),
      });

      expect(prisma.survey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            autoSelectLanguage: true,
          }),
        })
      );
    });

    test("preserves explicit browser language auto-selection setting on create", async () => {
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce(mockOrganizationOutput);
      prisma.survey.create.mockResolvedValueOnce({
        ...mockSurveyOutput,
      });

      await createSurvey(mockEnvironmentId, {
        ...getMultiLanguageCreateSurveyInput(),
        autoSelectLanguage: false,
      });

      expect(prisma.survey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            autoSelectLanguage: false,
          }),
        })
      );
    });

    test("creates a private segment for app surveys", async () => {
      vi.mocked(getOrganizationByWorkspaceId).mockResolvedValueOnce(mockOrganizationOutput);
      prisma.survey.create.mockResolvedValueOnce({
        ...mockSurveyOutput,
        type: "app",
      });

      prisma.segment.create.mockResolvedValueOnce({
        id: "segment-123",
        workspaceId: mockWorkspaceId,
        title: mockSurveyOutput.id,
        isPrivate: true,
        filters: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as TSegment);

      await createSurvey(mockWorkspaceId, {
        ...mockCreateSurveyInput,
        type: "app",
      });

      expect(prisma.segment.create).toHaveBeenCalled();
      expect(prisma.survey.update).toHaveBeenCalled();
    });

    test("creates survey with follow-ups", async () => {
      vi.mocked(getOrganizationByWorkspaceId).mockResolvedValueOnce(mockOrganizationOutput);
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

      await createSurvey(mockWorkspaceId, surveyWithFollowUps);

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
      vi.mocked(getOrganizationByWorkspaceId).mockResolvedValueOnce(null);
      await expect(createSurvey(mockWorkspaceId, mockCreateSurveyInput)).rejects.toThrow(
        ResourceNotFoundError
      );
    });

    test("throws DatabaseError if there is a Prisma error", async () => {
      vi.mocked(getOrganizationByWorkspaceId).mockResolvedValueOnce(mockOrganizationOutput);
      const mockError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "1.0.0",
      });
      prisma.survey.create.mockRejectedValueOnce(mockError);

      await expect(createSurvey(mockWorkspaceId, mockCreateSurveyInput)).rejects.toThrow(DatabaseError);
    });
  });
});

describe("Tests for loadNewSegmentInSurvey", () => {
  const mockSurveyId = mockId;
  const mockNewSegmentId = "segment456";
  const mockCurrentSegmentId = "segment-123";
  const mockWorkspaceId = "env-123";

  describe("Happy Path", () => {
    test("loads new segment successfully", async () => {
      // Set up mocks for existing survey
      prisma.survey.findUnique.mockResolvedValueOnce({
        ...mockSurveyOutput,
      });
      // Mock segment exists
      prisma.segment.findUnique.mockResolvedValueOnce({
        id: mockNewSegmentId,
        workspaceId: mockWorkspaceId,
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
    });

    test("deletes private segment when changing to a new segment", async () => {
      const mockSegment = {
        id: mockCurrentSegmentId,
        workspaceId: mockWorkspaceId,
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
        workspaceId: mockWorkspaceId,
      });

      // Mock survey update
      prisma.survey.update.mockResolvedValueOnce({
        ...mockSurveyOutput,
        segment: {
          id: mockNewSegmentId,
          workspaceId: mockWorkspaceId,
          title: "Test Segment",
          isPrivate: false,
          filters: [],
          surveys: [{ id: mockSurveyId }],
        },
      } as Survey);

      // Mock segment delete
      prisma.segment.delete.mockResolvedValueOnce({
        id: mockCurrentSegmentId,
        workspaceId: mockWorkspaceId,
        surveys: [{ id: mockSurveyId }],
      } as unknown as TSegment);

      await loadNewSegmentInSurvey(mockSurveyId, mockNewSegmentId);

      // Verify the private segment was deleted
      expect(prisma.segment.delete).toHaveBeenCalledWith({
        where: { id: mockCurrentSegmentId },
        select: expect.anything(),
      });
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
        workspaceId: mockWorkspaceId,
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

describe("updateSurveyDraftAction", () => {
  beforeEach(() => {
    vi.mocked(getActionClasses).mockResolvedValue([mockActionClass] as TActionClass[]);
    vi.mocked(getOrganizationByWorkspaceId).mockResolvedValue(mockOrganizationOutput);
  });

  describe("Happy Path", () => {
    test("should save draft with missing translations", async () => {
      prisma.survey.findUnique.mockResolvedValue(mockSurveyOutput);
      prisma.survey.update.mockResolvedValue(mockSurveyOutput);

      // Create a survey with incomplete i18n/fields
      const incompleteSurvey = {
        ...updateSurveyInput,
        questions: [
          {
            id: "q1",
            type: TSurveyQuestionTypeEnum.OpenText,
            // Missing headline or other required fields
          },
        ],
      } as unknown as TSurvey;

      // Expect success (skipValidation = true)
      const result = await updateSurveyInternal(incompleteSurvey, true);
      expect(result).toBeDefined();
      expect(prisma.survey.update).toHaveBeenCalled();
    });

    test("should allow draft with invalid images if gating is applied", async () => {
      prisma.survey.findUnique.mockResolvedValue(mockSurveyOutput);
      prisma.survey.update.mockResolvedValue(mockSurveyOutput);

      const surveyWithInvalidImage = {
        ...updateSurveyInput,
        questions: [
          {
            id: "q1",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: { default: "Question" },
            imageUrl: "http://invalid-image-url.com/image.txt", // Invalid image extension
          },
        ],
      } as unknown as TSurvey;

      // Expect success (skipValidation = true)
      await updateSurveyInternal(surveyWithInvalidImage, true);
      expect(prisma.survey.update).toHaveBeenCalled();
    });
  });

  describe("Sad Path", () => {
    test(
      "should reject publishing survey with incomplete translations",
      async () => {
        // Create a draft with missing translations
        const incompleteSurvey = {
          ...updateSurveyInput,
          questions: [
            {
              id: "q1",
              type: TSurveyQuestionTypeEnum.OpenText,
              // Missing headline
            },
          ],
        } as unknown as TSurvey;

        // Expect validation error (skipValidation = false)
        await expect(updateSurveyInternal(incompleteSurvey, false)).rejects.toThrow();
      },
      SURVEY_SERVICE_TEST_TIMEOUT_MS
    );
  });
});
