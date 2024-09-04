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
  isVerifyEmailEnabled: true,
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
