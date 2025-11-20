import { createId } from "@paralleldrive/cuid2";
import type { TFunction } from "i18next";
import type { TSurveyBlock, TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import type {
  TSurveyCTAElement,
  TSurveyConsentElement,
  TSurveyElement,
  TSurveyMultipleChoiceElement,
  TSurveyNPSElement,
  TSurveyOpenTextElement,
  TSurveyOpenTextElementInputType,
  TSurveyRatingElement,
} from "@formbricks/types/surveys/elements";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TShuffleOption } from "@formbricks/types/surveys/types";
import { createI18nString } from "@/lib/i18n/utils";

const getDefaultButtonLabel = (label: string | undefined, t: TFunction) =>
  createI18nString(label || t("common.next"), []);

const getDefaultBackButtonLabel = (label: string | undefined, t: TFunction) =>
  createI18nString(label || t("common.back"), []);

export const buildMultipleChoiceElement = ({
  id,
  headline,
  type,
  subheader,
  choices,
  choiceIds,
  shuffleOption,
  required,
  containsOther = false,
}: {
  id?: string;
  headline: string;
  type: TSurveyElementTypeEnum.MultipleChoiceMulti | TSurveyElementTypeEnum.MultipleChoiceSingle;
  subheader?: string;
  choices: string[];
  choiceIds?: string[];
  shuffleOption?: TShuffleOption;
  required?: boolean;
  containsOther?: boolean;
}): TSurveyMultipleChoiceElement => {
  return {
    id: id ?? createId(),
    type,
    subheader: subheader ? createI18nString(subheader, []) : undefined,
    headline: createI18nString(headline, []),
    choices: choices.map((choice, index) => {
      const isLastIndex = index === choices.length - 1;
      let choiceId: string;
      if (containsOther && isLastIndex) {
        choiceId = "other";
      } else if (choiceIds) {
        choiceId = choiceIds[index];
      } else {
        choiceId = createId();
      }
      return { id: choiceId, label: createI18nString(choice, []) };
    }),
    shuffleOption: shuffleOption || "none",
    required: required ?? false,
  };
};

export const buildOpenTextElement = ({
  id,
  headline,
  subheader,
  placeholder,
  inputType,
  required,
  longAnswer,
}: {
  id?: string;
  headline: string;
  subheader?: string;
  placeholder?: string;
  required?: boolean;
  inputType: TSurveyOpenTextElementInputType;
  longAnswer?: boolean;
}): TSurveyOpenTextElement => {
  return {
    id: id ?? createId(),
    type: TSurveyElementTypeEnum.OpenText,
    inputType,
    subheader: subheader ? createI18nString(subheader, []) : undefined,
    placeholder: placeholder ? createI18nString(placeholder, []) : undefined,
    headline: createI18nString(headline, []),
    required: required ?? false,
    longAnswer,
    charLimit: {
      enabled: false,
    },
  };
};

export const buildRatingElement = ({
  id,
  headline,
  subheader,
  scale,
  range,
  lowerLabel,
  upperLabel,
  required,
  isColorCodingEnabled = false,
}: {
  id?: string;
  headline: string;
  scale: TSurveyRatingElement["scale"];
  range: TSurveyRatingElement["range"];
  lowerLabel?: string;
  upperLabel?: string;
  subheader?: string;
  required?: boolean;
  isColorCodingEnabled?: boolean;
}): TSurveyRatingElement => {
  return {
    id: id ?? createId(),
    type: TSurveyElementTypeEnum.Rating,
    subheader: subheader ? createI18nString(subheader, []) : undefined,
    headline: createI18nString(headline, []),
    scale,
    range,
    required: required ?? false,
    isColorCodingEnabled,
    lowerLabel: lowerLabel ? createI18nString(lowerLabel, []) : undefined,
    upperLabel: upperLabel ? createI18nString(upperLabel, []) : undefined,
  };
};

