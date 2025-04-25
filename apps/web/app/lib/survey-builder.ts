import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { createId } from "@paralleldrive/cuid2";
import { TFnType } from "@tolgee/react";
import {
  TShuffleOption,
  TSurveyCTAQuestion,
  TSurveyConsentQuestion,
  TSurveyEndScreenCard,
  TSurveyEnding,
  TSurveyHiddenFields,
  TSurveyLanguage,
  TSurveyLogic,
  TSurveyMultipleChoiceQuestion,
  TSurveyNPSQuestion,
  TSurveyOpenTextQuestion,
  TSurveyOpenTextQuestionInputType,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
  TSurveyRatingQuestion,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import { TTemplate, TTemplateRole } from "@formbricks/types/templates";

const defaultButtonLabel = "common.next";
const defaultBackButtonLabel = "common.back";

export const buildMultipleChoiceQuestion = ({
  id,
  headline,
  type,
  subheader,
  choices,
  choiceIds,
  buttonLabel,
  backButtonLabel,
  shuffleOption,
  required,
  logic,
  containsOther = false,
  t,
}: {
  id?: string;
  headline: string;
  type: TSurveyQuestionTypeEnum.MultipleChoiceMulti | TSurveyQuestionTypeEnum.MultipleChoiceSingle;
  subheader?: string;
  choices: string[];
  choiceIds?: string[];
  buttonLabel?: string;
  backButtonLabel?: string;
  shuffleOption?: TShuffleOption;
  required?: boolean;
  logic?: TSurveyLogic[];
  containsOther?: boolean;
  t: TFnType;
}): TSurveyMultipleChoiceQuestion => {
  return {
    id: id ?? createId(),
    type,
    subheader: subheader ? { default: subheader } : undefined,
    headline: { default: headline },
    choices: choices.map((choice, index) => {
      const isLastIndex = index === choices.length - 1;
      const id = containsOther && isLastIndex ? "other" : choiceIds ? choiceIds[index] : createId();
      return { id, label: { default: choice } };
    }),
    buttonLabel: { default: buttonLabel || t(defaultButtonLabel) },
    backButtonLabel: { default: backButtonLabel || t(defaultBackButtonLabel) },
    shuffleOption: shuffleOption || "none",
    required: required ?? true,
    logic,
  };
};

export const buildOpenTextQuestion = ({
  id,
  headline,
  subheader,
  placeholder,
  inputType,
  buttonLabel,
  backButtonLabel,
  required,
  logic,
  longAnswer,
  t,
}: {
  id?: string;
  headline: string;
  subheader?: string;
  placeholder?: string;
  buttonLabel?: string;
  backButtonLabel?: string;
  required?: boolean;
  logic?: TSurveyLogic[];
  inputType: TSurveyOpenTextQuestionInputType;
  longAnswer?: boolean;
  t: TFnType;
}): TSurveyOpenTextQuestion => {
  return {
    id: id ?? createId(),
    type: TSurveyQuestionTypeEnum.OpenText,
    inputType,
    subheader: subheader ? { default: subheader } : undefined,
    placeholder: placeholder ? { default: placeholder } : undefined,
    headline: { default: headline },
    buttonLabel: { default: buttonLabel || t(defaultButtonLabel) },
    backButtonLabel: { default: backButtonLabel || t(defaultBackButtonLabel) },
    required: required ?? true,
    longAnswer,
    logic,
    charLimit: {
      enabled: false,
    },
  };
};

export const buildRatingQuestion = ({
  id,
  headline,
  subheader,
  scale,
  range,
  lowerLabel,
  upperLabel,
  buttonLabel,
  backButtonLabel,
  required,
  logic,
  isColorCodingEnabled = false,
  t,
}: {
  id?: string;
  headline: string;
  scale: TSurveyRatingQuestion["scale"];
  range: TSurveyRatingQuestion["range"];
  lowerLabel?: string;
  upperLabel?: string;
  subheader?: string;
  placeholder?: string;
  buttonLabel?: string;
  backButtonLabel?: string;
  required?: boolean;
  logic?: TSurveyLogic[];
  isColorCodingEnabled?: boolean;
  t: TFnType;
}): TSurveyRatingQuestion => {
  return {
    id: id ?? createId(),
    type: TSurveyQuestionTypeEnum.Rating,
    subheader: subheader ? { default: subheader } : undefined,
    headline: { default: headline },
    scale,
    range,
    buttonLabel: { default: buttonLabel || t(defaultButtonLabel) },
    backButtonLabel: { default: backButtonLabel || t(defaultBackButtonLabel) },
    required: required ?? true,
    isColorCodingEnabled,
    lowerLabel: lowerLabel ? { default: lowerLabel } : undefined,
    upperLabel: upperLabel ? { default: upperLabel } : undefined,
    logic,
  };
};

export const buildNPSQuestion = ({
  id,
  headline,
  subheader,
  lowerLabel,
  upperLabel,
  buttonLabel,
  backButtonLabel,
  required,
  logic,
  isColorCodingEnabled = false,
  t,
}: {
  id?: string;
  headline: string;
  lowerLabel?: string;
  upperLabel?: string;
  subheader?: string;
  placeholder?: string;
  buttonLabel?: string;
  backButtonLabel?: string;
  required?: boolean;
  logic?: TSurveyLogic[];
  isColorCodingEnabled?: boolean;
  t: TFnType;
}): TSurveyNPSQuestion => {
  return {
    id: id ?? createId(),
    type: TSurveyQuestionTypeEnum.NPS,
    subheader: subheader ? { default: subheader } : undefined,
    headline: { default: headline },
    buttonLabel: { default: buttonLabel || t(defaultButtonLabel) },
    backButtonLabel: { default: backButtonLabel || t(defaultBackButtonLabel) },
    required: required ?? true,
    isColorCodingEnabled,
    lowerLabel: lowerLabel ? { default: lowerLabel } : undefined,
    upperLabel: upperLabel ? { default: upperLabel } : undefined,
    logic,
  };
};

export const buildConsentQuestion = ({
  id,
  headline,
  subheader,
  label,
  buttonLabel,
  backButtonLabel,
  required,
  logic,
  t,
}: {
  id?: string;
  headline: string;
  subheader?: string;
  buttonLabel?: string;
  backButtonLabel?: string;
  required?: boolean;
  logic?: TSurveyLogic[];
  label: string;
  t: TFnType;
}): TSurveyConsentQuestion => {
  return {
    id: id ?? createId(),
    type: TSurveyQuestionTypeEnum.Consent,
    subheader: subheader ? { default: subheader } : undefined,
    headline: { default: headline },
    buttonLabel: { default: buttonLabel || t(defaultButtonLabel) },
    backButtonLabel: { default: backButtonLabel || t(defaultBackButtonLabel) },
    required: required ?? true,
    label: { default: label },
    logic,
  };
};

export const buildCTAQuestion = ({
  id,
  headline,
  html,
  buttonLabel,
  buttonExternal,
  backButtonLabel,
  required,
  logic,
  dismissButtonLabel,
  buttonUrl,
  t,
}: {
  id?: string;
  headline: string;
  buttonExternal: boolean;
  html?: string;
  buttonLabel?: string;
  backButtonLabel?: string;
  required?: boolean;
  logic?: TSurveyLogic[];
  dismissButtonLabel?: string;
  buttonUrl?: string;
  t: TFnType;
}): TSurveyCTAQuestion => {
  return {
    id: id ?? createId(),
    type: TSurveyQuestionTypeEnum.CTA,
    html: html ? { default: html } : undefined,
    headline: { default: headline },
    buttonLabel: { default: buttonLabel || t(defaultButtonLabel) },
    backButtonLabel: { default: backButtonLabel || t(defaultBackButtonLabel) },
    dismissButtonLabel: dismissButtonLabel ? { default: dismissButtonLabel } : undefined,
    required: required ?? true,
    buttonExternal,
    buttonUrl,
    logic,
  };
};

// Helper function to create standard jump logic based on operator
export const createJumpLogic = (
  sourceQuestionId: string,
  targetId: string,
  operator: "isSkipped" | "isSubmitted" | "isClicked"
): TSurveyLogic => ({
  id: createId(),
  conditions: {
    id: createId(),
    connector: "and",
    conditions: [
      {
        id: createId(),
        leftOperand: {
          value: sourceQuestionId,
          type: "question",
        },
        operator: operator,
      },
    ],
  },
  actions: [
    {
      id: createId(),
      objective: "jumpToQuestion",
      target: targetId,
    },
  ],
});

// Helper function to create jump logic based on choice selection
export const createChoiceJumpLogic = (
  sourceQuestionId: string,
  choiceId: string,
  targetId: string
): TSurveyLogic => ({
  id: createId(),
  conditions: {
    id: createId(),
    connector: "and",
    conditions: [
      {
        id: createId(),
        leftOperand: {
          value: sourceQuestionId,
          type: "question",
        },
        operator: "equals",
        rightOperand: {
          type: "static",
          value: choiceId,
        },
      },
    ],
  },
  actions: [
    {
      id: createId(),
      objective: "jumpToQuestion",
      target: targetId,
    },
  ],
});

export const getDefaultEndingCard = (languages: TSurveyLanguage[], t: TFnType): TSurveyEndScreenCard => {
  const languageCodes = extractLanguageCodes(languages);
  return {
    id: createId(),
    type: "endScreen",
    headline: createI18nString(t("templates.default_ending_card_headline"), languageCodes),
    subheader: createI18nString(t("templates.default_ending_card_subheader"), languageCodes),
    buttonLabel: createI18nString(t("templates.default_ending_card_button_label"), languageCodes),
    buttonLink: "https://formbricks.com",
  };
};

export const hiddenFieldsDefault: TSurveyHiddenFields = {
  enabled: true,
  fieldIds: [],
};

export const getDefaultWelcomeCard = (t: TFnType): TSurveyWelcomeCard => {
  return {
    enabled: false,
    headline: { default: t("templates.default_welcome_card_headline") },
    html: { default: t("templates.default_welcome_card_html") },
    buttonLabel: { default: t("templates.default_welcome_card_button_label") },
    timeToFinish: false,
    showResponseCount: false,
  };
};

export const getDefaultSurveyPreset = (t: TFnType): TTemplate["preset"] => {
  return {
    name: "New Survey",
    welcomeCard: getDefaultWelcomeCard(t),
    endings: [getDefaultEndingCard([], t)],
    hiddenFields: hiddenFieldsDefault,
    questions: [],
  };
};

/**
 * Generic builder for survey.
 * @param config - The configuration for survey settings and questions.
 * @param t - The translation function.
 */
export const buildSurvey = (
  config: {
    name: string;
    role: TTemplateRole;
    industries: ("eCommerce" | "saas" | "other")[];
    channels: ("link" | "app" | "website")[];
    description: string;
    questions: TSurveyQuestion[];
    endings?: TSurveyEnding[];
    hiddenFields?: TSurveyHiddenFields;
  },
  t: TFnType
): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: config.name,
    role: config.role,
    industries: config.industries,
    channels: config.channels,
    description: config.description,
    preset: {
      ...localSurvey,
      name: config.name,
      questions: config.questions,
      endings: config.endings ?? localSurvey.endings,
      hiddenFields: config.hiddenFields ?? hiddenFieldsDefault,
    },
  };
};
