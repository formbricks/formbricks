import { prisma } from "../../__mocks__/database";
import {
  getMockUpdateResponseInput,
  mockContact,
  mockDisplay,
  mockEnvironmentId,
  mockResponse,
  mockResponseData,
  mockResponseNote,
  mockSingleUseId,
  mockSurveyId,
  mockSurveySummaryOutput,
  mockTags,
} from "./__mocks__/data.mock";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { testInputValidation } from "vitestSetup";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponse } from "@formbricks/types/responses";
import { TTag } from "@formbricks/types/tags";
import { getSurveySummary } from "../../../../apps/web/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/surveySummary";
import {
  mockContactAttributeKey,
  mockOrganizationOutput,
  mockSurveyOutput,
} from "../../survey/tests/__mock__/survey.mock";
import {
  deleteResponse,
  getResponse,
  getResponseBySingleUseId,
  getResponseCountBySurveyId,
  getResponseDownloadUrl,
  getResponsesByEnvironmentId,
  updateResponse,
} from "../service";

const expectedResponseWithoutPerson: TResponse = {
  ...mockResponse,
  contact: null,
  tags: mockTags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
};

beforeEach(() => {
  // @ts-expect-error
  prisma.response.create.mockImplementation(async (args) => {
    if (args.data.contact && args.data.contact.connect) {
      return {
        ...mockResponse,
        contact: mockContact,
      };
    }

    return mockResponse;
  });

  // mocking the person findFirst call as it is used in the transformPrismaPerson function
  prisma.contact.findFirst.mockResolvedValue(mockContact);
  prisma.responseNote.findMany.mockResolvedValue([mockResponseNote]);

  prisma.response.findUnique.mockResolvedValue(mockResponse);

  // @ts-expect-error
  prisma.response.update.mockImplementation(async (args) => {
    if (args.data.finished === true) {
      return {
        ...mockResponse,
        finished: true,
        data: mockResponseData,
      };
    }

    return {
      ...mockResponse,
      finished: false,
      data: mockResponseData,
    };
  });

  prisma.response.findMany.mockResolvedValue([mockResponse]);
  prisma.response.delete.mockResolvedValue(mockResponse);

  prisma.display.delete.mockResolvedValue({ ...mockDisplay, status: "seen" });

  prisma.response.count.mockResolvedValue(1);

  prisma.organization.findFirst.mockResolvedValue(mockOrganizationOutput);
  prisma.organization.findUnique.mockResolvedValue(mockOrganizationOutput);
  prisma.project.findMany.mockResolvedValue([]);
  // @ts-expect-error
  prisma.response.aggregate.mockResolvedValue({ _count: { id: 1 } });
});

