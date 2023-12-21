import { Prisma } from "@prisma/client";

import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TPerson } from "@formbricks/types/people";
// import { TDisplay } from "@formbricks/types/displays";
import { TProduct } from "@formbricks/types/product";
import {
  TSurvey,
  TSurveyInput,
  TSurveyQuestion,
  TSurveyQuestionType,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys";

import { selectSurvey } from "../service";

export const mockEnvironmentId = "ars2tjk8hsi8oqk1uac00mo8";
export const mockSurveyId = "ars2tjk8hsi8oqk1uac00mo7";
export const mockAttributeClassId = "ars2tjk8hsi8oqk1uac00mo6";

type SurveyMock = Prisma.SurveyGetPayload<{
  include: typeof selectSurvey;
}>;

export const mockActionClass: TActionClass = {
  id: mockSurveyId,
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "test",
  type: "code",
  environmentId: mockEnvironmentId,
  description: "never",
  noCodeConfig: null,
};

export const mockAttributeClass: TAttributeClass = {
  id: mockSurveyId,
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "test",
  type: "code",
  environmentId: mockEnvironmentId,
  description: "never",
  archived: false,
};

// export const mockAttributeFilter: TSurveyAttributeFilter = {
//   attributeClassId: mockAttributeClassId,
//   value: "test",
//   condition: "equals",
// };

// export const mockAttributeFilterFromDb = {
//   id: mockAttributeClassId,
//   attributeClassId: mockAttributeClassId,
//   value: "test",
//   condition: "equals",
// };

const mockQuestion: TSurveyQuestion = {
  id: "my-question-id",
  type: TSurveyQuestionType.OpenText,
  headline: "Question Text",
  required: false,
  inputType: "text",
};

const mockwelcomeCard: TSurveyWelcomeCard = {
  enabled: false,
  headline: "My welcome card",
  timeToFinish: false,
  showResponseCount: false,
};

export const mockCreateSurveyInput: TSurveyInput = {
  name: "test",
  type: "web",
  status: "inProgress",
  displayOption: "displayOnce",
  autoClose: undefined,
  redirectUrl: undefined,
  recontactDays: undefined,
  welcomeCard: mockwelcomeCard,
  questions: [mockQuestion],
  thankYouCard: {
    enabled: false,
  },
  hiddenFields: {
    enabled: false,
  },
  delay: 0,
  autoComplete: undefined,
  closeOnDate: undefined,
  surveyClosedMessage: {
    enabled: false,
  },
  verifyEmail: undefined,
  attributeFilters: [],
  triggers: [mockActionClass.name],
};

export const surveyMockOutput: SurveyMock = {
  id: mockSurveyId,
  createdAt: new Date(),
  updatedAt: new Date(),
  environmentId: mockEnvironmentId,
  attributeFilters: [],
  name: "test",
  type: "web",
  status: "inProgress",
  displayOption: "displayOnce",
  autoClose: null,
  delay: 0,
  autoComplete: null,
  closeOnDate: null,
  redirectUrl: null,
  recontactDays: null,
  welcomeCard: mockwelcomeCard,
  questions: [mockQuestion],
  thankYouCard: {
    enabled: false,
  },
  hiddenFields: {
    enabled: false,
  },
  triggers: [{ actionClass: mockActionClass }],
  surveyClosedMessage: {
    enabled: false,
  },
  productOverwrites: null,
  singleUse: null,
  styling: null,
  verifyEmail: null,
  pin: null,
};

export const mockSurveyToBeUpdated: TSurvey = {
  id: mockSurveyId,
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "test",
  type: "web",
  environmentId: mockEnvironmentId,
  status: "inProgress",
  attributeFilters: [],
  displayOption: "displayOnce",
  autoClose: null,
  triggers: [mockActionClass.name],
  redirectUrl: null,
  recontactDays: null,
  welcomeCard: mockwelcomeCard,
  questions: [mockQuestion],
  thankYouCard: {
    enabled: false,
  },
  hiddenFields: {
    enabled: false,
  },
  delay: 0,
  autoComplete: null,
  closeOnDate: null,
  productOverwrites: null,
  styling: null,
  surveyClosedMessage: null,
  singleUse: null,
  verifyEmail: null,
  pin: null,
};

export const surveyMockOutputTransformed = {
  ...surveyMockOutput,
  triggers: surveyMockOutput.triggers.map((trigger) => trigger.actionClass.name),
};

export const mockProduct: TProduct = {
  id: "ars2tjk8hsi8oqk1uac00mo8",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "test",
  teamId: "ars2tjk8hsi8oqk1uac00mo8",
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

export const mockCreateDisplay = {
  id: "ars2tjk8hsi8oqk1uac00mo8",
  createdAt: new Date(),
  updatedAt: new Date(),
  surveyId: "ars2tjk8hsi8oqk1uac00mo8",
  personId: null,
  responseId: null,
  status: null,
};

export const mockPerson: TPerson = {
  id: "ars2tjk8hsi8oqk1uac00mo8",
  createdAt: new Date(),
  updatedAt: new Date(),
  environmentId: mockEnvironmentId,
  userId: "ars2tjk8hsi8oqk1uac00mo8",
  attributes: { test: "value" },
};
