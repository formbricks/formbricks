import { Prisma } from "@prisma/client";

import { prismaMock } from "@formbricks/database/src/jestClient";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";

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
  mockActionClass,
  mockAttributeClass,
  mockAttributeClassId,
  mockCreateDisplay,
  mockCreateSurveyInput,
  mockEnvironmentId,
  mockPerson,
  mockProduct,
  mockSurveyId,
  mockSurveyToBeUpdated,
  surveyMockOutput,
  surveyMockOutputTransformed,
} from "./survey.mock";

describe("Tests for getSurvey", () => {
  describe("Happy Path", () => {
    it("Returns a survey", async () => {
      prismaMock.survey.findUnique.mockResolvedValueOnce(surveyMockOutput);

      const survey = await getSurvey(mockSurveyId);
      expect(survey).toEqual(surveyMockOutputTransformed);
    });

    it("Returns null if survey is not found", async () => {
      prismaMock.survey.findUnique.mockResolvedValueOnce(null);

      const survey = await getSurvey(mockSurveyId);
      expect(survey).toBeNull();
    });
  });

  describe("Sad Path", () => {
    it("should throw a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.survey.findUnique.mockRejectedValue(errToThrow);
      await expect(getSurvey(mockSurveyId)).rejects.toThrow(DatabaseError);
    });

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.survey.findUnique.mockRejectedValue(new Error(mockErrorMessage));
      await expect(getSurvey(mockSurveyId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSurveysByAttributeClassId", () => {
  describe("Happy Path", () => {
    it("Returns an array of surveys for a given attributeClassId", async () => {
      prismaMock.survey.findMany.mockResolvedValueOnce([surveyMockOutput]);

      const surveys = await getSurveysByAttributeClassId(mockAttributeClassId);
      expect(surveys).toEqual([surveyMockOutputTransformed]);
    });

    it("Returns an empty array if no surveys are found", async () => {
      prismaMock.survey.findMany.mockResolvedValueOnce([]);

      const surveys = await getSurveysByAttributeClassId(mockAttributeClassId);
      expect(surveys).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.survey.findMany.mockRejectedValue(new Error(mockErrorMessage));
      await expect(getSurveysByAttributeClassId(mockAttributeClassId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSurveysByActionClassId", () => {
  describe("Happy Path", () => {
    it("Returns an array of surveys for a given actionClassId", async () => {
      prismaMock.survey.findMany.mockResolvedValueOnce([surveyMockOutput]);

      const surveys = await getSurveysByActionClassId(mockAttributeClassId);
      expect(surveys).toEqual([surveyMockOutputTransformed]);
    });

    it("Returns an empty array if no surveys are found", async () => {
      prismaMock.survey.findMany.mockResolvedValueOnce([]);

      const surveys = await getSurveysByActionClassId(mockAttributeClassId);
      expect(surveys).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.survey.findMany.mockRejectedValue(new Error(mockErrorMessage));
      await expect(getSurveysByActionClassId(mockAttributeClassId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSurveys", () => {
  describe("Happy Path", () => {
    it("Returns an array of surveys for a given environmentId and page", async () => {
      prismaMock.survey.findMany.mockResolvedValueOnce([surveyMockOutput]);

      const surveys = await getSurveys(mockEnvironmentId);
      expect(surveys).toEqual([surveyMockOutputTransformed]);
    });

    it("Returns an empty array if no surveys are found", async () => {
      prismaMock.survey.findMany.mockResolvedValueOnce([]);

      const surveys = await getSurveys(mockEnvironmentId);
      expect(surveys).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    it("should throw a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.survey.findMany.mockRejectedValue(errToThrow);
      await expect(getSurveys(mockEnvironmentId)).rejects.toThrow(DatabaseError);
    });

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.survey.findMany.mockRejectedValue(new Error(mockErrorMessage));
      await expect(getSurveys(mockEnvironmentId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for updateSurvey", () => {
  describe("Happy Path", () => {
    it("Updates a survey successfully", async () => {
      prismaMock.survey.findUnique.mockResolvedValueOnce(surveyMockOutput);
      prismaMock.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);
      prismaMock.survey.update.mockResolvedValueOnce(surveyMockOutput);

      const updatedSurvey = await updateSurvey(mockSurveyToBeUpdated);
      expect(updatedSurvey).toEqual(surveyMockOutputTransformed);
    });
  });

  describe("Sad Path", () => {
    it("Throws ResourceNotFoundError if the survey does not exist", async () => {
      prismaMock.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);

      prismaMock.survey.findUnique.mockRejectedValueOnce(
        new ResourceNotFoundError("Survey", mockSurveyToBeUpdated.id)
      );
      await expect(updateSurvey(mockSurveyToBeUpdated)).rejects.toThrow(ResourceNotFoundError);
    });

    it("should throw a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.survey.findUnique.mockResolvedValueOnce(surveyMockOutput);
      prismaMock.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);
      prismaMock.survey.update.mockRejectedValue(errToThrow);
      await expect(updateSurvey(mockSurveyToBeUpdated)).rejects.toThrow(DatabaseError);
    });

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.survey.findUnique.mockResolvedValueOnce(surveyMockOutput);
      prismaMock.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);

      prismaMock.survey.update.mockRejectedValue(new Error(mockErrorMessage));
      await expect(updateSurvey(mockSurveyToBeUpdated)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for deleteSurvey", () => {
  describe("Happy Path", () => {
    it("Deletes a survey successfully", async () => {
      prismaMock.survey.delete.mockResolvedValueOnce(surveyMockOutput);

      const deletedSurvey = await deleteSurvey(mockSurveyId);
      expect(deletedSurvey).toEqual(surveyMockOutput);
    });
  });

  describe("Sad Path", () => {
    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.survey.findUnique.mockResolvedValueOnce(surveyMockOutput);
      prismaMock.survey.delete.mockRejectedValue(new Error(mockErrorMessage));
      await expect(deleteSurvey(mockSurveyId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for createSurvey", () => {
  describe("Happy Path", () => {
    it("Creates a survey successfully", async () => {
      prismaMock.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);
      prismaMock.survey.create.mockResolvedValueOnce(surveyMockOutput);

      const createdSurvey = await createSurvey(mockEnvironmentId, mockCreateSurveyInput);
      expect(createdSurvey).toEqual(surveyMockOutputTransformed);
    });
  });
  describe("Sad Path", () => {
    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);

      prismaMock.survey.delete.mockRejectedValue(new Error(mockErrorMessage));
      await expect(createSurvey(mockEnvironmentId, mockCreateSurveyInput)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for duplicateSurvey", () => {
  describe("Happy Path", () => {
    it("Duplicates a survey successfully", async () => {
      prismaMock.survey.findUnique.mockResolvedValueOnce(surveyMockOutput);
      prismaMock.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);
      prismaMock.survey.create.mockResolvedValueOnce(surveyMockOutput);

      const createdSurvey = await duplicateSurvey(mockEnvironmentId, mockSurveyId);
      expect(createdSurvey).toEqual(surveyMockOutput);
    });
  });
  describe("Sad Path", () => {
    it("Throws ResourceNotFoundError if the survey does not exist", async () => {
      prismaMock.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);
      prismaMock.survey.findUnique.mockRejectedValueOnce(
        new ResourceNotFoundError("Survey", mockSurveyToBeUpdated.id)
      );

      await expect(duplicateSurvey(mockEnvironmentId, mockSurveyId)).rejects.toThrow(ResourceNotFoundError);
    });

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);
      prismaMock.survey.create.mockRejectedValue(new Error(mockErrorMessage));
      await expect(duplicateSurvey(mockEnvironmentId, mockSurveyId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSyncedSurveys", () => {
  describe("Happy Path", () => {
    it("Returns synced surveys", async () => {
      prismaMock.product.findFirst.mockResolvedValueOnce(mockProduct);
      prismaMock.survey.findMany.mockResolvedValueOnce([surveyMockOutput]);
      prismaMock.display.findMany.mockResolvedValueOnce([mockCreateDisplay]);
      prismaMock.attributeClass.findMany.mockResolvedValueOnce([mockAttributeClass]);

      const surveys = await getSyncSurveys(mockEnvironmentId, mockPerson);
      expect(surveys).toEqual([surveyMockOutputTransformed]);
    });

    it("Returns an empty array if no surveys are found", async () => {
      prismaMock.product.findFirst.mockResolvedValueOnce(mockProduct);
      prismaMock.survey.findMany.mockResolvedValueOnce([]);
      prismaMock.display.findMany.mockResolvedValueOnce([mockCreateDisplay]);
      prismaMock.attributeClass.findMany.mockResolvedValueOnce([mockAttributeClass]);

      const surveys = await getSyncSurveys(mockEnvironmentId, mockPerson);
      expect(surveys).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    it("does not find a Product", async () => {
      prismaMock.product.findFirst.mockResolvedValueOnce(null);

      await expect(getSyncSurveys(mockEnvironmentId, mockPerson)).rejects.toThrow(Error);
    });

    it("should throw an error if there is an unknown error", async () => {
      const mockErrorMessage = "Unknown error occurred";
      prismaMock.actionClass.findMany.mockResolvedValueOnce([mockActionClass]);
      prismaMock.survey.create.mockRejectedValue(new Error(mockErrorMessage));
      await expect(getSyncSurveys(mockEnvironmentId, mockPerson)).rejects.toThrow(Error);
    });
  });
});
