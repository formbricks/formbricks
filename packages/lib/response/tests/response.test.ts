import { prismaMock } from "@formbricks/database/src/jestClient";
import { selectPerson, transformPrismaPerson } from "../../person/service";
import { TTag } from "@formbricks/types/tags";
import { TResponse, TResponseInput } from "@formbricks/types/responses";
import {
  mockEnvironmentId,
  mockMeta,
  mockPerson,
  mockResponse,
  mockResponseNote,
  mockSingleUseId,
  mockSurveyId,
  mockTags,
  mockUserId,
} from "./__mocks__/data.mock";
import { createResponse } from "../service";
import { randBoolean } from "./constants";

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
  finished: randBoolean(),
  data: {},
  meta: mockMeta,
};

const mockResponseInputWithUserId: TResponseInput = {
  ...mockResponseInputWithoutUserId,
  userId: mockUserId,
};

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
});

describe("Tests for Response Service", () => {
  it("creates a response with an existing user", async () => {
    const response = await createResponse(mockResponseInputWithUserId);
    expect(response).toEqual(expectedResponseWithPerson);
  });

  it("creates a response without an existing user", async () => {
    const response = await createResponse(mockResponseInputWithoutUserId);
    expect(response).toEqual(expectedResponseWithoutPerson);
  });

  it("creates a new person if the person does not exists and then creates a response", async () => {
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

// describe("Response Service", () => {
//   test("getResponsesByPersonId function", async () => {
//     const responses = await getResponsesByPersonId(mockPersonId, 1);

//     const expectedResponses = [expectedResponse];

//     expect(responses).toHaveLength(1);
//     expect(responses).toEqual(expectedResponses);
//   });

//   test("getResponseBySingleUseId function", async () => {
//     const response = await getResponseBySingleUseId(mockSurveyId, mockSingleUseId);

//     expect(response).toEqual(expectedResponse);
//   });

//   test("createResponse function", async () => {
//     const response = await createResponse(mockResponseInput);
//     expect(response).toEqual(expectedResponse);
//   });

//   test("getResponse function", async () => {
//     const response = await getResponse(mockResponseId);
//     expect(response).toEqual(expectedResponse);
//   });

//   test("getResponses function", async () => {
//     const responses = await getResponses(mockSurveyId);
//     expect(responses).toEqual([expectedResponse]);
//   });

//   test("getResponsesByEnvironmentId function", async () => {
//     const responses = await getResponsesByEnvironmentId(mockEnvironmentId, 1);
//     expect(responses).toHaveLength(1);
//     expect(responses).toEqual([expectedResponse]);
//   });

//   test("updateResponse function", async () => {
//     const response = await updateResponse(mockResponseId, mockResponseInput);
//     expect(response).toEqual(expectedResponse);
//   });

//   test("deleteResponse function", async () => {
//     const response = await deleteResponse(mockResponseId);
//     expect(response).toEqual(expectedResponse);
//   });

//   test("getResponseCountBySurveyId function", async () => {
//     const count = await getResponseCountBySurveyId(mockSurveyId);
//     expect(count).toEqual(1);
//   });
// });
