import { Prisma } from "@prisma/client";
import { isAfter, isBefore, isSameDay } from "date-fns";

import { TDisplay } from "@formbricks/types/displays";
import {
  TResponse,
  TResponseFilterCriteria,
  TResponseUpdateInput,
  TSurveyPersonAttributes,
} from "@formbricks/types/responses";
import { TTag } from "@formbricks/types/tags";

import { transformPrismaPerson } from "../../../person/service";
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
  status: null,
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

export const mockResponsePersonAttributes: ResponseMock[] = [
  {
    id: mockResponseId,
    surveyId: mockSurveyId,
    singleUseId: mockSingleUseId,
    data: {},
    createdAt: new Date(),
    finished: constantsForTests.boolean,
    meta: mockMeta,
    notes: [mockResponseNote],
    tags: mockTags,
    personId: mockPersonId,
    updatedAt: new Date(),
    ttc: {},
    person: null,
    personAttributes: { Plan: "Paid", "Init Attribute 1": "one", "Init Attribute 2": "two" },
  },
  {
    id: mockResponseId,
    surveyId: mockSurveyId,
    singleUseId: mockSingleUseId,
    data: {},
    createdAt: new Date(),
    finished: constantsForTests.boolean,
    meta: mockMeta,
    notes: [mockResponseNote],
    tags: mockTags,
    personId: mockPersonId,
    updatedAt: new Date(),
    ttc: {},
    person: null,
    personAttributes: {
      Plan: "Paid",
      "Init Attribute 1": "three",
      "Init Attribute 2": "four",
    },
  },
  {
    id: mockResponseId,
    surveyId: mockSurveyId,
    singleUseId: mockSingleUseId,
    data: {},
    createdAt: new Date(),
    finished: constantsForTests.boolean,
    meta: mockMeta,
    notes: [mockResponseNote],
    tags: mockTags,
    personId: mockPersonId,
    updatedAt: new Date(),
    ttc: {},
    person: null,
    personAttributes: { Plan: "Paid", "Init Attribute 1": "five", "Init Attribute 2": "six" },
  },
  {
    id: mockResponseId,
    surveyId: mockSurveyId,
    singleUseId: mockSingleUseId,
    data: {},
    createdAt: new Date(),
    finished: constantsForTests.boolean,
    meta: mockMeta,
    notes: [mockResponseNote],
    tags: mockTags,
    personId: mockPersonId,
    updatedAt: new Date(),
    ttc: {},
    person: null,
    personAttributes: { Plan: "Paid", "Init Attribute 1": "five", "Init Attribute 2": "four" },
  },
  {
    id: mockResponseId,
    surveyId: mockSurveyId,
    singleUseId: mockSingleUseId,
    data: {},
    createdAt: new Date(),
    finished: constantsForTests.boolean,
    meta: mockMeta,
    notes: [mockResponseNote],
    tags: mockTags,
    personId: mockPersonId,
    updatedAt: new Date(),
    ttc: {},
    person: null,
    personAttributes: { Plan: "Paid", "Init Attribute 1": "three", "Init Attribute 2": "two" },
  },
];

const getMockTags = (tags: string[]): { tag: TTag }[] => {
  return tags.map((tag) => ({
    tag: {
      id: constantsForTests.uuid,
      name: tag,
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: mockEnvironmentId,
    },
  }));
};

export const mockResponses: ResponseMock[] = [
  {
    id: "clsk98dpd001qk8iuqllv486a",
    createdAt: new Date("2024-02-13T11:00:00.000Z"),
    updatedAt: new Date("2024-02-13T11:00:00.000Z"),
    surveyId: mockSurveyId,
    finished: false,
    data: {
      hagrboqlnynmxh3obl1wvmtl: "Google Search",
      uvy0fa96e1xpd10nrj1je662: ["Sun ☀️"],
    },
    meta: mockMeta,
    ttc: {},
    personAttributes: {
      Plan: "Paid",
      "Init Attribute 1": "six",
      "Init Attribute 2": "five",
    },
    singleUseId: mockSingleUseId,
    personId: mockPersonId,
    person: null,
    tags: getMockTags(["tag1", "tag3"]),
    notes: [],
  },
  {
    id: "clsk8db0r001kk8iujkn32q8g",
    createdAt: new Date("2024-02-13T11:00:00.000Z"),
    updatedAt: new Date("2024-02-13T11:00:00.000Z"),
    surveyId: mockSurveyId,
    finished: false,
    data: {
      hagrboqlnynmxh3obl1wvmtl: "Google Search",
      uvy0fa96e1xpd10nrj1je662: ["Sun ☀️"],
    },
    meta: mockMeta,
    ttc: {},
    personAttributes: {
      Plan: "Paid",
      "Init Attribute 1": "six",
      "Init Attribute 2": "four",
    },
    singleUseId: mockSingleUseId,
    personId: mockPersonId,
    person: null,
    tags: getMockTags(["tag1", "tag2"]),
    notes: [],
  },
  {
    id: "clsk7b15p001fk8iu04qpvo2f",
    createdAt: new Date("2024-02-13T11:00:00.000Z"),
    updatedAt: new Date("2024-02-13T11:00:00.000Z"),
    surveyId: mockSurveyId,
    finished: false,
    data: {
      hagrboqlnynmxh3obl1wvmtl: "Google Search",
    },
    meta: mockMeta,
    ttc: {},
    personAttributes: {
      Plan: "Paid",
      "Init Attribute 1": "six",
      "Init Attribute 2": "four",
    },
    singleUseId: mockSingleUseId,
    personId: mockPersonId,
    person: null,
    tags: getMockTags(["tag2", "tag3"]),
    notes: [],
  },
  {
    id: "clsk6bk1l0017k8iut9dp0uxt",
    createdAt: new Date("2024-02-13T11:00:00.000Z"),
    updatedAt: new Date("2024-02-13T11:00:00.000Z"),
    surveyId: mockSurveyId,
    finished: false,
    data: {
      hagrboqlnynmxh3obl1wvmtl: "Recommendation",
    },
    meta: mockMeta,
    ttc: {},
    personAttributes: {
      Plan: "Paid",
      "Init Attribute 1": "eight",
      "Init Attribute 2": "two",
    },
    singleUseId: mockSingleUseId,
    personId: mockPersonId,
    person: null,
    tags: getMockTags(["tag1", "tag4"]),
    notes: [],
  },
  {
    id: "clsk5tgkm000uk8iueqoficwc",
    createdAt: new Date("2024-02-13T11:00:00.000Z"),
    updatedAt: new Date("2024-02-13T11:00:00.000Z"),
    surveyId: mockSurveyId,
    finished: true,
    data: {
      hagrboqlnynmxh3obl1wvmtl: "Social Media",
    },
    meta: mockMeta,
    ttc: {},
    personAttributes: {
      Plan: "Paid",
      "Init Attribute 1": "eight",
      "Init Attribute 2": "two",
    },
    singleUseId: mockSingleUseId,
    personId: mockPersonId,
    person: null,
    tags: getMockTags(["tag4", "tag5"]),
    notes: [],
  },
];

