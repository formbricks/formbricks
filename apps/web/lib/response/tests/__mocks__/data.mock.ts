import { mockWelcomeCard } from "@/lib/i18n/i18n.mock";
import { Prisma } from "@prisma/client";
import { isAfter, isBefore, isSameDay } from "date-fns";
import { TDisplay } from "@formbricks/types/displays";
import { TResponse, TResponseFilterCriteria, TResponseUpdateInput } from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { responseNoteSelect } from "../../../responseNote/service";
import { responseSelection } from "../../service";
import { constantsForTests } from "../constants";

type ResponseMock = Prisma.ResponseGetPayload<{
  include: typeof responseSelection;
}>;
type ResponseNoteMock = Prisma.ResponseNoteGetPayload<{
  include: typeof responseNoteSelect;
}>;

export const mockEnvironmentId = "ars2tjk8hsi8oqk1uac00mo7";
export const mockContactId = "lhwy39ga2zy8by1ol1bnaiso";
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
    id: mockContactId,
    name: constantsForTests.fullName,
  },
};

export const mockContact = {
  id: mockContactId,
  userId: mockUserId,
  createdAt: new Date(2000, 1, 1, 19),
  updatedAt: new Date(2000, 1, 1, 19),
  environmentId: mockEnvironmentId,
  attributes: [],
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
  contactId: mockContactId,
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
  personId: mockContactId,
  updatedAt: new Date(),
  language: "English",
  ttc: {},
  variables: {},
};

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
    variables: {},
    contactAttributes: {
      Plan: "Paid",
      "Init Attribute 1": "six",
      "Init Attribute 2": "five",
    },
    singleUseId: mockSingleUseId,
    contactId: mockContactId,
    contact: {
      id: mockContactId,
      attributes: [],
    },
    language: null,
    tags: getMockTags(["tag1", "tag3"]),
    notes: [],
    endingId: null,
    displayId: null,
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
    variables: {},
    contactAttributes: {
      Plan: "Paid",
      "Init Attribute 1": "six",
      "Init Attribute 2": "four",
    },
    singleUseId: mockSingleUseId,
    personId: mockContactId,
    person: null,
    language: null,
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
    variables: {},
    personAttributes: {
      Plan: "Paid",
      "Init Attribute 1": "six",
      "Init Attribute 2": "four",
    },
    singleUseId: mockSingleUseId,
    personId: mockContactId,
    person: null,
    tags: getMockTags(["tag2", "tag3"]),
    notes: [],
    language: null,
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
    variables: {},
    personAttributes: {
      Plan: "Paid",
      "Init Attribute 1": "eight",
      "Init Attribute 2": "two",
    },
    singleUseId: mockSingleUseId,
    personId: mockContactId,
    person: null,
    tags: getMockTags(["tag1", "tag4"]),
    notes: [],
    language: null,
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
    variables: {},
    personAttributes: {
      Plan: "Paid",
      "Init Attribute 1": "eight",
      "Init Attribute 2": "two",
    },
    singleUseId: mockSingleUseId,
    personId: mockContactId,
    person: null,
    tags: getMockTags(["tag4", "tag5"]),
    notes: [],
    language: null,
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

  if (fitlerCritera.contactAttributes !== undefined) {
    result = result.filter((response) => {
      for (const [key, value] of Object.entries(fitlerCritera.contactAttributes || {})) {
        if (value.op === "equals" && response.contactAttributes?.[key] !== value.value) {
          return false;
        } else if (value.op === "notEquals" && response.contactAttributes?.[key] === value.value) {
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
      contact: response.contact ? { id: response.contact.id, userId: mockUserId } : null,
      tags: response.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
    }));
  }

  return result;
};

export const mockResponseWithMockPerson: ResponseMock = {
  ...mockResponse,
  contact: mockContact,
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

export const mockSurveySummaryOutput = {
  dropOff: [
    {
      dropOffCount: 0,
      dropOffPercentage: 0,
      headline: "Question Text",
      questionType: "openText",
      questionId: "ars2tjk8hsi8oqk1uac00mo8",
      ttc: 0,
      impressions: 0,
    },
  ],
  meta: {
    completedPercentage: 0,
    completedResponses: 1,
    displayCount: 0,
    dropOffPercentage: 0,
    dropOffCount: 0,
    startsPercentage: 0,
    totalResponses: 1,
    ttcAverage: 0,
  },
  summary: [
    {
      insights: undefined,
      insightsEnabled: undefined,
      question: {
        headline: { default: "Question Text", de: "Fragetext" },
        id: "ars2tjk8hsi8oqk1uac00mo8",
        inputType: "text",
        required: false,
        type: TSurveyQuestionTypeEnum.OpenText,
        charLimit: {
          enabled: false,
        },
      },
      responseCount: 0,
      samples: [],
      type: "openText",
    },
  ],
};

export const mockSurvey: TSurvey = {
  id: mockSurveyId,
  createdAt: new Date("2024-02-06T20:12:03.521Z"),
  updatedAt: new Date("2024-02-06T20:12:03.521Z"),
  name: "New Survey",
  type: "link",
  environmentId: "envId",
  createdBy: "creatorId",
  status: "draft",
  welcomeCard: mockWelcomeCard,
  questions: [
    {
      id: "hagrboqlnynmxh3obl1wvmtl",
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      choices: [
        {
          id: "r52sul8ag19upaicit0fyqzo",
          label: { default: "Recommendation" },
        },
        {
          id: "es0gc12hrpk12x13rlqm59rg",
          label: { default: "Social Media" },
        },
        {
          id: "qzfbmf9nr5erqpew2urqzaow",
          label: { default: "Google Search" },
        },
        {
          id: "skpp7zubv6s1qi8ychw3oa5h",
          label: { default: "In a Podcast" },
        },
      ],
      isDraft: true,
      headline: {
        default: "What do you do?",
      },
      required: true,
      subheader: {
        default: "Can't do both.",
      },
      shuffleOption: "none",
    },
    {
      id: "uvy0fa96e1xpd10nrj1je662",
      type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
      required: true,
      headline: {
        default: "What's important on vacay?",
      },
      choices: [
        {
          id: "mgjk3i967ject4mezs4cjadj",
          label: {
            default: "Sun ☀️",
          },
        },
        {
          id: "m1wmzagcle4bzmkmgru4ol0w",
          label: {
            default: "Ocean 🌊",
          },
        },
        {
          id: "h12xs1v3w7s579p4upb5vnzp",
          label: {
            default: "Palms 🌴",
          },
        },
      ],
      shuffleOption: "none",
      isDraft: true,
    },
  ],
  endings: [
    {
      type: "endScreen",
      id: "umyknohldc7w26ocjdhaa62c",
      enabled: true,
      headline: {
        default: "Thank you!",
      },
      subheader: {
        default: "We appreciate your feedback.",
      },
      buttonLink: "https://formbricks.com",
      buttonLabel: { default: "Create your own Survey" },
    },
  ],
  hiddenFields: {
    enabled: true,
    fieldIds: [],
  },
  displayOption: "displayOnce",
  recontactDays: null,
  displayLimit: null,
  autoClose: null,
  runOnDate: null,
  closeOnDate: null,
  delay: 0,
  displayPercentage: null,
  autoComplete: null,
  isVerifyEmailEnabled: false,
  projectOverwrites: null,
  styling: null,
  surveyClosedMessage: null,
  singleUse: {
    enabled: false,
    isEncrypted: true,
  },
  pin: null,
  resultShareKey: null,
  triggers: [],
  languages: [],
  segment: [],
  showLanguageSwitch: null,
} as unknown as TSurvey;
