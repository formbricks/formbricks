import { createId } from "@paralleldrive/cuid2";
import type { TFunction } from "i18next";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type {
  TSurveyEndScreenCard,
  TSurveyEnding,
  TSurveyHiddenFields,
  TSurveyLanguage,
  TSurveyLogic,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import type { TTemplate, TTemplateRole } from "@formbricks/types/templates";
import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";

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
          type: "element",
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
  choiceId: string | number,
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
      objective: "jumpToQuestion",
      target: targetId,
    },
  ],
});

export const getDefaultEndingCard = (languages: TSurveyLanguage[], t: TFunction): TSurveyEndScreenCard => {
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

export const getDefaultWelcomeCard = (t: TFunction): TSurveyWelcomeCard => {
  return {
    enabled: false,
    headline: createI18nString(t("templates.default_welcome_card_headline"), []),
    subheader: createI18nString(t("templates.default_welcome_card_html"), []),
    buttonLabel: createI18nString(t("templates.default_welcome_card_button_label"), []),
    timeToFinish: false,
    showResponseCount: false,
  };
};

export const getDefaultSurveyPreset = (t: TFunction): TTemplate["preset"] => {
  return {
    name: "New Survey",
    welcomeCard: getDefaultWelcomeCard(t),
    endings: [getDefaultEndingCard([], t)],
    hiddenFields: hiddenFieldsDefault,
    blocks: [],
  };
};

/**
 * Generic builder for survey.
 * @param config - The configuration for survey settings and blocks.
 * @param t - The translation function.
 */
export const buildSurvey = (
  config: {
    name: string;
    industries: ("eCommerce" | "saas" | "other")[];
    channels: ("link" | "app" | "website")[];
    role: TTemplateRole;
    description: string;
    blocks: TSurveyBlock[];
    endings: TSurveyEnding[];
    hiddenFields: TSurveyHiddenFields;
  },
  t: TFunction
): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: config.name,
    industries: config.industries,
    channels: config.channels,
    role: config.role,
    description: config.description,
    preset: {
      ...localSurvey,
      name: config.name,
      blocks: config.blocks ?? [],
      endings: config.endings ?? localSurvey.endings,
      hiddenFields: config.hiddenFields ?? hiddenFieldsDefault,
    },
  };
};
