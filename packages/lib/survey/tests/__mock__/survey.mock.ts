import { Prisma } from "@prisma/client";

import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TProduct } from "@formbricks/types/product";
import {
  TSurvey,
  TSurveyInput,
  TSurveyQuestion,
  TSurveyQuestionType,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys";
import { TTeam } from "@formbricks/types/teams";
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

export const mockProduct: TProduct = {
  id: mockId,
  createdAt: currentDate,
  updatedAt: currentDate,
  name: "mock Product",
  teamId: mockId,
  brandColor: "#000000",
  highlightBorderColor: "#000000",
  recontactDays: 0,
  linkSurveyBranding: false,
  inAppSurveyBranding: false,
  placement: "bottomRight",
  clickOutsideClose: false,
  darkOverlay: false,
  environments: [],
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

export const mockUser: TUser = {
  id: mockId,
  name: "mock User",
  email: "test@unit.com",
  emailVerified: currentDate,
  imageUrl: "https://www.google.com",
  createdAt: currentDate,
  updatedAt: currentDate,
  onboardingCompleted: true,
  twoFactorEnabled: false,
  identityProvider: "google",
  objective: "improve_user_retention",
  notificationSettings: {
    alert: {},
    weeklySummary: {},
    unsubscribedTeamIds: [],
  },
};

export const mockPerson: Prisma.PersonGetPayload<{
  include: typeof selectPerson;
}> = {
  id: mockId,
  userId: mockId,
  attributes: [
    {
      value: "value",
      attributeClass: {
        id: mockId,
        name: "test",
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
  type: TSurveyQuestionType.OpenText,
  headline: "Question Text",
  required: false,
  inputType: "text",
};

const mockWelcomeCard: TSurveyWelcomeCard = {
  enabled: false,
  headline: "My welcome card",
  timeToFinish: false,
  showResponseCount: false,
};

const baseSurveyProperties = {
  id: mockId,
  name: "Mock Survey",
  autoClose: 10,
  delay: 0,
  autoComplete: 7,
  closeOnDate: currentDate,
  redirectUrl: "http://github.com/formbricks/formbricks",
  recontactDays: 3,
  welcomeCard: mockWelcomeCard,
  questions: [mockQuestion],
  thankYouCard: { enabled: false },
  hiddenFields: { enabled: false },
  surveyClosedMessage: {
    enabled: false,
  },
  verifyEmail: {
    name: "verifyEmail",
    subheading: "please verify your email",
  },
  attributeFilters: [],
  ...commonMockProperties,
};

export const mockTeamOutput: TTeam = {
  id: mockId,
  name: "mock Team",
  createdAt: currentDate,
  updatedAt: currentDate,
  billing: {
    stripeCustomerId: null,
    features: {
      inAppSurvey: {
        status: "inactive",
        unlimited: false,
      },
      linkSurvey: {
        status: "inactive",
        unlimited: false,
      },
      userTargeting: {
        status: "inactive",
        unlimited: false,
      },
    },
  },
};

export const mockSurveyOutput: SurveyMock = {
  type: "web",
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
  ...baseSurveyProperties,
};

export const createSurveyInput: TSurveyInput = {
  type: "web",
  status: "inProgress",
  displayOption: "respondMultiple",
  triggers: [mockActionClass.name],
  ...baseSurveyProperties,
};

export const updateSurveyInput: TSurvey = {
  type: "web",
  status: "inProgress",
  displayOption: "respondMultiple",
  triggers: [mockActionClass.name],
  productOverwrites: null,
  styling: null,
  singleUse: null,
  displayPercentage: null,
  createdBy: null,
  pin: null,
  resultShareKey: null,
  segment: null,
  inlineTriggers: null,
  ...commonMockProperties,
  ...baseSurveyProperties,
};

export const mockTransformedSurveyOutput = {
  ...mockSurveyOutput,
  triggers: mockSurveyOutput.triggers.map((trigger) => trigger.actionClass.name),
};
