import { prisma } from "../../__mocks__/database";
import { mockResponseNote, mockResponseWithMockPerson } from "../../response/tests/__mocks__/data.mock";
import { Prisma } from "@prisma/client";
import { evaluateLogic } from "surveyLogic/utils";
import { beforeEach, describe, expect, it } from "vitest";
import { testInputValidation } from "vitestSetup";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  copySurveyToOtherEnvironment,
  createSurvey,
  deleteSurvey,
  getSurvey,
  getSurveyCount,
  getSurveys,
  getSurveysByActionClassId,
  getSyncSurveys,
  updateSurvey,
} from "../service";
import {
  createSurveyInput,
  mockActionClass,
  mockAttributeClass,
  mockDisplay,
  mockEnvironment,
  mockId,
  mockOrganizationOutput,
  mockPrismaPerson,
  mockProduct,
  mockSurveyOutput,
  mockSurveyWithLogic,
  mockSyncSurveyOutput,
  mockTransformedSurveyOutput,
  mockTransformedSyncSurveyOutput,
  mockUser,
  updateSurveyInput,
} from "./__mock__/survey.mock";

beforeEach(() => {
  prisma.survey.count.mockResolvedValue(1);
});

describe("evaluateLogic with mockSurveyWithLogic", () => {
  it("should return true when q1 answer is blue", () => {
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

  it("should return false when q1 answer is not blue", () => {
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

  it("should return true when q1 is blue and q2 is pizza", () => {
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

  it("should return false when q1 is blue but q2 is not pizza", () => {
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

  it("should return true when q2 is pizza or q3 is Inception", () => {
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

  it("should return true when var1 is equal to single select question value", () => {
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

  it("should return false when var1 is not equal to single select question value", () => {
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

  it("should return true when var2 is greater than 30 and less than open text number value", () => {
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

  it("should return false when var2 is not greater than 30 or greater than open text number value", () => {
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

  it("should return for complex condition", () => {
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
    it("Returns a survey", async () => {
      prisma.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      const survey = await getSurvey(mockId);
      expect(survey).toEqual(mockTransformedSurveyOutput);
    });

    it("Returns null if survey is not found", async () => {
      prisma.survey.findUnique.mockResolvedValueOnce(null);
      const survey = await getSurvey(mockId);
      expect(survey).toBeNull();
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getSurvey, "123#");

    it("should throw a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      prisma.survey.findUnique.mockRejectedValue(errToThrow);
      await expect(getSurvey(mockId)).rejects.toThrow(DatabaseError);
    });

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.survey.findUnique.mockRejectedValue(new Error(mockErrorMessage));
      await expect(getSurvey(mockId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSurveysByActionClassId", () => {
  describe("Happy Path", () => {
    it("Returns an array of surveys for a given actionClassId", async () => {
      prisma.survey.findMany.mockResolvedValueOnce([mockSurveyOutput]);
      const surveys = await getSurveysByActionClassId(mockId);
      expect(surveys).toEqual([mockTransformedSurveyOutput]);
    });

    it("Returns an empty array if no surveys are found", async () => {
      prisma.survey.findMany.mockResolvedValueOnce([]);
      const surveys = await getSurveysByActionClassId(mockId);
      expect(surveys).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getSurveysByActionClassId, "123#");

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prisma.survey.findMany.mockRejectedValue(new Error(mockErrorMessage));
      await expect(getSurveysByActionClassId(mockId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSurveys", () => {
  describe("Happy Path", () => {
    it("Returns an array of surveys for a given environmentId, limit(optional) and offset(optional)", async () => {
      prisma.survey.findMany.mockResolvedValueOnce([mockSurveyOutput]);
      const surveys = await getSurveys(mockId);
      expect(surveys).toEqual([mockTransformedSurveyOutput]);
    });

    it("Returns an empty array if no surveys are found", async () => {
      prisma.survey.findMany.mockResolvedValueOnce([]);

      const surveys = await getSurveys(mockId);
      expect(surveys).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getSurveysByActionClassId, "123#");

    it("should throw a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prisma.survey.findMany.mockRejectedValue(errToThrow);
      await expect(getSurveys(mockId)).rejects.toThrow(DatabaseError);
    });

    it("should throw an error if there is an unknown error", async () => {
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
  describe("Happy Path", () => {
    it("Updates a survey successfully", async () => {
      prisma.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      prisma.survey.update.mockResolvedValueOnce(mockSurveyOutput);
      const updatedSurvey = await updateSurvey(updateSurveyInput);
      expect(updatedSurvey).toEqual(mockTransformedSurveyOutput);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(updateSurvey, "123#");

    it("Throws ResourceNotFoundError if the survey does not exist", async () => {
      prisma.survey.findUnique.mockRejectedValueOnce(
        new ResourceNotFoundError("Survey", updateSurveyInput.id)
      );
      await expect(updateSurvey(updateSurveyInput)).rejects.toThrow(ResourceNotFoundError);
    });

    it("should throw a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      prisma.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      prisma.survey.update.mockRejectedValue(errToThrow);
      await expect(updateSurvey(updateSurveyInput)).rejects.toThrow(DatabaseError);
    });

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prisma.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      prisma.survey.update.mockRejectedValue(new Error(mockErrorMessage));
      await expect(updateSurvey(updateSurveyInput)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for deleteSurvey", () => {
  describe("Happy Path", () => {
    it("Deletes a survey successfully", async () => {
      prisma.survey.delete.mockResolvedValueOnce(mockSurveyOutput);
      const deletedSurvey = await deleteSurvey(mockId);
      expect(deletedSurvey).toEqual(mockSurveyOutput);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(deleteSurvey, "123#");

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prisma.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      prisma.survey.delete.mockRejectedValue(new Error(mockErrorMessage));
      await expect(deleteSurvey(mockId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for createSurvey", () => {
  beforeEach(() => {
    prisma.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);
  });

  describe("Happy Path", () => {
    it("Creates a survey successfully", async () => {
      prisma.survey.create.mockResolvedValueOnce(mockSurveyOutput);
      prisma.organization.findFirst.mockResolvedValueOnce(mockOrganizationOutput);
      prisma.actionClass.findMany.mockResolvedValue([mockActionClass]);
      prisma.user.findMany.mockResolvedValueOnce([
        {
          ...mockUser,
          twoFactorSecret: null,
          backupCodes: null,
          password: null,
          identityProviderAccountId: null,
          groupId: null,
          role: "engineer",
        },
      ]);
      prisma.user.update.mockResolvedValueOnce({
        ...mockUser,
        twoFactorSecret: null,
        backupCodes: null,
        password: null,
        identityProviderAccountId: null,
        groupId: null,
        role: "engineer",
      });
      const createdSurvey = await createSurvey(mockId, createSurveyInput);
      expect(createdSurvey).toEqual(mockTransformedSurveyOutput);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(createSurvey, "123#", createSurveyInput);

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prisma.survey.delete.mockRejectedValue(new Error(mockErrorMessage));
      await expect(createSurvey(mockId, createSurveyInput)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for duplicateSurvey", () => {
  beforeEach(() => {
    prisma.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);
  });

  describe("Happy Path", () => {
    it("Duplicates a survey successfully", async () => {
      prisma.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      prisma.survey.create.mockResolvedValueOnce(mockSurveyOutput);
      // @ts-expect-error
      prisma.environment.findUnique.mockResolvedValueOnce(mockEnvironment);
      // @ts-expect-error
      prisma.product.findFirst.mockResolvedValueOnce(mockProduct);
      prisma.actionClass.findFirst.mockResolvedValueOnce(mockActionClass);
      prisma.actionClass.create.mockResolvedValueOnce(mockActionClass);

      const createdSurvey = await copySurveyToOtherEnvironment(mockId, mockId, mockId, mockId);
      expect(createdSurvey).toEqual(mockSurveyOutput);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(copySurveyToOtherEnvironment, "123#", "123#", "123#", "123#", "123#");

    it("Throws ResourceNotFoundError if the survey does not exist", async () => {
      prisma.survey.findUnique.mockRejectedValueOnce(new ResourceNotFoundError("Survey", mockId));
      await expect(copySurveyToOtherEnvironment(mockId, mockId, mockId, mockId)).rejects.toThrow(
        ResourceNotFoundError
      );
    });

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prisma.survey.create.mockRejectedValue(new Error(mockErrorMessage));
      await expect(copySurveyToOtherEnvironment(mockId, mockId, mockId, mockId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSyncSurveys", () => {
  describe("Happy Path", () => {
    beforeEach(() => {
      prisma.product.findFirst.mockResolvedValueOnce({
        ...mockProduct,
        brandColor: null,
        highlightBorderColor: null,
        logo: null,
      });
      prisma.display.findMany.mockResolvedValueOnce([mockDisplay]);
      prisma.attributeClass.findMany.mockResolvedValueOnce([mockAttributeClass]);
    });

    it("Returns synced surveys", async () => {
      prisma.survey.findMany.mockResolvedValueOnce([mockSyncSurveyOutput]);
      prisma.person.findUnique.mockResolvedValueOnce(mockPrismaPerson);
      prisma.response.findMany.mockResolvedValue([mockResponseWithMockPerson]);
      prisma.responseNote.findMany.mockResolvedValue([mockResponseNote]);

      const surveys = await getSyncSurveys(mockId, mockPrismaPerson.id, "desktop", {
        version: "1.7.0",
      });
      expect(surveys).toEqual([mockTransformedSyncSurveyOutput]);
    });

    it("Returns an empty array if no surveys are found", async () => {
      prisma.survey.findMany.mockResolvedValueOnce([]);
      prisma.person.findUnique.mockResolvedValueOnce(mockPrismaPerson);
      const surveys = await getSyncSurveys(mockId, mockPrismaPerson.id, "desktop", {
        version: "1.7.0",
      });
      expect(surveys).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getSyncSurveys, "123#", {});

    it("does not find a Product", async () => {
      prisma.product.findFirst.mockResolvedValueOnce(null);

      await expect(
        getSyncSurveys(mockId, mockPrismaPerson.id, "desktop", { version: "1.7.0" })
      ).rejects.toThrow(Error);
    });

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prisma.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);
      prisma.survey.create.mockRejectedValue(new Error(mockErrorMessage));
      await expect(
        getSyncSurveys(mockId, mockPrismaPerson.id, "desktop", { version: "1.7.0" })
      ).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSurveyCount service", () => {
  describe("Happy Path", () => {
    it("Counts the total number of surveys for a given environment ID", async () => {
      const count = await getSurveyCount(mockId);
      expect(count).toEqual(1);
    });

    it("Returns zero count when there are no surveys for a given environment ID", async () => {
      prisma.survey.count.mockResolvedValue(0);
      const count = await getSurveyCount(mockId);
      expect(count).toEqual(0);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getSurveyCount, "123#");

    it("Throws a generic Error for other unexpected issues", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.survey.count.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getSurveyCount(mockId)).rejects.toThrow(Error);
    });
  });
});
