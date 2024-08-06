import { prisma } from "../../__mocks__/database";
import { Prisma } from "@prisma/client";
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
  mockSyncSurveyOutput,
  mockTransformedSurveyOutput,
  mockTransformedSyncSurveyOutput,
  mockUser,
  updateSurveyInput,
} from "./__mock__/survey.mock";

beforeEach(() => {
  prisma.survey.count.mockResolvedValue(1);
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

      const createdSurvey = await copySurveyToOtherEnvironment(mockId, mockId, mockId, mockId, mockId);
      expect(createdSurvey).toEqual(mockSurveyOutput);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(copySurveyToOtherEnvironment, "123#", "123#", "123#", "123#", "123#");

    it("Throws ResourceNotFoundError if the survey does not exist", async () => {
      prisma.survey.findUnique.mockRejectedValueOnce(new ResourceNotFoundError("Survey", mockId));
      await expect(copySurveyToOtherEnvironment(mockId, mockId, mockId, mockId, mockId)).rejects.toThrow(
        ResourceNotFoundError
      );
    });

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prisma.survey.create.mockRejectedValue(new Error(mockErrorMessage));
      await expect(copySurveyToOtherEnvironment(mockId, mockId, mockId, mockId, mockId)).rejects.toThrow(
        Error
      );
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
