import { TResponse } from "@formbricks/types/responses";
import {
  TSurvey,
  TSurveyContactInfoQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";

export const mockEndingId1 = "mpkt4n5krsv2ulqetle7b9e7";
export const mockEndingId2 = "ge0h63htnmgq6kwx1suh9cyi";

export const mockResponseEmailFollowUp: TSurvey["followUps"][number] = {
  id: "cm9gpuazd0002192z67olbfdt",
  createdAt: new Date(),
  updatedAt: new Date(),
  surveyId: "cm9gptbhg0000192zceq9ayuc",
  name: "nice follow up",
  trigger: {
    type: "response",
    properties: null,
  },
  action: {
    type: "send-email",
    properties: {
      to: "vjniuob08ggl8dewl0hwed41",
      body: '<p class="fb-editor-paragraph"><span>Hey 👋</span><br><br><span>Thanks for taking the time to respond, we will be in touch shortly.</span><br><br><span>Have a great day!</span></p>',
      from: "noreply@example.com",
      replyTo: ["test@user.com"],
      subject: "Thanks for your answers!‌‌‍‍‌‌‌‍‌‌‌‍‍‌‌‌‌‌‌‌‍‍‍‌‌‍‌‌‌‍‍‌‍‌‌‌‌‌‌‌‍‌‍‌‌",
      attachResponseData: true,
    },
  },
};

export const mockEndingFollowUp: TSurvey["followUps"][number] = {
  id: "j0g23cue6eih6xs5m0m4cj50",
  createdAt: new Date(),
  updatedAt: new Date(),
  surveyId: "cm9gptbhg0000192zceq9ayuc",
  name: "nice follow up",
  trigger: {
    type: "endings",
    properties: {
      endingIds: [mockEndingId1],
    },
  },
  action: {
    type: "send-email",
    properties: {
      to: "vjniuob08ggl8dewl0hwed41",
      body: '<p class="fb-editor-paragraph"><span>Hey 👋</span><br><br><span>Thanks for taking the time to respond, we will be in touch shortly.</span><br><br><span>Have a great day!</span></p>',
      from: "noreply@example.com",
      replyTo: ["test@user.com"],
      subject: "Thanks for your answers!‌‌‍‍‌‌‌‍‌‌‌‍‍‌‌‌‌‌‌‌‍‍‍‌‌‍‌‌‌‍‍‌‍‌‌‌‌‌‌‌‍‌‍‌‌",
      attachResponseData: true,
    },
  },
};

export const mockDirectEmailFollowUp: TSurvey["followUps"][number] = {
  id: "yyc5sq1fqofrsyw4viuypeku",
  createdAt: new Date(),
  updatedAt: new Date(),
  surveyId: "cm9gptbhg0000192zceq9ayuc",
  name: "nice follow up 1",
  trigger: {
    type: "response",
    properties: null,
  },
  action: {
    type: "send-email",
    properties: {
      to: "direct@email.com",
      body: '<p class="fb-editor-paragraph"><span>Hey 👋</span><br><br><span>Thanks for taking the time to respond, we will be in touch shortly.</span><br><br><span>Have a great day!</span></p>',
      from: "noreply@example.com",
      replyTo: ["test@user.com"],
      subject: "Thanks for your answers!‌‌‍‍‌‌‌‍‌‌‌‍‍‌‌‌‌‌‌‌‍‍‍‌‌‍‌‌‌‍‍‌‍‌‌‌‌‌‌‌‍‌‍‌‌",
      attachResponseData: true,
    },
  },
};

export const mockFollowUps: TSurvey["followUps"] = [mockDirectEmailFollowUp, mockResponseEmailFollowUp];

export const mockSurvey: TSurvey = {
  id: "cm9gptbhg0000192zceq9ayuc",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Start from scratch‌‌‍‍‌‍‍‌‌‌‌‍‍‍‌‌‌‌‌‌‌‌‍‌‍‌‌",
  type: "link",
  environmentId: "cm98djl8e000919hpzi6a80zp",
  createdBy: "cm98dg3xm000019hpubj39vfi",
  status: "inProgress",
  welcomeCard: {
    html: {
      default: "Thanks for providing your feedback - let's go!‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‌‍‌‌‌‌‌‍‌‍‌‌",
    },
    enabled: false,
    headline: {
      default: "Welcome!‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‌‌‌‌‌‌‌‍‌‍‌‌",
    },
    buttonLabel: {
      default: "Next‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‍‌‌‌‌‌‌‍‌‍‌‌",
    },
    timeToFinish: false,
    showResponseCount: false,
  },
  questions: [
    {
      id: "vjniuob08ggl8dewl0hwed41",
      type: "openText" as TSurveyQuestionTypeEnum.OpenText,
      headline: {
        default: "What would you like to know?‌‌‍‍‌‍‍‍‌‌‌‍‍‌‍‍‌‌‌‌‌‌‍‌‍‌‌",
      },
      required: true,
      charLimit: {},
      inputType: "email",
      longAnswer: false,
      buttonLabel: {
        default: "Next‌‌‍‍‌‍‍‍‌‌‌‍‍‍‌‌‌‌‌‌‌‌‍‌‍‌‌",
      },
      placeholder: {
        default: "example@email.com",
      },
    },
  ],
  endings: [
    {
      id: "gt1yoaeb5a3istszxqbl08mk",
      type: "endScreen",
      headline: {
        default: "Thank you!‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‍‍‌‌‌‌‌‍‌‍‌‌",
      },
      subheader: {
        default: "We appreciate your feedback.‌‌‍‍‌‍‍‍‌‌‌‍‍‌‍‌‌‌‌‌‌‌‍‌‍‌‌",
      },
      buttonLink: "https://formbricks.com",
      buttonLabel: {
        default: "Create your own Survey‌‌‍‍‌‍‍‍‌‌‌‍‍‌‍‌‍‌‌‌‌‌‍‌‍‌‌",
      },
    },
  ],
  hiddenFields: {
    enabled: true,
    fieldIds: [],
  },
  variables: [],
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
  isSingleResponsePerEmailEnabled: false,
  isBackButtonHidden: false,
  recaptcha: null,
  projectOverwrites: null,
  styling: null,
  surveyClosedMessage: null,
  singleUse: {
    enabled: false,
    isEncrypted: true,
  },
  pin: null,
  resultShareKey: null,
  showLanguageSwitch: null,
  languages: [],
  triggers: [],
  segment: null,
  followUps: mockFollowUps,
};

export const mockContactQuestion: TSurveyContactInfoQuestion = {
  id: "zyoobxyolyqj17bt1i4ofr37",
  type: TSurveyQuestionTypeEnum.ContactInfo,
  email: {
    show: true,
    required: true,
    placeholder: {
      default: "Email",
    },
  },
  phone: {
    show: true,
    required: true,
    placeholder: {
      default: "Phone",
    },
  },
  company: {
    show: true,
    required: true,
    placeholder: {
      default: "Company",
    },
  },
  headline: {
    default: "Contact Question",
  },
  lastName: {
    show: true,
    required: true,
    placeholder: {
      default: "Last Name",
    },
  },
  required: true,
  firstName: {
    show: true,
    required: true,
    placeholder: {
      default: "First Name",
    },
  },
  buttonLabel: {
    default: "Next‌‌‍‍‌‌‌‍‌‌‌‍‍‌‌‌‍‌‌‌‍‍‍‌‌‌‌‌‌‌‌‍‌‍‌‌",
  },
  backButtonLabel: {
    default: "Back‌‌‍‍‌‌‌‍‌‌‌‍‍‌‌‌‍‌‌‌‍‍‍‌‌‍‌‌‌‌‌‍‌‍‌‌",
  },
};

export const mockContactEmailFollowUp: TSurvey["followUps"][number] = {
  ...mockResponseEmailFollowUp,
  action: {
    ...mockResponseEmailFollowUp.action,
    properties: {
      ...mockResponseEmailFollowUp.action.properties,
      to: mockContactQuestion.id,
    },
  },
};

export const mockSurveyWithContactQuestion: TSurvey = {
  ...mockSurvey,
  questions: [mockContactQuestion],
  followUps: [mockContactEmailFollowUp],
};

export const mockResponse: TResponse = {
  id: "response1",
  surveyId: "survey1",
  createdAt: new Date(),
  updatedAt: new Date(),
  variables: {},
  language: "en",
  data: {
    ["vjniuob08ggl8dewl0hwed41"]: "test@example.com",
  },
  contact: null,
  contactAttributes: {},
  meta: {},
  finished: true,
  notes: [],
  singleUseId: null,
  tags: [],
  displayId: null,
};

export const mockResponseWithContactQuestion: TResponse = {
  ...mockResponse,
  data: {
    zyoobxyolyqj17bt1i4ofr37: ["test", "user1", "test@user1.com", "99999999999", "sampleCompany"],
  },
};
