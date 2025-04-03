import { mockSurveyLanguages } from "survey/tests/__mock__/survey.mock";
import {
  TSurvey,
  TSurveyCTAQuestion,
  TSurveyCalQuestion,
  TSurveyConsentQuestion,
  TSurveyDateQuestion,
  TSurveyEndScreenCard,
  TSurveyFileUploadQuestion,
  TSurveyMultipleChoiceQuestion,
  TSurveyNPSQuestion,
  TSurveyOpenTextQuestion,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestionTypeEnum,
  TSurveyRatingQuestion,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";

export const mockWelcomeCard: TSurveyWelcomeCard = {
  html: {
    default:
      '<p class="fb-editor-paragraph"><br></p><p class="fb-editor-paragraph" dir="ltr"><span style="white-space: pre-wrap;">Thanks for providing your feedback - let\'s go!</span></p>',
  },
  enabled: true,
  headline: {
    default: "Welcome!",
  },
  timeToFinish: false,
  showResponseCount: false,
} as unknown as TSurveyWelcomeCard;

export const mockOpenTextQuestion: TSurveyOpenTextQuestion = {
  id: "lqht9sj5s6andjkmr9k1n54q",
  type: TSurveyQuestionTypeEnum.OpenText,
  headline: {
    default: "What would you like to know?",
  },

  required: true,
  inputType: "text",
  subheader: {
    default: "This is an example survey.",
  },
  placeholder: {
    default: "Type your answer here...",
  },
  charLimit: {},
};

export const mockSingleSelectQuestion: TSurveyMultipleChoiceQuestion = {
  id: "mvqx8t90np6isb6oel9eamzc",
  type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
  choices: [
    {
      id: "r52sul8ag19upaicit0fyqzo",
      label: {
        default: "Eat the cake 🍰",
      },
    },
    {
      id: "es0gc12hrpk12x13rlqm59rg",
      label: {
        default: "Have the cake 🎂",
      },
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
};

export const mockMultiSelectQuestion: TSurveyMultipleChoiceQuestion = {
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
  id: "cpydxgsmjg8q9iwfa8wj4ida",
  type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
  isDraft: true,
};

export const mockPictureSelectQuestion: TSurveyPictureSelectionQuestion = {
  required: true,
  headline: {
    default: "Which is the cutest puppy?",
  },
  subheader: {
    default: "You can also pick both.",
  },
  allowMulti: true,
  choices: [
    {
      id: "bdz471uu4ut7ox38b5aprzkq",
      imageUrl: "https://formbricks-cdn.s3.eu-central-1.amazonaws.com/puppy-1-small.jpg",
    },
    {
      id: "t10v5rkqw32si3orlkt9mrdw",
      imageUrl: "https://formbricks-cdn.s3.eu-central-1.amazonaws.com/puppy-2-small.jpg",
    },
  ],
  id: "a8monbe8hq0mivh3irfhd3i5",
  type: TSurveyQuestionTypeEnum.PictureSelection,
  isDraft: true,
};

export const mockRatingQuestion: TSurveyRatingQuestion = {
  required: true,
  headline: {
    default: "How would you rate My Product",
  },
  subheader: {
    default: "Don't worry, be honest.",
  },
  isColorCodingEnabled: false,
  scale: "star",
  range: 5,
  lowerLabel: {
    default: "Not good",
  },
  upperLabel: {
    default: "Very good",
  },
  id: "waldsboahjtgqhg5p18d1awz",
  type: TSurveyQuestionTypeEnum.Rating,
  isDraft: true,
};

export const mockNpsQuestion: TSurveyNPSQuestion = {
  required: true,
  headline: {
    default: "How likely are you to recommend My Product to a friend or colleague?",
  },
  lowerLabel: {
    default: "Not at all likely",
  },
  upperLabel: {
    default: "Extremely likely",
  },
  id: "m9pemgdih2p4exvkmeeqq6jf",
  type: TSurveyQuestionTypeEnum.NPS,
  isDraft: true,
  isColorCodingEnabled: false,
};

export const mockCtaQuestion: TSurveyCTAQuestion = {
  required: true,
  headline: {
    default: "You are one of our power users!",
  },
  buttonLabel: {
    default: "Book interview",
  },
  buttonExternal: false,
  dismissButtonLabel: {
    default: "Skip",
  },
  id: "gwn15urom4ffnhfimwbz3vgc",
  type: TSurveyQuestionTypeEnum.CTA,
  isDraft: true,
};

export const mockConsentQuestion: TSurveyConsentQuestion = {
  required: true,
  headline: {
    default: "Terms and Conditions",
  },
  label: {
    default: "I agree to the terms and conditions",
  },
  id: "av561aoif3i2hjlsl6krnsfm",
  type: TSurveyQuestionTypeEnum.Consent,
  isDraft: true,
};

export const mockDateQuestion: TSurveyDateQuestion = {
  required: true,
  headline: {
    default: "When is your birthday?",
  },
  format: "M-d-y",
  id: "ts2f6v2oo9jfmfli9kk6lki9",
  type: TSurveyQuestionTypeEnum.Date,
  isDraft: true,
};

export const mockFileUploadQuestion: TSurveyFileUploadQuestion = {
  required: true,
  headline: {
    default: "File Upload",
  },
  allowMultipleFiles: false,
  id: "ozzxo2jj1s6mj56c79q8pbef",
  type: TSurveyQuestionTypeEnum.FileUpload,
  isDraft: true,
};

export const mockCalQuestion: TSurveyCalQuestion = {
  required: true,
  headline: {
    default: "Schedule a call with me",
  },
  buttonLabel: {
    default: "Skip",
  },
  calUserName: "rick/get-rick-rolled",
  calHost: "cal.com",
  id: "o3bnux6p42u9ew9d02l14r26",
  type: TSurveyQuestionTypeEnum.Cal,
  isDraft: true,
};

export const mockEndings = [
  {
    id: "umyknohldc7w26ocjdhaa62c",
    type: "endScreen",
    headline: {
      default: "Thank you!",
    },
    subheader: {
      default: "We appreciate your feedback.",
    },
    buttonLink: "https://formbricks.com",
    buttonLabel: { default: "Create your own Survey" },
  } as TSurveyEndScreenCard,
];

export const mockSurvey: TSurvey = {
  id: "eddb4fbgaml6z52eomejy77w",
  createdAt: new Date("2024-02-06T20:12:03.521Z"),
  updatedAt: new Date("2024-02-06T20:12:03.521Z"),
  name: "New Survey",
  type: "link",
  environmentId: "envId",
  createdBy: "creatorId",
  status: "draft",
  welcomeCard: mockWelcomeCard,
  questions: [
    mockOpenTextQuestion,
    mockSingleSelectQuestion,
    mockMultiSelectQuestion,
    mockPictureSelectQuestion,
    mockRatingQuestion,
    mockNpsQuestion,
    mockCtaQuestion,
    mockConsentQuestion,
    mockDateQuestion,
    mockFileUploadQuestion,
    mockCalQuestion,
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
  languages: mockSurveyLanguages,
  segment: null,
  showLanguageSwitch: null,
} as unknown as TSurvey;

export const mockTranslatedWelcomeCard = {
  html: {
    default:
      '<p class="fb-editor-paragraph"><br></p><p class="fb-editor-paragraph" dir="ltr"><span style="white-space: pre-wrap;">Thanks for providing your feedback - let\'s go!</span></p>',
    de: "",
  },
  enabled: true,
  headline: { default: "Welcome!", de: "" },
  timeToFinish: false,
  showResponseCount: false,
};

export const mockLegacyWelcomeCard = {
  html: '<p class="fb-editor-paragraph"><br></p><p class="fb-editor-paragraph" dir="ltr"><span style="white-space: pre-wrap;">Thanks for providing your feedback - let\'s go!</span></p>',
  enabled: true,
  headline: "Welcome!",
  timeToFinish: false,
  showResponseCount: false,
};

export const mockTranslatedOpenTextQuestion = {
  ...mockOpenTextQuestion,
  headline: { default: "What would you like to know?", de: "" },
  subheader: { default: "This is an example survey.", de: "" },
  placeholder: { default: "Type your answer here...", de: "" },
};

export const mockLegacyOpenTextQuestion = {
  ...mockOpenTextQuestion,
  headline: "What would you like to know?",
  subheader: "This is an example survey.",
  placeholder: "Type your answer here...",
};

export const mockTranslatedSingleSelectQuestion = {
  ...mockSingleSelectQuestion,
  headline: { default: "What do you do?", de: "" },
  subheader: { default: "Can't do both.", de: "" },
  choices: mockSingleSelectQuestion.choices.map((choice) => ({
    ...choice,
    label: { default: choice.label.default, de: "" },
  })),
  otherOptionPlaceholder: undefined,
};

export const mockLegacySingleSelectQuestion = {
  ...mockSingleSelectQuestion,
  headline: "What do you do?",
  subheader: "Can't do both.",
  otherOptionPlaceholder: undefined,
  choices: mockSingleSelectQuestion.choices.map((choice) => ({
    ...choice,
    label: choice.label.default,
  })),
};

export const mockTranslatedMultiSelectQuestion = {
  ...mockMultiSelectQuestion,
  headline: { default: "What's important on vacay?", de: "" },
  choices: mockMultiSelectQuestion.choices.map((choice) => ({
    ...choice,
    label: { default: choice.label.default, de: "" },
  })),
  otherOptionPlaceholder: undefined,
};

export const mockLegacyMultiSelectQuestion = {
  ...mockMultiSelectQuestion,
  headline: "What's important on vacay?",
  otherOptionPlaceholder: undefined,
  choices: mockMultiSelectQuestion.choices.map((choice) => ({
    ...choice,
    label: choice.label.default,
  })),
};

export const mockTranslatedPictureSelectQuestion = {
  ...mockPictureSelectQuestion,
  headline: { default: "Which is the cutest puppy?", de: "" },
  subheader: { default: "You can also pick both.", de: "" },
};
export const mockLegacyPictureSelectQuestion = {
  ...mockPictureSelectQuestion,
  headline: "Which is the cutest puppy?",
  subheader: "You can also pick both.",
};

export const mockTranslatedRatingQuestion = {
  ...mockRatingQuestion,
  headline: { default: "How would you rate My Product", de: "" },
  subheader: { default: "Don't worry, be honest.", de: "" },
  lowerLabel: { default: "Not good", de: "" },
  upperLabel: { default: "Very good", de: "" },
  isColorCodingEnabled: false,
};

export const mockLegacyRatingQuestion = {
  ...mockRatingQuestion,
  headline: "How would you rate My Product",
  subheader: "Don't worry, be honest.",
  lowerLabel: "Not good",
  upperLabel: "Very good",
};

export const mockTranslatedNpsQuestion = {
  ...mockNpsQuestion,
  headline: {
    default: "How likely are you to recommend My Product to a friend or colleague?",
    de: "",
  },
  lowerLabel: { default: "Not at all likely", de: "" },
  upperLabel: { default: "Extremely likely", de: "" },
  isColorCodingEnabled: false,
};

export const mockLegacyNpsQuestion = {
  ...mockNpsQuestion,
  headline: "How likely are you to recommend My Product to a friend or colleague?",
  lowerLabel: "Not at all likely",
  upperLabel: "Extremely likely",
};

export const mockTranslatedCtaQuestion = {
  ...mockCtaQuestion,
  headline: { default: "You are one of our power users!", de: "" },
  buttonLabel: { default: "Book interview", de: "" },
  dismissButtonLabel: { default: "Skip", de: "" },
};

export const mockLegacyCtaQuestion = {
  ...mockCtaQuestion,
  headline: "You are one of our power users!",
  buttonLabel: "Book interview",
  dismissButtonLabel: "Skip",
};

export const mockTranslatedConsentQuestion = {
  ...mockConsentQuestion,
  headline: { default: "Terms and Conditions", de: "" },
  label: { default: "I agree to the terms and conditions", de: "" },
};

export const mockLegacyConsentQuestion = {
  ...mockConsentQuestion,
  headline: "Terms and Conditions",
  label: "I agree to the terms and conditions",
};

export const mockTranslatedDateQuestion = {
  ...mockDateQuestion,
  headline: { default: "When is your birthday?", de: "" },
};

export const mockLegacyDateQuestion = {
  ...mockDateQuestion,
  headline: "When is your birthday?",
};

export const mockTranslatedFileUploadQuestion = {
  ...mockFileUploadQuestion,
  headline: { default: "File Upload", de: "" },
};

export const mockLegacyFileUploadQuestion = {
  ...mockFileUploadQuestion,
  headline: "File Upload",
};

export const mockTranslatedCalQuestion = {
  ...mockCalQuestion,
  headline: { default: "Schedule a call with me", de: "" },
  buttonLabel: { default: "Skip", de: "" },
};

export const mockLegacyCalQuestion = {
  ...mockCalQuestion,
  headline: "Schedule a call with me",
  buttonLabel: "Skip",
};

export const mockTranslatedEndings = [
  {
    ...mockEndings[0],
    headline: { default: "Thank you!", de: "" },
    subheader: { default: "We appreciate your feedback.", de: "" },
    buttonLabel: { default: "Create your own Survey", de: "" },
  },
];

export const mockLegacyThankYouCard = {
  buttonLink: "https://formbricks.com",
  enabled: true,
  headline: "Thank you!",
  subheader: "We appreciate your feedback.",
  buttonLabel: "Create your own Survey",
};
