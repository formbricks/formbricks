import {
  TSurvey,
  TSurveyCTAQuestion,
  TSurveyCalQuestion,
  TSurveyConsentQuestion,
  TSurveyDateQuestion,
  TSurveyDisplayOption,
  TSurveyFileUploadQuestion,
  TSurveyMultipleChoiceMultiQuestion,
  TSurveyMultipleChoiceSingleQuestion,
  TSurveyNPSQuestion,
  TSurveyOpenTextQuestion,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestionType,
  TSurveyRatingQuestion,
  TSurveyStatus,
  TSurveyType,
} from "@formbricks/types/surveys";

export const mockWelcomeCard = {
  html: '<p class="fb-editor-paragraph"><br></p><p class="fb-editor-paragraph" dir="ltr"><span style="white-space: pre-wrap;">Thanks for providing your feedback - let\'s go!</span></p>',
  enabled: true,
  headline: "Welcome!",
  timeToFinish: true,
  showResponseCount: false,
};

export const mockOpenTextQuestion: TSurveyOpenTextQuestion = {
  id: "ljlxqvultjvuunrqh8fixd3j",
  type: TSurveyQuestionType.OpenText,
  headline: "What would you like to know?",
  required: true,
  inputType: "text",
  subheader: "This is an example survey.",
  placeholder: "Type your answer here...",
};

export const mockSingleSelectQuestion: TSurveyMultipleChoiceSingleQuestion = {
  id: "mvqx8t90np6isb6oel9eamzc",
  type: TSurveyQuestionType.MultipleChoiceSingle,
  choices: [
    {
      id: "r52sul8ag19upaicit0fyqzo",
      label: "Eat the cake 🍰",
    },
    {
      id: "es0gc12hrpk12x13rlqm59rg",
      label: "Have the cake 🎂",
    },
  ],
  isDraft: true,
  headline: "What do you do?",
  required: true,
  subheader: "Can't do both.",
  shuffleOption: "none",
};

export const mockMultiSelectQuestion: TSurveyMultipleChoiceMultiQuestion = {
  id: "mmpocsyp7y7xn11v8ff65f2y",
  type: TSurveyQuestionType.MultipleChoiceMulti,
  choices: [
    {
      id: "haso0u4ev1rkmp6shhkqbkiw",
      label: "Sun ☀️",
    },
    {
      id: "lo3ge4hwsfs8mxw38xob232l",
      label: "Ocean 🌊",
    },
    {
      id: "m7xknhpqxgeb1b865f9c61xh",
      label: "Palms 🌴",
    },
  ],
  isDraft: true,
  headline: "What's important on vacay?",
  required: true,
  shuffleOption: "none",
};

export const mockPictureSelectQuestion: TSurveyPictureSelectionQuestion = {
  id: "h6zsei27y2ixsq200jfbb65d",
  type: TSurveyQuestionType.PictureSelection,
  choices: [
    {
      id: "c3ykzkv8fn7g9071n6u9guck",
      imageUrl: "https://formbricks-cdn.s3.eu-central-1.amazonaws.com/puppy-1-small.jpg",
    },
    {
      id: "nx5r56j2tfo8ywnpmj9veyek",
      imageUrl: "https://formbricks-cdn.s3.eu-central-1.amazonaws.com/puppy-2-small.jpg",
    },
  ],
  isDraft: true,
  headline: "Which is the cutest puppy?",
  required: true,
  subheader: "You can also pick both.",
  allowMulti: true,
};

export const mockRatingQuestion: TSurveyRatingQuestion = {
  id: "p5d2x9lzftqql86kznn01868",
  type: TSurveyQuestionType.Rating,
  range: 5,
  scale: "star",
  isDraft: true,
  headline: "How would you rate My Product",
  required: true,
  subheader: "Don't worry, be honest.",
  lowerLabel: "Not good",
  upperLabel: "Very good",
};

export const mockNpsQuestion: TSurveyNPSQuestion = {
  id: "mh02j2lta8ulfatk1b7y8xmq",
  type: TSurveyQuestionType.NPS,
  isDraft: true,
  headline: "How likely are you to recommend My Product to a friend or colleague?",
  required: true,
  lowerLabel: "Not at all likely",
  upperLabel: "Extremely likely",
};

