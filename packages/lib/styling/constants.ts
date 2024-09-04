// https://github.com/airbnb/javascript/#naming--uppercase
import { TSurvey } from "@formbricks/types/surveys/types";
import { getDefaultEndingCard } from "../templates";

export const COLOR_DEFAULTS = {
  brandColor: "#64748b",
  questionColor: "#2b2524",
  inputColor: "#ffffff",
  inputBorderColor: "#cbd5e1",
  cardBackgroundColor: "#ffffff",
  cardBorderColor: "#f8fafc",
  cardShadowColor: "#000000",
  highlightBorderColor: "#64748b",
} as const;

export const PREVIEW_SURVEY = {
  id: "cltxxaa6x0000g8hacxdxejeu",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "New Survey",
  type: "link",
  environmentId: "cltwumfcz0009echxg02fh7oa",
  createdBy: "cltwumfbz0000echxysz6ptvq",
  status: "inProgress",
  welcomeCard: {
    html: {
      default: "Thanks for providing your feedback - let's go!",
    },
    enabled: false,
    headline: {
      default: "Welcome!",
    },
    timeToFinish: false,
    showResponseCount: false,
  },
  styling: null,
  segment: null,
  questions: [
    {
      id: "tunaz8ricd4regvkz1j0rbf6",
      type: "openText",
      headline: {
        default: "This is a preview survey",
      },
      required: true,
      inputType: "text",
      subheader: {
        default: "Click through it to check the look and feel of the surveying experience.",
      },
      placeholder: {
        default: "Type your answer here...",
      },
    },
    {
      id: "lbdxozwikh838yc6a8vbwuju",
      type: "rating",
      range: 5,
      scale: "star",
      isDraft: true,
      headline: {
        default: "How would you rate My Product",
      },
      required: true,
      subheader: {
        default: "Don't worry, be honest.",
      },
      lowerLabel: {
        default: "Not good",
      },
      upperLabel: {
        default: "Very good",
      },
    },
    {
      id: "rjpu42ps6dzirsn9ds6eydgt",
      type: "multipleChoiceSingle",
      choices: [
        {
          id: "x6wty2s72v7vd538aadpurqx",
          label: {
            default: "Eat the cake 🍰",
          },
        },
        {
          id: "fbcj4530t2n357ymjp2h28d6",
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
    },
  ],
  endings: [getDefaultEndingCard([])],
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
  autoComplete: 50,
  isVerifyEmailEnabled: false,
  redirectUrl: null,
  productOverwrites: null,
  surveyClosedMessage: null,
  singleUse: {
    enabled: false,
    isEncrypted: true,
  },
  pin: null,
  resultShareKey: null,
  languages: [],
  triggers: [],
  showLanguageSwitch: false,
} as TSurvey;
