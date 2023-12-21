import { Prisma } from "@prisma/client";

import { TDisplay } from "@formbricks/types/displays";
import { TResponseUpdateInput } from "@formbricks/types/responses";

import { responseNoteSelect } from "../../../responseNote/service";
import { responseSelection } from "../../service";
import { constantsForTests } from "../constants";

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
export const mockDisplayId = "sxmaf9hp9yv25txpohogckfx";

export const mockMeta = {
  source: constantsForTests.url,
  url: constantsForTests.url,
  userAgent: {
    browser: constantsForTests.browser,
    os: constantsForTests.text,
    device: constantsForTests.text,
  },
};

export const mockResponseNote: ResponseNoteMock = {
  id: "clnndevho0mqrqp0fm2ozul8p",
  createdAt: new Date(),
  updatedAt: new Date(),
  text: constantsForTests.text,
  isEdited: constantsForTests.boolean,
  isResolved: constantsForTests.boolean,
  responseId: mockResponseId,
  userId: mockUserId,
  response: {
    id: mockResponseId,
    surveyId: mockSurveyId,
  },
  user: {
    id: mockPersonId,
    name: constantsForTests.fullName,
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
      id: constantsForTests.uuid,
      name: "tag1",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: mockEnvironmentId,
    },
  },
];

export const mockDisplay: TDisplay = {
  id: mockDisplayId,
  createdAt: new Date(),
  updatedAt: new Date(),
  surveyId: mockSurveyId,
  personId: mockPersonId,
  responseId: mockResponseId,
};

export const mockResponse: ResponseMock = {
  id: mockResponseId,
  surveyId: mockSurveyId,
  singleUseId: mockSingleUseId,
  data: {},
  person: null,
  personAttributes: {},
  createdAt: new Date(),
  finished: constantsForTests.boolean,
  meta: mockMeta,
  notes: [mockResponseNote],
  tags: mockTags,
  personId: mockPersonId,
  updatedAt: new Date(),
  ttc: {},
};

export const mockResponseWithMockPerson: ResponseMock = {
  ...mockResponse,
  person: mockPerson,
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