export const mockCtaQuestion: TSurveyCTAQuestion = {
  id: "shn6361v3b6ablomuy5coeje",
  html: '<p class="fb-editor-paragraph" dir="ltr"><span style="white-space: pre-wrap;">We would love to talk to you and learn more about how you use our product.</span></p>',
  type: TSurveyQuestionType.CTA,
  isDraft: true,
  headline: "You are one of our power users!",
  required: true,
  buttonLabel: "Book interview",
  buttonExternal: false,
  dismissButtonLabel: "Skip",
};

export const mockConsentQuestion: TSurveyConsentQuestion = {
  id: "a7ds978r8dur153nuq8hiqll",
  html: '<p class="fb-editor-paragraph" dir="ltr"><span style="white-space: pre-wrap;">We would love to talk to you and learn more about how you use our product.</span></p>',
  type: TSurveyQuestionType.Consent,
  label: "I agree to the terms and conditions",
  isDraft: true,
  headline: "Terms and Conditions",
  required: true,
  dismissButtonLabel: "Skip",
};

export const mockDateQuestion: TSurveyDateQuestion = {
  id: "p49e2xt2ro8dx5i1pxxsn8t0",
  type: TSurveyQuestionType.Date,
  format: "M-d-y",
  isDraft: true,
  headline: "When is your birthday?",
  required: true,
};

export const mockFileUploadQuestion: TSurveyFileUploadQuestion = {
  id: "u5zezsoimxh12ijbtp40ve05",
  type: TSurveyQuestionType.FileUpload,
  isDraft: true,
  headline: "File Upload",
  required: true,
  allowMultipleFiles: false,
};

export const mockCalQuestion: TSurveyCalQuestion = {
  id: "hoyr8wi42h21o1oh419yfbpc",
  type: TSurveyQuestionType.Cal,
  isDraft: true,
  headline: "Schedule a call with me",
  required: true,
  buttonLabel: "Skip",
  calUserName: "rick/get-rick-rolled",
};

export const mockThankYouCard = {
  enabled: true,
  headline: "Thank you!",
  subheader: "We appreciate your feedback.",
  buttonLink: "https://formbricks.com/signup",
  buttonLabel: "Create your own Survey",
};

export const mockSurvey: TSurvey = {
  id: "surveyId",
  createdAt: new Date("2024-02-05T08:02:06.732Z"),
  updatedAt: new Date("2024-02-05T08:03:13.206Z"),
  name: "New Survey",
  type: "link" as TSurveyType,
  environmentId: "EnvironmentId",
  createdBy: "CreatorId",
  status: "inProgress" as TSurveyStatus,
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
  thankYouCard: mockThankYouCard,
  hiddenFields: {
    enabled: true,
    fieldIds: [],
  },
  displayOption: "displayOnce" as TSurveyDisplayOption,
  recontactDays: null,
  autoClose: null,
  closeOnDate: null,
  delay: 0,
  displayPercentage: null,
  autoComplete: null,
  verifyEmail: null,
  redirectUrl: null,
  productOverwrites: null,
  styling: {
    background: {
      bg: "",
      bgType: "color",
    },
  },
  surveyClosedMessage: null,
  singleUse: {
    enabled: false,
    isEncrypted: true,
  },
  pin: null,
  resultShareKey: null,
  triggers: [],
  attributeFilters: [],
};

export const mockTranslatedWelcomeCard = {
  html: {
    _i18n_: true,
    en: '<p class="fb-editor-paragraph"><br></p><p class="fb-editor-paragraph" dir="ltr"><span style="white-space: pre-wrap;">Thanks for providing your feedback - let\'s go!</span></p>',
    de: "",
  },
  enabled: true,
  headline: { _i18n_: true, en: "Welcome!", de: "" },
  timeToFinish: true,
  showResponseCount: false,
};

export const mockTranslatedOpenTextQuestion = {
  ...mockOpenTextQuestion,
  headline: { _i18n_: true, en: "What would you like to know?", de: "" },
  subheader: { _i18n_: true, en: "This is an example survey.", de: "" },
  placeholder: { _i18n_: true, en: "Type your answer here...", de: "" },
};

