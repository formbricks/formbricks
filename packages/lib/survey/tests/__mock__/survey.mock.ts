import { Prisma } from "@prisma/client";
import { TActionClass } from "@formbricks/types/action-classes";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganization } from "@formbricks/types/organizations";
import { TProduct } from "@formbricks/types/product";
import {
  TSurvey,
  TSurveyCreateInput,
  TSurveyLanguage,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { selectPerson } from "../../../person/service";
import { selectSurvey } from "../../service";

const currentDate = new Date();
const fourDaysAgo = new Date();
fourDaysAgo.setDate(currentDate.getDate() - 4);

export const mockId = "ars2tjk8hsi8oqk1uac00mo8";
const commonMockProperties = {
  createdAt: currentDate,
  updatedAt: currentDate,
  environmentId: mockId,
};

type SurveyMock = Prisma.SurveyGetPayload<{
  include: typeof selectSurvey;
}>;

export const mockSurveyLanguages: TSurveyLanguage[] = [
  {
    default: true,
    enabled: true,
    language: {
      id: "rp2di001zicbm3mk8je1ue9u",
      code: "en",
      alias: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
  {
    default: false,
    enabled: true,
    language: {
      id: "cuuxfzls09sjkueg6lm6n7i0",
      code: "de",
      alias: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
];

export const mockProduct: TProduct = {
  id: mockId,
  createdAt: currentDate,
  updatedAt: currentDate,
  name: "mock Product",
  organizationId: mockId,
  brandColor: "#000000",
  highlightBorderColor: "#000000",
  recontactDays: 0,
  displayLimit: 0,
  linkSurveyBranding: false,
  inAppSurveyBranding: false,
  placement: "bottomRight",
  clickOutsideClose: false,
  darkOverlay: false,
  environments: [],
  languages: [],
  styling: {
    allowStyleOverwrite: false,
  },
};

export const mockDisplay = {
  id: mockId,
  createdAt: fourDaysAgo,
  updatedAt: fourDaysAgo,
  surveyId: mockId,
  personId: null,
  responseId: null,
  status: null,
};

export const mockEnvironment: TEnvironment = {
  id: mockId,
  createdAt: currentDate,
  updatedAt: currentDate,
  type: "production",
  productId: mockId,
  appSetupCompleted: false,
  websiteSetupCompleted: false,
};

export const mockUser: TUser = {
  id: mockId,
  name: "mock User",
  email: "test@unit.com",
  emailVerified: currentDate,
  imageUrl: "https://www.google.com",
  createdAt: currentDate,
  updatedAt: currentDate,
  twoFactorEnabled: false,
  identityProvider: "google",
  objective: "improve_user_retention",
  notificationSettings: {
    alert: {},
    weeklySummary: {},
    unsubscribedOrganizationIds: [],
  },
  role: "other",
};

export const mockPrismaPerson: Prisma.PersonGetPayload<{
  include: typeof selectPerson;
}> = {
  id: mockId,
  userId: mockId,
  attributes: [
    {
      value: "de",
      attributeClass: {
        id: mockId,
        name: "language",
      },
    },
  ],
  ...commonMockProperties,
};

export const mockActionClass: TActionClass = {
  id: mockId,
  name: "mock action class",
  type: "code",
  description: "mock desc",
  noCodeConfig: null,
  key: "mock action class",
  ...commonMockProperties,
};

export const mockAttributeClass: TAttributeClass = {
  id: mockId,
  name: "mock attribute class",
  type: "code",
  description: "mock action class",
  archived: false,
  ...commonMockProperties,
};

const mockQuestion: TSurveyQuestion = {
  id: mockId,
  type: TSurveyQuestionTypeEnum.OpenText,
  headline: { default: "Question Text", de: "Fragetext" },
  required: false,
  inputType: "text",
};

const mockWelcomeCard: TSurveyWelcomeCard = {
  enabled: false,
  headline: { default: "My welcome card", de: "Meine Willkommenskarte" },
  timeToFinish: false,
  showResponseCount: false,
};

const baseSurveyProperties = {
  id: mockId,
  name: "Mock Survey",
  autoClose: 10,
  delay: 0,
  autoComplete: 7,
  runOnDate: null,
  closeOnDate: currentDate,
  redirectUrl: "http://github.com/formbricks/formbricks",
  recontactDays: 3,
  displayLimit: 3,
  welcomeCard: mockWelcomeCard,
  questions: [mockQuestion],
  endings: [
    {
      id: "umyknohldc7w26ocjdhaa62c",
      type: "endScreen",
      headline: { default: "Thank You!", de: "Danke!" },
    },
  ],
  hiddenFields: { enabled: false },
  surveyClosedMessage: {
    enabled: false,
  },
  isVerifyEmailEnabled: false,
  isSingleResponsePerEmailEnabled: false,
  attributeFilters: [],
  ...commonMockProperties,
};

export const mockOrganizationOutput: TOrganization = {
  id: mockId,
  name: "mock Organization",
  createdAt: currentDate,
  updatedAt: currentDate,
  billing: {
    stripeCustomerId: null,
    plan: "free",
    period: "monthly",
    limits: {
      monthly: {
        responses: 500,
        miu: 1000,
      },
    },
    periodStart: currentDate,
  },
};

export const mockSyncSurveyOutput: SurveyMock = {
  type: "app",
  status: "inProgress",
  displayOption: "respondMultiple",
  triggers: [{ actionClass: mockActionClass }],
  productOverwrites: null,
  singleUse: null,
  styling: null,
  displayPercentage: null,
  createdBy: null,
  pin: null,
  segment: null,
  segmentId: null,
  resultShareKey: null,
  inlineTriggers: null,
  languages: mockSurveyLanguages,
  ...baseSurveyProperties,
};

export const mockSurveyOutput: SurveyMock = {
  type: "website",
  status: "inProgress",
  displayOption: "respondMultiple",
  triggers: [{ actionClass: mockActionClass }],
  productOverwrites: null,
  singleUse: null,
  styling: null,
  displayPercentage: null,
  createdBy: null,
  pin: null,
  segment: null,
  segmentId: null,
  resultShareKey: null,
  inlineTriggers: null,
  languages: mockSurveyLanguages,
  ...baseSurveyProperties,
};

export const createSurveyInput: TSurveyCreateInput = {
  type: "website",
  status: "inProgress",
  displayOption: "respondMultiple",
  triggers: [{ actionClass: mockActionClass }],
  ...baseSurveyProperties,
};

export const updateSurveyInput: TSurvey = {
  type: "website",
  status: "inProgress",
  displayOption: "respondMultiple",
  triggers: [{ actionClass: mockActionClass }],
  productOverwrites: null,
  styling: null,
  singleUse: null,
  displayPercentage: null,
  createdBy: null,
  pin: null,
  resultShareKey: null,
  segment: null,
  languages: [],
  showLanguageSwitch: null,
  variables: [],
  ...commonMockProperties,
  ...baseSurveyProperties,
};

export const mockTransformedSurveyOutput = {
  ...mockSurveyOutput,
};

export const mockTransformedSyncSurveyOutput = {
  ...mockSyncSurveyOutput,
};

export const mockSurveyWithLogic: TSurvey = {
  ...mockSyncSurveyOutput,
  ...baseSurveyProperties,
  displayPercentage: null,
  segment: null,
  type: "link",
  endings: [],
  hiddenFields: { enabled: true, fieldIds: ["name"] },
  questions: [
    {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      inputType: "text",
      headline: { default: "What is your favorite color?" },
      required: true,
      logic: [
        {
          id: "cdu9vgtmmd9b24l35pp9bodk",
          conditions: {
            id: "d21qg6x5fk65pf592jys5rcz",
            connector: "and",
            conditions: [
              {
                id: "swlje0bsnh6lkyk8vqs13oyr",
                leftOperand: { type: "question", value: "q1" },
                operator: "equals",
                rightOperand: { type: "static", value: "blue" },
              },
            ],
          },
          actions: [],
        },
      ],
    },
    {
      id: "q2",
      type: TSurveyQuestionTypeEnum.OpenText,
      inputType: "text",
      headline: { default: "What is your favorite food?" },
      required: true,
      logic: [
        {
          id: "uwlm6kazj5pbt6licpa1hw5c",
          conditions: {
            id: "cvqxpbjydwktz4f9mvit2i11",
            connector: "and",
            conditions: [
              {
                id: "n74oght3ozqgwm9rifp2fxrr",
                leftOperand: { type: "question", value: "q1" },
                operator: "equals",
                rightOperand: { type: "static", value: "blue" },
              },
              {
                id: "fg4c9dwt9qjy8aba7zxbfdqd",
                leftOperand: { type: "question", value: "q2" },
                operator: "equals",
                rightOperand: { type: "static", value: "pizza" },
              },
            ],
          },
          actions: [],
        },
      ],
    },
    {
      id: "q3",
      type: TSurveyQuestionTypeEnum.OpenText,
      inputType: "text",
      headline: { default: "What is your favorite movie?" },
      required: true,
      logic: [
        {
          id: "dpi3zipezuo1idplztb1abes",
          conditions: {
            id: "h3tp53lf8lri4pjcqc1xz3d8",
            connector: "or",
            conditions: [
              {
                id: "tmj7p9d3kpz1v4mcgpguqytw",
                leftOperand: { type: "question", value: "q2" },
                operator: "equals",
                rightOperand: { type: "static", value: "pizza" },
              },
              {
                id: "rs7v5mmoetff7x8lo1gdsgpr",
                leftOperand: { type: "question", value: "q3" },
                operator: "equals",
                rightOperand: { type: "static", value: "Inception" },
              },
            ],
          },
          actions: [],
        },
      ],
    },
    {
      id: "q4",
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      headline: { default: "Select a number:" },
      choices: [
        { id: "mvedaklp0gxxycprpyhhwen7", label: { default: "lol" } },
        { id: "i7ws8uqyj66q5x086vbqtm8n", label: { default: "lmao" } },
        { id: "cy8hbbr9e2q6ywbfjbzwdsqn", label: { default: "XD" } },
        { id: "sojc5wwxc5gxrnuib30w7t6s", label: { default: "hehe" } },
      ],
      required: true,
      logic: [
        {
          id: "fbim31ttxe1s7qkrjzkj1mtc",
          conditions: {
            id: "db44yagvr140wahafu0n11x6",
            connector: "and",
            conditions: [
              {
                id: "ddhaccfqy7rr3d5jdswl8yl8",
                leftOperand: { type: "variable", value: "siog1dabtpo3l0a3xoxw2922" },
                operator: "equals",
                rightOperand: { type: "question", value: "q4" },
              },
            ],
          },
          actions: [],
        },
      ],
    },
    {
      id: "q5",
      type: TSurveyQuestionTypeEnum.OpenText,
      inputType: "number",
      headline: { default: "Select your age group:" },
      required: true,
      logic: [
        {
          id: "o6n73uq9rysih9mpcbzlehfs",
          conditions: {
            id: "szdkmtz17j9008n4i2d1t040",
            connector: "and",
            conditions: [
              {
                id: "rb223vmzuuzo3ag1bp2m3i69",
                leftOperand: { type: "variable", value: "km1srr55owtn2r7lkoh5ny1u" },
                operator: "isGreaterThan",
                rightOperand: { type: "static", value: 30 },
              },
              {
                id: "ot894j7nwna24i6jo2zpk59o",
                leftOperand: { type: "variable", value: "km1srr55owtn2r7lkoh5ny1u" },
                operator: "isLessThan",
                rightOperand: { type: "question", value: "q5" },
              },
            ],
          },
          actions: [],
        },
      ],
    },
    {
      id: "q6",
      type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
      headline: { default: "Select your age group:" },
      required: true,
      choices: [
        { id: "mvedaklp0gxxycprpyhhwen7", label: { default: "lol" } },
        { id: "i7ws8uqyj66q5x086vbqtm8n", label: { default: "lmao" } },
        { id: "cy8hbbr9e2q6ywbfjbzwdsqn", label: { default: "XD" } },
        { id: "sojc5wwxc5gxrnuib30w7t6s", label: { default: "hehe" } },
      ],
      logic: [
        {
          id: "o6n73uq9rysih9mpcbzlehfs",
          conditions: {
            id: "szdkmtz17j9008n4i2d1t040",
            connector: "and",
            conditions: [
              {
                id: "rb223vmzuuzo3ag1bp2m3i69",
                leftOperand: { type: "question", value: "q6" },
                operator: "includesOneOf",
                rightOperand: {
                  type: "static",
                  value: ["i7ws8uqyj66q5x086vbqtm8n", "cy8hbbr9e2q6ywbfjbzwdsqn"],
                },
              },
              {
                id: "ot894j7nwna24i6jo2zpk59o",
                leftOperand: { type: "question", value: "q1" },
                operator: "doesNotEqual",
                rightOperand: { type: "static", value: "teal" },
              },
              {
                id: "j1appouxk700of7u8m15z625",
                connector: "or",
                conditions: [
                  {
                    id: "gy6xowchkv8bp1qj7ur79jvc",
                    leftOperand: { type: "question", value: "q2" },
                    operator: "doesNotEqual",
                    rightOperand: { type: "static", value: "pizza" },
                  },
                  {
                    id: "vxyccgwsbq34s3l0syom7y2w",
                    leftOperand: { type: "hiddenField", value: "name" },
                    operator: "contains",
                    rightOperand: { type: "question", value: "q2" },
                  },
                ],
              },
              {
                id: "yunz0k9w0xwparogz2n1twoy",
                leftOperand: { type: "question", value: "q3" },
                operator: "doesNotEqual",
                rightOperand: { type: "static", value: "Inception" },
              },
              {
                id: "x2j6qz3z7x9m3q5jz9x7c7v4",
                leftOperand: { type: "variable", value: "siog1dabtpo3l0a3xoxw2922" },
                operator: "endsWith",
                rightOperand: { type: "static", value: "yo" },
              },
            ],
          },
          actions: [],
        },
      ],
    },
  ],
  variables: [
    { id: "siog1dabtpo3l0a3xoxw2922", type: "text", name: "var1", value: "lmao" },
    { id: "km1srr55owtn2r7lkoh5ny1u", type: "number", name: "var2", value: 32 },
  ],
};
