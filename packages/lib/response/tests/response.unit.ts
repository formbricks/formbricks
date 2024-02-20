import {
  getFilteredMockResponses,
  getMockUpdateResponseInput,
  mockDisplay,
  mockEnvironmentId,
  mockMeta,
  mockPerson,
  mockPersonAttributesData,
  mockPersonId,
  mockResponse,
  mockResponseData,
  mockResponseNote,
  mockResponsePersonAttributes,
  mockResponseWithMockPerson,
  mockSingleUseId,
  mockSurveyId,
  mockTags,
  mockUserId,
} from "./__mocks__/data.mock";

import { Prisma } from "@prisma/client";

import { prismaMock } from "@formbricks/database/src/jestClient";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import {
  TResponse,
  TResponseFilterCriteria,
  TResponseInput,
  TResponseLegacyInput,
} from "@formbricks/types/responses";
import { TTag } from "@formbricks/types/tags";

import { selectPerson, transformPrismaPerson } from "../../person/service";
import {
  createResponse,
  createResponseLegacy,
  deleteResponse,
  getResponse,
  getResponseBySingleUseId,
  getResponseCountBySurveyId,
  getResponsePersonAttributes,
  getResponses,
  getResponsesByEnvironmentId,
  getResponsesByPersonId,
  updateResponse,
} from "../service";
import { buildWhereClause } from "../util";
import { constantsForTests } from "./constants";

const expectedResponseWithoutPerson: TResponse = {
  ...mockResponse,
  person: null,
  tags: mockTags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
};

const expectedResponseWithPerson: TResponse = {
  ...mockResponse,
  person: transformPrismaPerson(mockPerson),
  tags: mockTags?.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
};

const mockResponseInputWithoutUserId: TResponseInput = {
  environmentId: mockEnvironmentId,
  surveyId: mockSurveyId,
  singleUseId: mockSingleUseId,
  finished: constantsForTests.boolean,
  data: {},
  meta: mockMeta,
};

const mockResponseInputWithUserId: TResponseInput = {
  ...mockResponseInputWithoutUserId,
  userId: mockUserId,
};

const createMockResponseLegacyInput = (personId?: string): TResponseLegacyInput => ({
  finished: constantsForTests.boolean,
  personId: personId ?? null,
  surveyId: mockSurveyId,
  meta: mockMeta,
  singleUseId: mockSingleUseId,
  ttc: {},
  data: {},
});

