// https://github.com/airbnb/javascript/#naming--uppercase
import { TProjectStyling } from "@formbricks/types/project";
import { TSurvey } from "@formbricks/types/surveys/types";
import { translate } from "../templates";

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

export const defaultStyling: TProjectStyling = {
  allowStyleOverwrite: true,
  brandColor: {
    light: COLOR_DEFAULTS.brandColor,
  },
  questionColor: {
    light: COLOR_DEFAULTS.questionColor,
  },
  inputColor: {
    light: COLOR_DEFAULTS.inputColor,
  },
  inputBorderColor: {
    light: COLOR_DEFAULTS.inputBorderColor,
  },
  cardBackgroundColor: {
    light: COLOR_DEFAULTS.cardBackgroundColor,
  },
  cardBorderColor: {
    light: COLOR_DEFAULTS.cardBorderColor,
  },
  cardShadowColor: {
    light: COLOR_DEFAULTS.cardShadowColor,
  },
  isLogoHidden: false,
  highlightBorderColor: undefined,
  isDarkModeEnabled: false,
  background: {
    bg: "#fff",
    bgType: "color",
  },
  roundness: 8,
  cardArrangement: {
    linkSurveys: "straight",
    appSurveys: "straight",
  },
};

export const getPreviewSurvey = (locale: string, projectName: string) => {
  return {
    id: "cltxxaa6x0000g8hacxdxejeu",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: translate("preview_survey_name", locale),
    type: "link",
    environmentId: "cltwumfcz0009echxg02fh7oa",
    createdBy: "cltwumfbz0000echxysz6ptvq",
    status: "inProgress",
    welcomeCard: {
      html: {
        default: translate("preview_survey_welcome_card_html", locale),
      },
      enabled: false,
      headline: {
        default: translate("preview_survey_welcome_card_headline", locale),
      },
      timeToFinish: false,
      showResponseCount: false,
    },
    styling: null,
    segment: null,
    questions: [
      {
        id: "lbdxozwikh838yc6a8vbwuju",
        type: "rating",
        range: 5,
        scale: "star",
        isDraft: true,
        headline: {
          default: translate("preview_survey_question_1_headline", locale, { projectName }),
        },
        required: true,
        subheader: {
          default: translate("preview_survey_question_1_subheader", locale),
        },
        lowerLabel: {
          default: translate("preview_survey_question_1_lower_label", locale),
        },
        upperLabel: {
          default: translate("preview_survey_question_1_upper_label", locale),
        },
      },
      {
        id: "rjpu42ps6dzirsn9ds6eydgt",
        type: "multipleChoiceSingle",
        choices: [
          {
            id: "x6wty2s72v7vd538aadpurqx",
            label: {
              default: translate("preview_survey_question_2_choice_1_label", locale),
            },
          },
          {
            id: "fbcj4530t2n357ymjp2h28d6",
            label: {
              default: translate("preview_survey_question_2_choice_2_label", locale),
            },
          },
        ],
        isDraft: true,
        headline: {
          default: translate("preview_survey_question_2_headline", locale),
        },
        backButtonLabel: {
          default: translate("preview_survey_question_2_back_button_label", locale),
        },
        required: true,
        shuffleOption: "none",
      },
    ],
    endings: [
      {
        id: "cltyqp5ng000108l9dmxw6nde",
        type: "endScreen",
        headline: { default: translate("preview_survey_ending_card_headline", locale) },
        subheader: { default: translate("preview_survey_ending_card_description", locale) },
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
    autoComplete: 50,
    isVerifyEmailEnabled: false,
    isSingleResponsePerEmailEnabled: false,
    redirectUrl: null,
    projectOverwrites: null,
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
    followUps: [],
  } as TSurvey;
};
