import { Prisma } from "@prisma/client";

import { prismaMock } from "@formbricks/database/src/jestClient";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";

import {
  createSurvey,
  deleteSurvey,
  duplicateSurvey,
  getSurvey,
  getSurveys,
  getSurveysByActionClassId,
  getSurveysByAttributeClassId,
  getSyncSurveys,
  updateSurvey,
} from "../service";
import {
  createSurveyInput,
  mockActionClass,
  mockAttributeClass,
  mockDisplay,
  mockId,
  mockPerson,
  mockProduct,
  mockSurveyOutput,
  mockSurveyWithAttributesOutput,
  mockTransformedSurveyOutput,
  mockTransformedSurveyWithAttributesIdOutput,
  mockTransformedSurveyWithAttributesOutput,
  updateSurveyInput,
} from "./survey.mock";

// utility function to test input validation for all services
const testInputValidation = async (service: Function, ...args: any[]): Promise<void> => {
  it("it should throw a ValidationError if the inputs are invalid", async () => {
    await expect(service(...args)).rejects.toThrow(ValidationError);
  });
};

describe("Tests for getSurvey", () => {
  describe("Happy Path", () => {
    it("Returns a survey", async () => {
      prismaMock.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      const survey = await getSurvey(mockId);
      expect(survey).toEqual(mockTransformedSurveyOutput);
    });

    it("Returns null if survey is not found", async () => {
      prismaMock.survey.findUnique.mockResolvedValueOnce(null);
      const survey = await getSurvey(mockId);
      expect(survey).toBeNull();
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getSurvey, "123");

    it("should throw a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      prismaMock.survey.findUnique.mockRejectedValue(errToThrow);
      await expect(getSurvey(mockId)).rejects.toThrow(DatabaseError);
    });

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.survey.findUnique.mockRejectedValue(new Error(mockErrorMessage));
      await expect(getSurvey(mockId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSurveysByAttributeClassId", () => {
  describe("Happy Path", () => {
    it("Returns an array of surveys for a given attributeClassId", async () => {
      prismaMock.survey.findMany.mockResolvedValueOnce([mockSurveyOutput]);
      const surveys = await getSurveysByAttributeClassId(mockId);
      expect(surveys).toEqual([mockTransformedSurveyOutput]);
    });

    it("Returns an empty array if no surveys are found", async () => {
      prismaMock.survey.findMany.mockResolvedValueOnce([]);
      const surveys = await getSurveysByAttributeClassId(mockId);
      expect(surveys).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getSurveysByAttributeClassId, "123");

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.survey.findMany.mockRejectedValue(new Error(mockErrorMessage));
      await expect(getSurveysByAttributeClassId(mockId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSurveysByActionClassId", () => {
  describe("Happy Path", () => {
    it("Returns an array of surveys for a given actionClassId", async () => {
      prismaMock.survey.findMany.mockResolvedValueOnce([mockSurveyOutput]);
      const surveys = await getSurveysByActionClassId(mockId);
      expect(surveys).toEqual([mockTransformedSurveyOutput]);
    });

    it("Returns an empty array if no surveys are found", async () => {
      prismaMock.survey.findMany.mockResolvedValueOnce([]);
      const surveys = await getSurveysByActionClassId(mockId);
      expect(surveys).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getSurveysByActionClassId, "123");

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.survey.findMany.mockRejectedValue(new Error(mockErrorMessage));
      await expect(getSurveysByActionClassId(mockId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSurveys", () => {
  describe("Happy Path", () => {
    it("Returns an array of surveys for a given environmentId and page", async () => {
      prismaMock.survey.findMany.mockResolvedValueOnce([mockSurveyOutput]);
      const surveys = await getSurveys(mockId);
      expect(surveys).toEqual([mockTransformedSurveyOutput]);
    });

    it("Returns an empty array if no surveys are found", async () => {
      prismaMock.survey.findMany.mockResolvedValueOnce([]);

      const surveys = await getSurveys(mockId);
      expect(surveys).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getSurveysByActionClassId, "123");

    it("should throw a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.survey.findMany.mockRejectedValue(errToThrow);
      await expect(getSurveys(mockId)).rejects.toThrow(DatabaseError);
    });

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.survey.findMany.mockRejectedValue(new Error(mockErrorMessage));
      await expect(getSurveys(mockId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for updateSurvey", () => {
  beforeEach(() => {
    prismaMock.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);
  });
  describe("Happy Path", () => {
    it("Updates a survey successfully", async () => {
      prismaMock.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      prismaMock.survey.update.mockResolvedValueOnce(mockSurveyOutput);
      const updatedSurvey = await updateSurvey(updateSurveyInput);
      expect(updatedSurvey).toEqual(mockTransformedSurveyWithAttributesOutput);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(updateSurvey, "123");

    it("Throws ResourceNotFoundError if the survey does not exist", async () => {
      prismaMock.survey.findUnique.mockRejectedValueOnce(
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
      prismaMock.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      prismaMock.survey.update.mockRejectedValue(errToThrow);
      await expect(updateSurvey(updateSurveyInput)).rejects.toThrow(DatabaseError);
    });

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      prismaMock.survey.update.mockRejectedValue(new Error(mockErrorMessage));
      await expect(updateSurvey(updateSurveyInput)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for deleteSurvey", () => {
  describe("Happy Path", () => {
    it("Deletes a survey successfully", async () => {
      prismaMock.survey.delete.mockResolvedValueOnce(mockSurveyWithAttributesOutput);
      const deletedSurvey = await deleteSurvey(mockId);
      expect(deletedSurvey).toEqual(mockSurveyWithAttributesOutput);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(deleteSurvey, "123");

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.survey.findUnique.mockResolvedValueOnce(mockSurveyOutput);
      prismaMock.survey.delete.mockRejectedValue(new Error(mockErrorMessage));
      await expect(deleteSurvey(mockId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for createSurvey", () => {
  beforeEach(() => {
    prismaMock.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);
  });

  describe("Happy Path", () => {
    it("Creates a survey successfully", async () => {
      prismaMock.survey.create.mockResolvedValueOnce(mockSurveyWithAttributesOutput);
      const createdSurvey = await createSurvey(mockId, createSurveyInput);
      expect(createdSurvey).toEqual(mockTransformedSurveyWithAttributesIdOutput);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(createSurvey, "123", createSurveyInput);

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.survey.delete.mockRejectedValue(new Error(mockErrorMessage));
      await expect(createSurvey(mockId, createSurveyInput)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for duplicateSurvey", () => {
  beforeEach(() => {
    prismaMock.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);
  });

  describe("Happy Path", () => {
    it("Duplicates a survey successfully", async () => {
      prismaMock.survey.findUnique.mockResolvedValueOnce(mockSurveyWithAttributesOutput);
      prismaMock.survey.create.mockResolvedValueOnce(mockSurveyWithAttributesOutput);
      const createdSurvey = await duplicateSurvey(mockId, mockId);
      expect(createdSurvey).toEqual(mockSurveyWithAttributesOutput);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(duplicateSurvey, "123", "123");

    it("Throws ResourceNotFoundError if the survey does not exist", async () => {
      prismaMock.survey.findUnique.mockRejectedValueOnce(new ResourceNotFoundError("Survey", mockId));
      await expect(duplicateSurvey(mockId, mockId)).rejects.toThrow(ResourceNotFoundError);
    });

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.survey.create.mockRejectedValue(new Error(mockErrorMessage));
      await expect(duplicateSurvey(mockId, mockId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSyncedSurveys", () => {
  describe("Happy Path", () => {
    beforeEach(() => {
      prismaMock.product.findFirst.mockResolvedValueOnce(mockProduct);
      prismaMock.display.findMany.mockResolvedValueOnce([mockDisplay]);
      prismaMock.attributeClass.findMany.mockResolvedValueOnce([mockAttributeClass]);
    });

    it("Returns synced surveys", async () => {
      prismaMock.survey.findMany.mockResolvedValueOnce([mockSurveyOutput]);
      const surveys = await getSyncSurveys(mockId, mockPerson);
      expect(surveys).toEqual([mockTransformedSurveyOutput]);
    });

    it("Returns an empty array if no surveys are found", async () => {
      prismaMock.survey.findMany.mockResolvedValueOnce([]);
      const surveys = await getSyncSurveys(mockId, mockPerson);
      expect(surveys).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getSyncSurveys, "123", {});

    it("does not find a Product", async () => {
      prismaMock.product.findFirst.mockResolvedValueOnce(null);

      await expect(getSyncSurveys(mockId, mockPerson)).rejects.toThrow(Error);
    });

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);
      prismaMock.survey.create.mockRejectedValue(new Error(mockErrorMessage));
      await expect(getSyncSurveys(mockId, mockPerson)).rejects.toThrow(Error);
    });
  });
});
