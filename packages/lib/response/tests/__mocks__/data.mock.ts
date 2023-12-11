import { Prisma } from "@prisma/client";
import { responseNoteSelect } from "../../../responseNote/service";
import { responseSelection } from "../../service";
import { randomCuid2 } from "../../../utils/common";
import { randBoolean, randBrowser, randFullName, randText, randUrl, randUuid } from "../constants";

type ResponseMock = Prisma.ResponseGetPayload<{
  include: typeof responseSelection;
}>;
type ResponseNoteMock = Prisma.ResponseNoteGetPayload<{
  include: typeof responseNoteSelect;
}>;
type ResponsePersonMock = Prisma.PersonGetPayload<{
  select: typeof responseSelection.person.select;
}>;

export const mockEnvironmentId = randomCuid2();
export const mockPersonId = randomCuid2();
export const mockResponseId = randomCuid2();
export const mockSingleUseId = randomCuid2();
export const mockSurveyId = randomCuid2();
export const mockUserId = randomCuid2();

export const mockMeta = {
  source: randUrl(),
  url: randUrl(),
  userAgent: {
    browser: randBrowser(),
    os: randText(),
    device: randText(),
  },
};

export const mockResponseNote: ResponseNoteMock = {
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
    id: mockPersonId,
    name: randFullName(),
  },
};

export const mockPerson: ResponsePersonMock = {
  id: mockPersonId,
  userId: mockUserId,
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
};

export const mockTags = [
  {
    tag: {
      id: randUuid(),
      name: "tag1",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: mockEnvironmentId,
    },
  },
];

export const mockResponse: ResponseMock = {
  id: mockResponseId,
  surveyId: mockSurveyId,
  singleUseId: mockSingleUseId,
  data: {},
  person: null,
  personAttributes: {},
  createdAt: new Date(),
  finished: randBoolean(),
  meta: mockMeta,
  notes: [mockResponseNote],
  tags: mockTags,
  personId: mockPersonId,
  updatedAt: new Date(),
  ttc: {},
};