describe("Tests for getResponsesBySingleUseId", () => {
  describe("Happy Path", () => {
    it("Retrieves responses linked to a specific single-use ID", async () => {
      const responses = await getResponseBySingleUseId(mockSurveyId, mockSingleUseId);
      expect(responses).toEqual(expectedResponseWithoutPerson);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getResponseBySingleUseId, "123#", "123#");

    it("Throws DatabaseError on PrismaClientKnownRequestError occurrence", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      prisma.response.findUnique.mockRejectedValue(errToThrow);

      await expect(getResponseBySingleUseId(mockSurveyId, mockSingleUseId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for other exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.response.findUnique.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getResponseBySingleUseId(mockSurveyId, mockSingleUseId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getResponse service", () => {
  describe("Happy Path", () => {
    it("Retrieves a specific response by its ID", async () => {
      const response = await getResponse(mockResponse.id);
      expect(response).toEqual(expectedResponseWithoutPerson);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getResponse, "123#");

    it("Throws ResourceNotFoundError if no response is found", async () => {
      prisma.response.findUnique.mockResolvedValue(null);
      const response = await getResponse(mockResponse.id);
      expect(response).toBeNull();
    });

    it("Throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      prisma.response.findUnique.mockRejectedValue(errToThrow);

      await expect(getResponse(mockResponse.id)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for other unexpected issues", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.response.findUnique.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getResponse(mockResponse.id)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getSurveySummary service", () => {
  describe("Happy Path", () => {
    it("Returns a summary of the survey responses", async () => {
      prisma.survey.findUnique.mockResolvedValue(mockSurveyOutput);
      prisma.response.findMany.mockResolvedValue([mockResponse]);
      prisma.contactAttributeKey.findMany.mockResolvedValueOnce([mockContactAttributeKey]);

      const summary = await getSurveySummary(mockSurveyId);
      expect(summary).toEqual(mockSurveySummaryOutput);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getSurveySummary, 1);

    it("Throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      prisma.survey.findUnique.mockResolvedValue(mockSurveyOutput);
      prisma.response.findMany.mockRejectedValue(errToThrow);
      prisma.contactAttributeKey.findMany.mockResolvedValueOnce([mockContactAttributeKey]);

      await expect(getSurveySummary(mockSurveyId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for unexpected problems", async () => {
      const mockErrorMessage = "Mock error message";

      prisma.survey.findUnique.mockResolvedValue(mockSurveyOutput);
      prisma.response.findMany.mockRejectedValue(new Error(mockErrorMessage));
      prisma.contactAttributeKey.findMany.mockResolvedValueOnce([mockContactAttributeKey]);

      await expect(getSurveySummary(mockSurveyId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getResponseDownloadUrl service", () => {
  describe("Happy Path", () => {
    it("Returns a download URL for the csv response file", async () => {
      prisma.survey.findUnique.mockResolvedValue(mockSurveyOutput);
      prisma.response.count.mockResolvedValue(1);
      prisma.response.findMany.mockResolvedValue([mockResponse]);

      const url = await getResponseDownloadUrl(mockSurveyId, "csv");
      const fileExtension = url.split(".").pop();
      expect(fileExtension).toEqual("csv");
    });

    it("Returns a download URL for the xlsx response file", async () => {
      prisma.survey.findUnique.mockResolvedValue(mockSurveyOutput);
      prisma.response.count.mockResolvedValue(1);
      prisma.response.findMany.mockResolvedValue([mockResponse]);

      const url = await getResponseDownloadUrl(mockSurveyId, "xlsx", { finished: true });
      const fileExtension = url.split(".").pop();
      expect(fileExtension).toEqual("xlsx");
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getResponseDownloadUrl, mockSurveyId, 123);

    it("Throws error if response file is of different format than expected", async () => {
      prisma.survey.findUnique.mockResolvedValue(mockSurveyOutput);
      prisma.response.count.mockResolvedValue(1);
      prisma.response.findMany.mockResolvedValue([mockResponse]);

      const url = await getResponseDownloadUrl(mockSurveyId, "csv", { finished: true });
      const fileExtension = url.split(".").pop();
      expect(fileExtension).not.toEqual("xlsx");
    });

    it("Throws DatabaseError on PrismaClientKnownRequestError, when the getResponseCountBySurveyId fails", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });
      prisma.survey.findUnique.mockResolvedValue(mockSurveyOutput);
      prisma.response.count.mockRejectedValue(errToThrow);

      await expect(getResponseDownloadUrl(mockSurveyId, "csv")).rejects.toThrow(DatabaseError);
    });

    it("Throws DatabaseError on PrismaClientKnownRequestError, when the getResponses fails", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      prisma.survey.findUnique.mockResolvedValue(mockSurveyOutput);
      prisma.response.count.mockResolvedValue(1);
      prisma.response.findMany.mockRejectedValue(errToThrow);

      await expect(getResponseDownloadUrl(mockSurveyId, "csv")).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for unexpected problems", async () => {
      const mockErrorMessage = "Mock error message";

      // error from getSurvey
      prisma.survey.findUnique.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getResponseDownloadUrl(mockSurveyId, "xlsx")).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getResponsesByEnvironmentId", () => {
  describe("Happy Path", () => {
    it("Obtains all responses associated with a specific environment ID", async () => {
      const responses = await getResponsesByEnvironmentId(mockEnvironmentId);
      expect(responses).toEqual([expectedResponseWithoutPerson]);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getResponsesByEnvironmentId, "123#");

    it("Throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      prisma.response.findMany.mockRejectedValue(errToThrow);

      await expect(getResponsesByEnvironmentId(mockEnvironmentId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for any other unhandled exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.response.findMany.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getResponsesByEnvironmentId(mockEnvironmentId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for updateResponse Service", () => {
  describe("Happy Path", () => {
    it("Updates a response (finished = true)", async () => {
      const response = await updateResponse(mockResponse.id, getMockUpdateResponseInput(true));
      expect(response).toEqual({
        ...expectedResponseWithoutPerson,
        data: mockResponseData,
      });
    });

    it("Updates a response (finished = false)", async () => {
      const response = await updateResponse(mockResponse.id, getMockUpdateResponseInput(false));
      expect(response).toEqual({
        ...expectedResponseWithoutPerson,
        finished: false,
        data: mockResponseData,
      });
    });
  });

  describe("Sad Path", () => {
    testInputValidation(updateResponse, "123#", {});

    it("Throws ResourceNotFoundError if no response is found", async () => {
      prisma.response.findUnique.mockResolvedValue(null);
      await expect(updateResponse(mockResponse.id, getMockUpdateResponseInput())).rejects.toThrow(
        ResourceNotFoundError
      );
    });

    it("Throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      prisma.response.update.mockRejectedValue(errToThrow);

      await expect(updateResponse(mockResponse.id, getMockUpdateResponseInput())).rejects.toThrow(
        DatabaseError
      );
    });

    it("Throws a generic Error for other unexpected issues", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.response.update.mockRejectedValue(new Error(mockErrorMessage));

      await expect(updateResponse(mockResponse.id, getMockUpdateResponseInput())).rejects.toThrow(Error);
    });
  });
});

describe("Tests for deleteResponse service", () => {
  describe("Happy Path", () => {
    it("Successfully deletes a response based on its ID", async () => {
      const response = await deleteResponse(mockResponse.id);
      expect(response).toEqual(expectedResponseWithoutPerson);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(deleteResponse, "123#");

    it("Throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      prisma.response.delete.mockRejectedValue(errToThrow);

      await expect(deleteResponse(mockResponse.id)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for any unhandled exception during deletion", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.response.delete.mockRejectedValue(new Error(mockErrorMessage));

      await expect(deleteResponse(mockResponse.id)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getResponseCountBySurveyId service", () => {
  describe("Happy Path", () => {
    it("Counts the total number of responses for a given survey ID", async () => {
      prisma.survey.findUnique.mockResolvedValue(mockSurveyOutput);

      const count = await getResponseCountBySurveyId(mockSurveyId);
      expect(count).toEqual(1);
    });

    it("Returns zero count when there are no responses for a given survey ID", async () => {
      prisma.response.count.mockResolvedValue(0);
      const count = await getResponseCountBySurveyId(mockSurveyId);
      expect(count).toEqual(0);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getResponseCountBySurveyId, "123#");

    it("Throws a generic Error for other unexpected issues", async () => {
      const mockErrorMessage = "Mock error message";
      prisma.response.count.mockRejectedValue(new Error(mockErrorMessage));
      prisma.survey.findUnique.mockResolvedValue(mockSurveyOutput);

      await expect(getResponseCountBySurveyId(mockSurveyId)).rejects.toThrow(Error);
    });
  });
});
