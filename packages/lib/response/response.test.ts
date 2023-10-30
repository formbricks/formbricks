import { prismaMock } from "@formbricks/database/src/jestClient";
import { Prisma } from "@prisma/client";
import { randUuid, randBrowser, randUrl, randBoolean, randText, randFullName } from "@ngneat/falso";
import { transformPrismaPerson } from "../person/service";
import { TTag } from "@formbricks/types/tags";
import { TResponseInput } from "@formbricks/types/responses";

import { responseNoteSelect } from "../responseNote/service";

import {
  getResponsesByPersonId,
  getResponseBySingleUseId,
  createResponse,
  getResponse,
  getResponses,
  getResponsesByEnvironmentId,
  updateResponse,
  deleteResponse,
  getResponseCountBySurveyId,
  responseSelection,
} from "./service";

type ResponseMock = Prisma.ResponseGetPayload<{
  include: typeof responseSelection;
}>;
type ResponseNoteMock = Prisma.ResponseNoteGetPayload<{
  include: typeof responseNoteSelect;
}>;

const mockEnvironmentId = "clnndevho0mqrqp0fm2ozul8p";
const mockPersonId = "clnndevho0mqrqp0fm2ozul8p";
const mockResponseId = "clnndevho0mqrqp0fm2ozul8p";
const mockSingleUseId = "clnndevho0mqrqp0fm2ozul8p";
const mockSurveyId = "clnndevho0mqrqp0fm2ozul8p";
const mockUserId = "clnndevho0mqrqp0fm2ozul8p";

const mockMeta = {
  source: randUrl(),
  url: randUrl(),
  userAgent: {
    browser: randBrowser(),
    os: randText(),
    device: randText(),
  },
};

const mockResponse: ResponseMock = {
  id: mockResponseId,
  surveyId: mockSurveyId,
  personId: mockPersonId,
  singleUseId: mockSingleUseId,
  data: {},
  personAttributes: {},
  person: {
    id: mockPersonId,
    createdAt: new Date(),
    updatedAt: new Date(),
    environmentId: mockEnvironmentId,
    attributes: [
      {
        value: "attribute1",
        attributeClass: {
          name: "attributeClass1",
        },
      },
    ],
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  finished: randBoolean(),
  tags: [
    {
      tag: {
        id: randUuid(),
        name: "tag1",
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: mockEnvironmentId,
      },
    },
  ],
  meta: mockMeta,
};

const mockResponseNote: ResponseNoteMock = {
  id: "clnndevho0mqrqp0fm2ozul8p",
  createdAt: new Date(),
  updatedAt: new Date(),
  text: randText(),
  isEdited: randBoolean(),
  isResolved: randBoolean(),
  responseId: mockResponseId,
  userId: mockUserId,
  response: {
    id: mockResponseId,
    surveyId: mockSurveyId,
  },
  user: {
    id: mockUserId,
    name: randFullName(),
  },
};

const expectedResponse = {
  ...mockResponse,
  notes: [mockResponseNote],
  person: mockResponse?.person ? transformPrismaPerson(mockResponse.person) : null,
  tags: mockResponse?.tags?.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
};

const mockResponseInput: TResponseInput = {
  surveyId: mockSurveyId,
  personId: mockPersonId,
  singleUseId: mockSingleUseId,
  finished: randBoolean(),
  data: {},
  meta: mockMeta,
};

beforeEach(() => {
  prismaMock.response.findMany.mockResolvedValue([mockResponse]);
  prismaMock.response.findUnique.mockResolvedValue(mockResponse);
  prismaMock.response.create.mockResolvedValue(mockResponse);
  prismaMock.response.update.mockResolvedValue(mockResponse);
  prismaMock.response.delete.mockResolvedValue(mockResponse);
  prismaMock.response.count.mockResolvedValue(1);

  prismaMock.responseNote.findMany.mockResolvedValue([mockResponseNote]);
});

describe("Response Service", () => {
  test("getResponsesByPersonId function", async () => {
    const responses = await getResponsesByPersonId(mockPersonId, 1);

    const expectedResponses = [expectedResponse];

    expect(responses).toHaveLength(1);
    expect(responses).toEqual(expectedResponses);
  });

  test("getResponseBySingleUseId function", async () => {
    const response = await getResponseBySingleUseId(mockSurveyId, mockSingleUseId);

    expect(response).toEqual(expectedResponse);
  });

  test("createResponse function", async () => {
    const response = await createResponse(mockResponseInput);
    expect(response).toEqual(expectedResponse);
  });

  test("getResponse function", async () => {
    const response = await getResponse(mockResponseId);
    expect(response).toEqual(expectedResponse);
  });

  test("getResponses function", async () => {
    const responses = await getResponses(mockSurveyId);
    expect(responses).toEqual([expectedResponse]);
  });

  test("getResponsesByEnvironmentId function", async () => {
    const responses = await getResponsesByEnvironmentId(mockEnvironmentId, 1);
    expect(responses).toHaveLength(1);
    expect(responses).toEqual([expectedResponse]);
  });

  test("updateResponse function", async () => {
    const response = await updateResponse(mockResponseId, mockResponseInput);
    expect(response).toEqual(expectedResponse);
  });

  test("deleteResponse function", async () => {
    const response = await deleteResponse(mockResponseId);
    expect(response).toEqual(expectedResponse);
  });

  test("getResponseCountBySurveyId function", async () => {
    const count = await getResponseCountBySurveyId(mockSurveyId);
    expect(count).toEqual(1);
  });
});
