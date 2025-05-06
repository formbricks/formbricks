import { prisma } from "@/lib/__mocks__/database";
import { segmentCache } from "@/lib/cache/segment";
import { surveyCache } from "@/lib/survey/cache";
import { evaluateLogic } from "@/lib/surveyLogic/utils";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { testInputValidation } from "vitestSetup";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
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

vi.mock("./cache", () => ({
  surveyCache: {
    revalidate: vi.fn(),
    tag: {
      byId: vi.fn().mockImplementation((id) => `survey-${id}`),
      byEnvironmentId: vi.fn().mockImplementation((id) => `survey-env-${id}`),
      byActionClassId: vi.fn().mockImplementation((id) => `survey-action-${id}`),
      bySegmentId: vi.fn().mockImplementation((id) => `survey-segment-${id}`),
      byResultShareKey: vi.fn().mockImplementation((key) => `survey-share-${key}`),
    },
  },
}));

vi.mock("@/lib/cache/segment", () => ({
  segmentCache: {
    revalidate: vi.fn(),
    tag: {
      byId: vi.fn().mockImplementation((id) => `segment-${id}`),
      byEnvironmentId: vi.fn().mockImplementation((id) => `segment-env-${id}`),
    },
  },
}));

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
  vi.clearAllMocks();
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
    prisma.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);
  });

  // describe("Happy Path", () => {
  // test("Updates a survey successfully", async () => {
  //   prisma.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
  //   prisma.organization.findFirst.mockResolvedValueOnce(mockOrganizationOutput);
  //   prisma.survey.update.mockResolvedValueOnce(mockSurveyOutput);
  //   const updatedSurvey = await updateSurvey(updateSurveyInput);
  //   expect(updatedSurvey).toEqual(mockTransformedSurveyOutput);
  // });
  // });

  describe("Sad Path", () => {
    testInputValidation(updateSurvey, "123#");

    test("Throws ResourceNotFoundError if the survey does not exist", async () => {
      prisma.survey.findUnique.mockRejectedValueOnce(
        new ResourceNotFoundError("Survey", updateSurveyInput.id)
      );
      await expect(updateSurvey(updateSurveyInput)).rejects.toThrow(ResourceNotFoundError);
    });

    // test("should throw a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
    //   const mockErrorMessage = "Mock error message";
    //   const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
    //     code: PrismaErrorType.UniqueConstraintViolation,
    //     clientVersion: "0.0.1",
    //   });
    //   prisma.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
    //   prisma.organization.findFirst.mockResolvedValueOnce(mockOrganizationOutput);
    //   prisma.survey.update.mockRejectedValue(errToThrow);
    //   await expect(updateSurvey(updateSurveyInput)).rejects.toThrow(DatabaseError);
    // });

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
    ];
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
    ];

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
    ];
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
    ];

    const result = handleTriggerUpdates(updatedTriggers, currentTriggers, mockActionClasses);

    expect(result).toHaveProperty("create");
    expect(result).toHaveProperty("deleteMany");
    expect(result.create).toEqual([{ actionClassId: mockActionClassId2 }]);
    expect(result.deleteMany).toEqual({ actionClassId: { in: [mockActionClassId1] } });
    expect(surveyCache.revalidate).toHaveBeenCalledTimes(2);
  });

  test("returns empty object when no triggers provided", () => {
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
    ];
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
    ];
    const currentTriggers = [];

    expect(() => handleTriggerUpdates(updatedTriggers, currentTriggers, mockActionClasses)).toThrow(
      InvalidInputError
    );
  });
});

// describe("Tests for createSurvey", () => {
//   const mockEnvironmentId = "env-123";
//   const mockUserId = "user-123";

//   const mockCreateSurveyInput = {
//     name: "Test Survey",
//     type: "app",
//     createdBy: mockUserId,
//     status: "inProgress",
//     welcomeCard: {
//       enabled: true,
//       headline: "Welcome",
//       html: "<p>Welcome to our survey</p>",
//     },
//     questions: [],
//     endings: [],
//     displayOption: "respondMultiple",
//     languages: [],
//   };

//   const mockActionClasses = [
//     {
//       id: "action-123",
//       createdAt: new Date(),
//       updatedAt: new Date(),
//       environmentId: mockEnvironmentId,
//       name: "Test Action",
//       description: "Test action description",
//       type: "code",
//       key: "test-action",
//       noCodeConfig: null,
//     },
//   ];

//   beforeEach(() => {
//     vi.mocked(require("@/lib/actionClass/service").getActionClasses).mockResolvedValue(mockActionClasses);
//   });

//   describe("Happy Path", () => {
//     test("creates a survey successfully", async () => {
//       prisma.survey.create.mockResolvedValueOnce({
//         ...mockSurveyOutput,
//         triggers: [],
//         segment: null,
//       });

//       const result = await createSurvey(mockEnvironmentId, mockCreateSurveyInput);

