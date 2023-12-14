import { Prisma } from "@prisma/client";
import { responseNoteSelect } from "../../../responseNote/service";
import { responseSelection } from "../../service";
import { randBoolean, randBrowser, randFullName, randText, randUrl, randUuid } from "../constants";
import { TResponseUpdateInput } from "@formbricks/types/responses";

type ResponseMock = Prisma.ResponseGetPayload<{
  include: typeof responseSelection;
}>;
type ResponseNoteMock = Prisma.ResponseNoteGetPayload<{
  include: typeof responseNoteSelect;
}>;
type ResponsePersonMock = Prisma.PersonGetPayload<{
  select: typeof responseSelection.person.select;
}>;

export const mockEnvironmentId = "ars2tjk8hsi8oqk1uac00mo7";
export const mockPersonId = "lhwy39ga2zy8by1ol1bnaiso";
export const mockResponseId = "z32bqib0nlcw8vqymlj6m8x7";
export const mockSingleUseId = "qj57j3opsw8b5sxgea20fgcq";
export const mockSurveyId = "nlg30c8btxljivh6dfcoxve2";
export const mockUserId = "qwywazmugeezyfr3zcg9jk8a";

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

export const mockResponseData: TResponseUpdateInput["data"] = {
  key1: "value",
  key2: ["value1", "value2"],
  key3: 20,
};

export const getMockUpdateResponseInput = (finished: boolean = false): TResponseUpdateInput => ({
  data: mockResponseData,
  finished,
});
