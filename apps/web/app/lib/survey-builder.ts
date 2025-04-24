import { createId } from "@paralleldrive/cuid2";
import { TFnType } from "@tolgee/react";
import {
  TShuffleOption,
  TSurveyCTAQuestion,
  TSurveyConsentQuestion,
  TSurveyLogic,
  TSurveyMultipleChoiceQuestion,
  TSurveyNPSQuestion,
  TSurveyOpenTextQuestion,
  TSurveyOpenTextQuestionInputType,
  TSurveyQuestionTypeEnum,
  TSurveyRatingQuestion,
} from "@formbricks/types/surveys/types";

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

export const buildRatingQUestion = ({
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