export const getFilteredMockResponses = (
  fitlerCritera: TResponseFilterCriteria,
  format: boolean = true
): (ResponseMock | TResponse)[] => {
  let result = mockResponses;

  if (fitlerCritera.finished !== undefined) {
    result = result.filter((response) => response.finished === fitlerCritera.finished);
  }

  if (fitlerCritera.createdAt !== undefined) {
    if (fitlerCritera.createdAt.min !== undefined) {
      result = result.filter(
        (response) =>
          isAfter(response.createdAt, fitlerCritera.createdAt?.min || "") ||
          isSameDay(response.createdAt, fitlerCritera.createdAt?.min || "")
      );
    }

    if (fitlerCritera.createdAt.max !== undefined) {
      result = result.filter(
        (response) =>
          isBefore(response.createdAt, fitlerCritera.createdAt?.max || "") ||
          isSameDay(response.createdAt, fitlerCritera.createdAt?.min || "")
      );
    }
  }

  if (fitlerCritera.personAttributes !== undefined) {
    result = result.filter((response) => {
      for (const [key, value] of Object.entries(fitlerCritera.personAttributes || {})) {
        if (value.op === "equals" && response.personAttributes?.[key] !== value.value) {
          return false;
        } else if (value.op === "notEquals" && response.personAttributes?.[key] === value.value) {
          return false;
        }
      }
      return true;
    });
  }

  if (fitlerCritera.tags !== undefined) {
    result = result.filter((response) => {
      // response should contain all the tags in applied and none of the tags in notApplied
      return (
        fitlerCritera.tags?.applied?.every((tag) => {
          return response.tags?.some((responseTag) => responseTag.tag.name === tag);
        }) &&
        fitlerCritera.tags?.notApplied?.every((tag) => {
          return !response.tags?.some((responseTag) => responseTag.tag.name === tag);
        })
      );
    });
  }

  if (fitlerCritera.data !== undefined) {
    result = result.filter((response) => {
      for (const [key, value] of Object.entries(fitlerCritera.data || {})) {
        switch (value.op) {
          case "booked":
          case "accepted":
          case "clicked":
            return response.data?.[key] === value.op;
          case "equals":
            return response.data?.[key] === value.value;
          case "greaterThan":
            return Number(response.data?.[key]) > value.value;
          case "lessThan":
            return Number(response.data?.[key]) < value.value;
          case "greaterEqual":
            return Number(response.data?.[key]) >= value.value;
          case "lessEqual":
            return Number(response.data?.[key]) <= value.value;
          case "includesAll":
            return value.value.every((val: string) => (response.data?.[key] as string[])?.includes(val));
          case "includesOne":
            return value.value.some((val: string) => {
              if (Array.isArray(response.data?.[key]))
                return (response.data?.[key] as string[])?.includes(val);
              return response.data?.[key] === val;
            });
          case "notEquals":
            return response.data?.[key] !== value.value;
          case "notUploaded":
            return response.data?.[key] === undefined || response.data?.[key] === "skipped";
          case "skipped":
            return response.data?.[key] === undefined;
          case "submitted":
            return response.data?.[key] !== undefined;
          case "uploaded":
            return response.data?.[key] !== "skipped";
        }
      }
    });
  }

  if (format) {
    return result.map((response) => ({
      ...response,
      person: response.person ? transformPrismaPerson(response.person) : null,
      tags: response.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    }));
  }
  return result;
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

export const mockPersonAttributesData: TSurveyPersonAttributes = {
  Plan: ["Paid"],
  "Init Attribute 1": ["one", "three", "five"],
  "Init Attribute 2": ["two", "four", "six"],
};

export const getMockUpdateResponseInput = (finished: boolean = false): TResponseUpdateInput => ({
  data: mockResponseData,
  finished,
});