export const buildConsentElement = ({
  id,
  headline,
  subheader,
  label,
  required,
}: {
  id?: string;
  headline: string;
  subheader: string;
  required?: boolean;
  label: string;
}): TSurveyConsentElement => {
  return {
    id: id ?? createId(),
    type: TSurveyElementTypeEnum.Consent,
    subheader: createI18nString(subheader, []),
    headline: createI18nString(headline, []),
    required: required ?? false,
    label: createI18nString(label, []),
  };
};

export const buildCTAElement = ({
  id,
  headline,
  subheader,
  buttonExternal,
  required,
  ctaButtonLabel,
  buttonUrl,
}: {
  id?: string;
  headline: string;
  buttonExternal?: boolean;
  subheader: string;
  required?: boolean;
  ctaButtonLabel?: string;
  buttonUrl?: string;
}): TSurveyCTAElement => {
  return {
    id: id ?? createId(),
    type: TSurveyElementTypeEnum.CTA,
    subheader: createI18nString(subheader, []),
    headline: createI18nString(headline, []),
    ctaButtonLabel: ctaButtonLabel ? createI18nString(ctaButtonLabel, []) : undefined,
    required: required ?? false,
    buttonExternal: buttonExternal ?? false,
    buttonUrl,
  };
};

export const buildNPSElement = ({
  id,
  headline,
  subheader,
  lowerLabel,
  upperLabel,
  required,
  isColorCodingEnabled = false,
}: {
  id?: string;
  headline: string;
  subheader?: string;
  lowerLabel?: string;
  upperLabel?: string;
  required?: boolean;
  isColorCodingEnabled?: boolean;
}): TSurveyNPSElement => {
  return {
    id: id ?? createId(),
    type: TSurveyElementTypeEnum.NPS,
    subheader: subheader ? createI18nString(subheader, []) : undefined,
    headline: createI18nString(headline, []),
    required: required ?? false,
    isColorCodingEnabled,
    lowerLabel: lowerLabel ? createI18nString(lowerLabel, []) : undefined,
    upperLabel: upperLabel ? createI18nString(upperLabel, []) : undefined,
  };
};

// Helper function to create block-level jump logic based on operator
export const createBlockJumpLogic = (
  sourceElementId: string,
  targetBlockId: string,
  operator: "isSkipped" | "isSubmitted" | "isClicked"
): TSurveyBlockLogic => ({
  id: createId(),
  conditions: {
    id: createId(),
    connector: "and",
    conditions: [
      {
        id: createId(),
        leftOperand: {
          value: sourceElementId,
          type: "element",
        },
        operator: operator,
      },
    ],
  },
  actions: [
    {
      id: createId(),
      objective: "jumpToBlock",
      target: targetBlockId,
    },
  ],
});

// Helper function to create block-level jump logic based on choice selection
export const createBlockChoiceJumpLogic = (
  sourceElementId: string,
  choiceId: string | number,
  targetBlockId: string
): TSurveyBlockLogic => ({
  id: createId(),
  conditions: {
    id: createId(),
    connector: "and",
    conditions: [
      {
        id: createId(),
        leftOperand: {
          value: sourceElementId,
          type: "element",
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
      objective: "jumpToBlock",
      target: targetBlockId,
    },
  ],
});

// Block builder function
export const buildBlock = ({
  id,
  name,
  elements,
  logic,
  logicFallback,
  buttonLabel,
  backButtonLabel,
  t,
}: {
  id?: string;
  name: string;
  elements: TSurveyElement[];
  logic?: TSurveyBlockLogic[];
  logicFallback?: string;
  buttonLabel?: string;
  backButtonLabel?: string;
  t: TFunction;
}): TSurveyBlock => {
  return {
    id: id ?? createId(),
    name,
    elements,
    logic,
    logicFallback,
    buttonLabel: buttonLabel ? getDefaultButtonLabel(buttonLabel, t) : undefined,
    backButtonLabel: backButtonLabel ? getDefaultBackButtonLabel(backButtonLabel, t) : undefined,
  };
};