export const mockTranslatedSingleSelectQuestion = {
  ...mockSingleSelectQuestion,
  headline: { _i18n_: true, en: "What do you do?", de: "" },
  subheader: { _i18n_: true, en: "Can't do both.", de: "" },
  choices: mockSingleSelectQuestion.choices.map((choice) => ({
    ...choice,
    label: { _i18n_: true, en: choice.label, de: "" },
  })),
  otherOptionPlaceholder: undefined,
};

export const mockTranslatedMultiSelectQuestion = {
  ...mockMultiSelectQuestion,
  headline: { _i18n_: true, en: "What's important on vacay?", de: "" },
  choices: mockMultiSelectQuestion.choices.map((choice) => ({
    ...choice,
    label: { _i18n_: true, en: choice.label, de: "" },
  })),
  otherOptionPlaceholder: undefined,
};

export const mockTranslatedPictureSelectQuestion = {
  ...mockPictureSelectQuestion,
  headline: { _i18n_: true, en: "Which is the cutest puppy?", de: "" },
  subheader: { _i18n_: true, en: "You can also pick both.", de: "" },
};

export const mockTranslatedRatingQuestion = {
  ...mockRatingQuestion,
  headline: { _i18n_: true, en: "How would you rate My Product", de: "" },
  subheader: { _i18n_: true, en: "Don't worry, be honest.", de: "" },
  lowerLabel: { _i18n_: true, en: "Not good", de: "" },
  upperLabel: { _i18n_: true, en: "Very good", de: "" },
};

export const mockTranslatedNpsQuestion = {
  ...mockNpsQuestion,
  headline: {
    _i18n_: true,
    en: "How likely are you to recommend My Product to a friend or colleague?",
    de: "",
  },
  lowerLabel: { _i18n_: true, en: "Not at all likely", de: "" },
  upperLabel: { _i18n_: true, en: "Extremely likely", de: "" },
};

export const mockTranslatedCtaQuestion = {
  ...mockCtaQuestion,
  headline: { _i18n_: true, en: "You are one of our power users!", de: "" },
  html: { _i18n_: true, en: mockCtaQuestion.html, de: "" },
  buttonLabel: { _i18n_: true, en: "Book interview", de: "" },
  dismissButtonLabel: { _i18n_: true, en: "Skip", de: "" },
};

export const mockTranslatedConsentQuestion = {
  ...mockConsentQuestion,
  headline: { _i18n_: true, en: "Terms and Conditions", de: "" },
  html: { _i18n_: true, en: mockConsentQuestion.html, de: "" },
  label: { _i18n_: true, en: "I agree to the terms and conditions", de: "" },
  dismissButtonLabel: "Skip",
};

export const mockTranslatedDateQuestion = {
  ...mockDateQuestion,
  headline: { _i18n_: true, en: "When is your birthday?", de: "" },
};

export const mockTranslatedFileUploadQuestion = {
  ...mockFileUploadQuestion,
  headline: { _i18n_: true, en: "File Upload", de: "" },
};

export const mockTranslatedCalQuestion = {
  ...mockCalQuestion,
  headline: { _i18n_: true, en: "Schedule a call with me", de: "" },
  buttonLabel: { _i18n_: true, en: "Skip", de: "" },
};

export const mockTranslatedThankYouCard = {
  ...mockThankYouCard,
  headline: { _i18n_: true, en: "Thank you!", de: "" },
  subheader: { _i18n_: true, en: "We appreciate your feedback.", de: "" },
  buttonLabel: "Create your own Survey",
};

export const mockTranslatedSurvey = {
  ...mockSurvey,
  questions: [
    mockTranslatedOpenTextQuestion,
    mockTranslatedSingleSelectQuestion,
    mockTranslatedMultiSelectQuestion,
    mockTranslatedPictureSelectQuestion,
    mockTranslatedRatingQuestion,
    mockTranslatedNpsQuestion,
    mockTranslatedCtaQuestion,
    mockTranslatedConsentQuestion,
    mockTranslatedDateQuestion,
    mockTranslatedFileUploadQuestion,
    mockTranslatedCalQuestion,
  ],
  welcomeCard: mockTranslatedWelcomeCard,
  thankYouCard: mockTranslatedThankYouCard,
};