//       expect(prisma.survey.create).toHaveBeenCalled();
//       expect(result).toEqual(
//         expect.objectContaining({
//           id: mockSurveyOutput.id,
//           name: mockCreateSurveyInput.name,
//         })
//       );
//       expect(
//         require("@/lib/organization/service").subscribeOrganizationMembersToSurveyResponses
//       ).toHaveBeenCalled();
//       expect(require("@/lib/posthogServer").capturePosthogEnvironmentEvent).toHaveBeenCalled();
//     });

//     test("creates a private segment for app surveys", async () => {
//       prisma.survey.create.mockResolvedValueOnce({
//         ...mockSurveyOutput,
//         type: "app",
//         triggers: [],
//         segment: null,
//       });

//       prisma.segment.create.mockResolvedValueOnce({
//         id: "segment-123",
//         environmentId: mockEnvironmentId,
//         title: mockSurveyOutput.id,
//         isPrivate: true,
//         filters: [],
//         createdAt: new Date(),
//         updatedAt: new Date(),
//       });

//       await createSurvey(mockEnvironmentId, {
//         ...mockCreateSurveyInput,
//         type: "app",
//       });

//       expect(prisma.segment.create).toHaveBeenCalled();
//       expect(prisma.survey.update).toHaveBeenCalled();
//       expect(segmentCache.revalidate).toHaveBeenCalled();
//     });

//     test("creates survey with follow-ups", async () => {
//       const surveyWithFollowUps = {
//         ...mockCreateSurveyInput,
//         followUps: [
//           {
//             id: "followup-1",
//             name: "Follow up 1",
//             trigger: { type: "responseNew" },
//             action: { type: "email", email: { to: "test@example.com" } },
//             deleted: false,
//           },
//         ],
//       };

//       prisma.survey.create.mockResolvedValueOnce({
//         ...mockSurveyOutput,
//         triggers: [],
//         segment: null,
//         followUps: [
//           {
//             id: "followup-1",
//             name: "Follow up 1",
//             trigger: { type: "responseNew" },
//             action: { type: "email", email: { to: "test@example.com" } },
//           },
//         ],
//       });

//       await createSurvey(mockEnvironmentId, surveyWithFollowUps);

//       expect(prisma.survey.create).toHaveBeenCalledWith(
//         expect.objectContaining({
//           data: expect.objectContaining({
//             followUps: {
//               create: [
//                 expect.objectContaining({
//                   name: "Follow up 1",
//                 }),
//               ],
//             },
//           }),
//         })
//       );
//     });
//   });

//   describe("Sad Path", () => {
//     testInputValidation(createSurvey, "123#", mockCreateSurveyInput);

//     test("throws ResourceNotFoundError if organization not found", async () => {
//       vi.mocked(require("@/lib/organization/service").getOrganizationByEnvironmentId).mockResolvedValueOnce(
//         null
//       );

//       await expect(createSurvey(mockEnvironmentId, mockCreateSurveyInput)).rejects.toThrow(
//         ResourceNotFoundError
//       );
//     });

//     test("throws DatabaseError if there is a Prisma error", async () => {
//       const mockError = new Prisma.PrismaClientKnownRequestError("Database error", {
//         code: PrismaErrorType.UniqueConstraintViolation,
//         clientVersion: "1.0.0",
//       });
//       prisma.survey.create.mockRejectedValueOnce(mockError);

//       await expect(createSurvey(mockEnvironmentId, mockCreateSurveyInput)).rejects.toThrow(DatabaseError);
//     });
//   });
// });