beforeEach(() => {
  // @ts-expect-error
  prismaMock.response.create.mockImplementation(async (args) => {
    if (args.data.person && args.data.person.connect) {
      return {
        ...mockResponse,
        person: mockPerson,
      };
    }

    return mockResponse;
  });

  // mocking the person findFirst call as it is used in the transformPrismaPerson function
  prismaMock.person.findFirst.mockResolvedValue(mockPerson);
  prismaMock.responseNote.findMany.mockResolvedValue([mockResponseNote]);

  prismaMock.response.findUnique.mockResolvedValue(mockResponse);

  // @ts-expect-error
  prismaMock.response.update.mockImplementation(async (args) => {
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

  prismaMock.response.findMany.mockResolvedValue([mockResponse]);
  prismaMock.response.delete.mockResolvedValue(mockResponse);

  prismaMock.display.delete.mockResolvedValue({ ...mockDisplay, status: "seen" });

  prismaMock.response.count.mockResolvedValue(1);
});

// utility function to test input validation for all services
const testInputValidation = async (service: Function, ...args: any[]): Promise<void> => {
  it("it should throw a ValidationError if the inputs are invalid", async () => {
    await expect(service(...args)).rejects.toThrow(ValidationError);
  });
};

describe("Tests for getResponsesByPersonId", () => {
  describe("Happy Path", () => {
    it("Returns all responses associated with a given person ID", async () => {
      prismaMock.response.findMany.mockResolvedValue([mockResponseWithMockPerson]);

      const responses = await getResponsesByPersonId(mockPerson.id);
      expect(responses).toEqual([expectedResponseWithPerson]);
    });

    it("Returns an empty array when no responses are found for the given person ID", async () => {
      prismaMock.response.findMany.mockResolvedValue([]);

      const responses = await getResponsesByPersonId(mockPerson.id);
      expect(responses).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getResponsesByPersonId, "123", 1);

    it("Throws a DatabaseError error if there is a PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.response.findMany.mockRejectedValue(errToThrow);

      await expect(getResponsesByPersonId(mockPerson.id)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for unexpected exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.response.findMany.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getResponsesByPersonId(mockPerson.id)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getResponsesBySingleUseId", () => {
  describe("Happy Path", () => {
    it("Retrieves responses linked to a specific single-use ID", async () => {
      const responses = await getResponseBySingleUseId(mockSurveyId, mockSingleUseId);
      expect(responses).toEqual(expectedResponseWithoutPerson);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getResponseBySingleUseId, "123", "123");

    it("Throws DatabaseError on PrismaClientKnownRequestError occurrence", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.response.findUnique.mockRejectedValue(errToThrow);

      await expect(getResponseBySingleUseId(mockSurveyId, mockSingleUseId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for other exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.response.findUnique.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getResponseBySingleUseId(mockSurveyId, mockSingleUseId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for createResponse service", () => {
  describe("Happy Path", () => {
    it("Creates a response linked to an existing user", async () => {
      const response = await createResponse(mockResponseInputWithUserId);
      expect(response).toEqual(expectedResponseWithPerson);
    });

    it("Creates a response without an associated user ID", async () => {
      const response = await createResponse(mockResponseInputWithoutUserId);
      expect(response).toEqual(expectedResponseWithoutPerson);
    });

    it("Creates a new person and response when the person does not exist", async () => {
      prismaMock.person.findFirst.mockResolvedValue(null);
      prismaMock.person.create.mockResolvedValue(mockPerson);
      const response = await createResponse(mockResponseInputWithUserId);

      expect(response).toEqual(expectedResponseWithPerson);

      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: {
          environment: { connect: { id: mockEnvironmentId } },
          userId: mockUserId,
        },
        select: selectPerson,
      });
    });
  });

  describe("Sad Path", () => {
    testInputValidation(createResponse, {
      ...mockResponseInputWithUserId,
      data: [],
    });

    it("Throws DatabaseError on PrismaClientKnownRequestError occurrence", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.response.create.mockRejectedValue(errToThrow);

      await expect(createResponse(mockResponseInputWithUserId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for other exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.response.create.mockRejectedValue(new Error(mockErrorMessage));

      await expect(createResponse(mockResponseInputWithUserId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for createResponseLegacy service", () => {
  describe("Happy Path", () => {
    it("Creates a response linked to an existing user", async () => {
      const response = await createResponseLegacy(createMockResponseLegacyInput(mockPersonId));
      expect(response).toEqual(expectedResponseWithPerson);
    });

    it("Creates a legacy response without an associated user ID", async () => {
      const response = await createResponseLegacy(createMockResponseLegacyInput());
      expect(response).toEqual(expectedResponseWithoutPerson);
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
    testInputValidation(getResponse, "123");

    it("Throws ResourceNotFoundError if no response is found", async () => {
      prismaMock.response.findUnique.mockResolvedValue(null);
      const response = await getResponse(mockResponse.id);
      expect(response).toBeNull();
    });

    it("Throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.response.findUnique.mockRejectedValue(errToThrow);

      await expect(getResponse(mockResponse.id)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for other unexpected issues", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.response.findUnique.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getResponse(mockResponse.id)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getAttributesFromResponses service", () => {
  describe("Happy Path", () => {
    it("Retrieves all attributes from responses for a given survey ID", async () => {
      prismaMock.response.findMany.mockResolvedValue(mockResponsePersonAttributes);
      const attributes = await getResponsePersonAttributes(mockSurveyId);
      expect(attributes).toEqual(mockPersonAttributesData);
    });

    it("Returns an empty Object when no responses with attributes are found for the given survey ID", async () => {
      prismaMock.response.findMany.mockResolvedValue([]);

      const responses = await getResponsePersonAttributes(mockSurveyId);
      expect(responses).toEqual({});
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getResponsePersonAttributes, "1");

    it("Throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.response.findMany.mockRejectedValue(errToThrow);

      await expect(getResponsePersonAttributes(mockSurveyId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for unexpected problems", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.response.findMany.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getResponsePersonAttributes(mockSurveyId)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getResponses service", () => {
  describe("Happy Path", () => {
    it("Fetches first 10 responses for a given survey ID", async () => {
      const response = await getResponses(mockSurveyId, 1, 10);
      expect(response).toEqual([expectedResponseWithoutPerson]);
    });
  });

  describe("Tests for getResponses service with filters", () => {
    describe("Happy Path", () => {
      it("Fetches all responses for a given survey ID with basic filters", async () => {
        const whereClause = buildWhereClause({ finished: true });
        let expectedWhereClause: Prisma.ResponseWhereInput | undefined = {};

        // @ts-expect-error
        prismaMock.response.findMany.mockImplementation(async (args) => {
          expectedWhereClause = args?.where;
          return getFilteredMockResponses({ finished: true }, false);
        });

        const response = await getResponses(mockSurveyId, 1, undefined, { finished: true });

        expect(expectedWhereClause).toEqual({ surveyId: mockSurveyId, ...whereClause });
        expect(response).toEqual(getFilteredMockResponses({ finished: true }));
      });

      it("Fetches all responses for a given survey ID with complex filters", async () => {
        const criteria: TResponseFilterCriteria = {
          finished: false,
          data: {
            hagrboqlnynmxh3obl1wvmtl: {
              op: "equals",
              value: "Google Search",
            },
            uvy0fa96e1xpd10nrj1je662: {
              op: "includesOne",
              value: ["Sun ☀️"],
            },
          },
          tags: {
            applied: ["tag1"],
            notApplied: ["tag4"],
          },
          personAttributes: {
            "Init Attribute 2": {
              op: "equals",
              value: "four",
            },
          },
        };
        const whereClause = buildWhereClause(criteria);
        let expectedWhereClause: Prisma.ResponseWhereInput | undefined = {};

        // @ts-expect-error
        prismaMock.response.findMany.mockImplementation(async (args) => {
          expectedWhereClause = args?.where;
          return getFilteredMockResponses(criteria, false);
        });

        const response = await getResponses(mockSurveyId, 1, undefined, criteria);

        expect(expectedWhereClause).toEqual({ surveyId: mockSurveyId, ...whereClause });
        expect(response).toEqual(getFilteredMockResponses(criteria));
      });
    });

    describe("Sad Path", () => {
      it("Throws an error when the where clause is different and the data is matched when filters are different.", async () => {
        const whereClause = buildWhereClause({ finished: true });
        let expectedWhereClause: Prisma.ResponseWhereInput | undefined = {};

        // @ts-expect-error
        prismaMock.response.findMany.mockImplementation(async (args) => {
          expectedWhereClause = args?.where;

          return getFilteredMockResponses({ finished: true });
        });

        const response = await getResponses(mockSurveyId, 1, undefined, { finished: true });

        expect(expectedWhereClause).not.toEqual(whereClause);
        expect(response).not.toEqual(getFilteredMockResponses({ finished: false }));
      });
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getResponses, mockSurveyId, "1");

    it("Throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.response.findMany.mockRejectedValue(errToThrow);

      await expect(getResponses(mockSurveyId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for unexpected problems", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.response.findMany.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getResponses(mockSurveyId)).rejects.toThrow(Error);
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
    testInputValidation(getResponsesByEnvironmentId, "123");

    it("Throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.response.findMany.mockRejectedValue(errToThrow);

      await expect(getResponsesByEnvironmentId(mockEnvironmentId)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for any other unhandled exceptions", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.response.findMany.mockRejectedValue(new Error(mockErrorMessage));

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
    testInputValidation(updateResponse, "123", {});

    it("Throws ResourceNotFoundError if no response is found", async () => {
      prismaMock.response.findUnique.mockResolvedValue(null);
      await expect(updateResponse(mockResponse.id, getMockUpdateResponseInput())).rejects.toThrow(
        ResourceNotFoundError
      );
    });

    it("Throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.response.update.mockRejectedValue(errToThrow);

      await expect(updateResponse(mockResponse.id, getMockUpdateResponseInput())).rejects.toThrow(
        DatabaseError
      );
    });

    it("Throws a generic Error for other unexpected issues", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.response.update.mockRejectedValue(new Error(mockErrorMessage));

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
    testInputValidation(deleteResponse, "123");

    it("Throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const mockErrorMessage = "Mock error message";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: "P2002",
        clientVersion: "0.0.1",
      });

      prismaMock.response.delete.mockRejectedValue(errToThrow);

      await expect(deleteResponse(mockResponse.id)).rejects.toThrow(DatabaseError);
    });

    it("Throws a generic Error for any unhandled exception during deletion", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.response.delete.mockRejectedValue(new Error(mockErrorMessage));

      await expect(deleteResponse(mockResponse.id)).rejects.toThrow(Error);
    });
  });
});

describe("Tests for getResponseCountBySurveyId service", () => {
  describe("Happy Path", () => {
    it("Counts the total number of responses for a given survey ID", async () => {
      const count = await getResponseCountBySurveyId(mockSurveyId);
      expect(count).toEqual(1);
    });

    it("Returns zero count when there are no responses for a given survey ID", async () => {
      prismaMock.response.count.mockResolvedValue(0);
      const count = await getResponseCountBySurveyId(mockSurveyId);
      expect(count).toEqual(0);
    });
  });

  describe("Sad Path", () => {
    testInputValidation(getResponseCountBySurveyId, "123");

    it("Throws a generic Error for other unexpected issues", async () => {
      const mockErrorMessage = "Mock error message";
      prismaMock.response.count.mockRejectedValue(new Error(mockErrorMessage));

      await expect(getResponseCountBySurveyId(mockSurveyId)).rejects.toThrow(Error);
    });
  });
});