describe("Tests for getSurveyIdByResultShareKey", () => {
  const mockResultShareKey = "share-key-123";

  describe("Happy Path", () => {
    test("returns survey ID when found", async () => {
      prisma.survey.findFirst.mockResolvedValueOnce({
        id: mockId,
      });

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
  const mockSurveyId = "survey-123";
  const mockNewSegmentId = "segment-456";
  const mockCurrentSegmentId = "segment-123";
  const mockEnvironmentId = "env-123";

  // describe("Happy Path", () => {
  // test("loads new segment successfully", async () => {
  //   // Set up mocks for existing survey
  //   prisma.survey.findUnique.mockResolvedValueOnce({
  //     ...mockSurveyOutput,
  //     segment: null,
  //     triggers: [],
  //   });
  //   // Mock segment exists
  //   prisma.segment.findUnique.mockResolvedValueOnce({
  //     id: mockNewSegmentId,
  //     environmentId: mockEnvironmentId,
  //   });
  //   // Mock survey update
  //   prisma.survey.update.mockResolvedValueOnce({
  //     ...mockSurveyOutput,
  //     segment: {
  //       id: mockNewSegmentId,
  //       environmentId: mockEnvironmentId,
  //       title: "Test Segment",
  //       isPrivate: false,
  //       filters: [],
  //       surveys: [{ id: mockSurveyId }],
  //     },
  //     triggers: [],
  //   });
  //   const result = await loadNewSegmentInSurvey(mockSurveyId, mockNewSegmentId);
  //   expect(prisma.survey.update).toHaveBeenCalledWith({
  //     where: { id: mockSurveyId },
  //     data: {
  //       segment: {
  //         connect: {
  //           id: mockNewSegmentId,
  //         },
  //       },
  //     },
  //     select: expect.anything(),
  //   });
  //   expect(result).toEqual(
  //     expect.objectContaining({
  //       segment: expect.objectContaining({
  //         id: mockNewSegmentId,
  //       }),
  //     })
  //   );
  //   expect(surveyCache.revalidate).toHaveBeenCalledWith({ id: mockSurveyId });
  //   expect(segmentCache.revalidate).toHaveBeenCalledWith({ id: mockNewSegmentId });
  // });
  // test("deletes private segment when changing to a new segment", async () => {
  //   // Set up mocks for existing survey with private segment
  //   prisma.survey.findUnique.mockResolvedValueOnce({
  //     ...mockSurveyOutput,
  //     segment: {
  //       id: mockCurrentSegmentId,
  //       environmentId: mockEnvironmentId,
  //       title: mockSurveyId, // Private segments have title = surveyId
  //       isPrivate: true,
  //       filters: [],
  //       surveys: [{ id: mockSurveyId }],
  //     },
  //     triggers: [],
  //   });
  //   // Mock segment exists
  //   prisma.segment.findUnique.mockResolvedValueOnce({
  //     id: mockNewSegmentId,
  //     environmentId: mockEnvironmentId,
  //   });
  //   // Mock survey update
  //   prisma.survey.update.mockResolvedValueOnce({
  //     ...mockSurveyOutput,
  //     segment: {
  //       id: mockNewSegmentId,
  //       environmentId: mockEnvironmentId,
  //       title: "Test Segment",
  //       isPrivate: false,
  //       filters: [],
  //       surveys: [{ id: mockSurveyId }],
  //     },
  //     triggers: [],
  //   });
  //   // Mock segment delete
  //   prisma.segment.delete.mockResolvedValueOnce({
  //     id: mockCurrentSegmentId,
  //     environmentId: mockEnvironmentId,
  //     surveys: [{ id: mockSurveyId }],
  //   });
  //   await loadNewSegmentInSurvey(mockSurveyId, mockNewSegmentId);
  //   // Verify the private segment was deleted
  //   expect(prisma.segment.delete).toHaveBeenCalledWith({
  //     where: { id: mockCurrentSegmentId },
  //     select: expect.anything(),
  //   });
  //   // Verify the cache was invalidated
  //   expect(segmentCache.revalidate).toHaveBeenCalledWith({ id: mockCurrentSegmentId });
  // });
  // });

  describe("Sad Path", () => {
    testInputValidation(loadNewSegmentInSurvey, "123#", "123#");

    // test("throws ResourceNotFoundError when survey not found", async () => {
    //   prisma.survey.findUnique.mockResolvedValueOnce(null);

    //   await expect(loadNewSegmentInSurvey(mockSurveyId, mockNewSegmentId)).rejects.toThrow(
    //     ResourceNotFoundError
    //   );
    // });

    // test("throws ResourceNotFoundError when segment not found", async () => {
    //   // Set up mock for existing survey
    //   prisma.survey.findUnique.mockResolvedValueOnce({
    //     ...mockSurveyOutput,
    //     segment: null,
    //     triggers: [],
    //   });

    //   // Segment not found
    //   prisma.segment.findUnique.mockResolvedValueOnce(null);

    //   await expect(loadNewSegmentInSurvey(mockSurveyId, mockNewSegmentId)).rejects.toThrow(
    //     ResourceNotFoundError
    //   );
    // });

    // test("throws DatabaseError on Prisma error", async () => {
    //   // Set up mock for existing survey
    //   prisma.survey.findUnique.mockResolvedValueOnce({
    //     ...mockSurveyOutput,
    //     segment: null,
    //     triggers: [],
    //   });

    //   // Mock segment exists
    //   prisma.segment.findUnique.mockResolvedValueOnce({
    //     id: mockNewSegmentId,
    //     environmentId: mockEnvironmentId,
    //   });

    //   // Mock Prisma error on update
    //   const mockError = new Prisma.PrismaClientKnownRequestError("Database error", {
    //     code: PrismaErrorType.UniqueConstraintViolation,
    //     clientVersion: "1.0.0",
    //   });

    //   prisma.survey.update.mockRejectedValueOnce(mockError);

    //   await expect(loadNewSegmentInSurvey(mockSurveyId, mockNewSegmentId)).rejects.toThrow(DatabaseError);
    // });
  });
});

describe("Tests for getSurveysBySegmentId", () => {
  const mockSegmentId = "segment-123";

  describe("Happy Path", () => {
    test("returns surveys associated with a segment", async () => {
      prisma.survey.findMany.mockResolvedValueOnce([
        {
          ...mockSurveyOutput,
          triggers: [],
          segment: null,
        },
      ]);

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
