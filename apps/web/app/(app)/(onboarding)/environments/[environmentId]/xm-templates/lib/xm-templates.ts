import { getDefaultEndingCard } from "@/app/lib/templates";
import { createId } from "@paralleldrive/cuid2";
import { TFnType } from "@tolgee/react";
import { logger } from "@formbricks/logger";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TXMTemplate } from "@formbricks/types/templates";

export const getXMSurveyDefault = (t: TFnType): TXMTemplate => {
  try {
    return {
      name: "",
      endings: [getDefaultEndingCard([], t)],
      questions: [],
      styling: {
        overwriteThemeStyling: true,
      },
    };
  } catch (error) {
    logger.error(error, "Failed to create default XM survey template");
    throw error; // Re-throw after logging
  }
};

const npsSurvey = (t: TFnType): TXMTemplate => {
  return {
    ...getXMSurveyDefault(t),
    name: t("templates.nps_survey_name"),
    questions: [
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.NPS,
        headline: { default: t("templates.nps_survey_question_1_headline") },
        required: true,
        lowerLabel: { default: t("templates.nps_survey_question_1_lower_label") },
        upperLabel: { default: t("templates.nps_survey_question_1_upper_label") },
        isColorCodingEnabled: true,
      },
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: t("templates.nps_survey_question_2_headline") },
        required: false,
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: t("templates.nps_survey_question_3_headline") },
        required: false,
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
    ],
  };
};

const starRatingSurvey = (t: TFnType): TXMTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const defaultSurvey = getXMSurveyDefault(t);

  return {
    ...defaultSurvey,
    name: t("templates.star_rating_survey_name"),
    questions: [
      {
        id: reusableQuestionIds[0],
        type: TSurveyQuestionTypeEnum.Rating,
        logic: [
          {
            id: createId(),
            conditions: {
              id: createId(),
              connector: "and",
              conditions: [
                {
                  id: createId(),
                  leftOperand: {
                    value: reusableQuestionIds[0],
                    type: "question",
                  },
                  operator: "isLessThanOrEqual",
                  rightOperand: {
                    type: "static",
                    value: 3,
                  },
                },
              ],
            },
            actions: [
              {
                id: createId(),
                objective: "jumpToQuestion",
                target: reusableQuestionIds[2],
              },
            ],
          },
        ],
        range: 5,
        scale: "number",
        headline: { default: t("templates.star_rating_survey_question_1_headline") },
        required: true,
        lowerLabel: { default: t("templates.star_rating_survey_question_1_lower_label") },
        upperLabel: { default: t("templates.star_rating_survey_question_1_upper_label") },
        isColorCodingEnabled: false,
      },
      {
        id: reusableQuestionIds[1],
        html: { default: t("templates.star_rating_survey_question_2_html") },
        type: TSurveyQuestionTypeEnum.CTA,
        logic: [
          {
            id: createId(),
            conditions: {
              id: createId(),
              connector: "and",
              conditions: [
                {
                  id: createId(),
                  leftOperand: {
                    value: reusableQuestionIds[1],
                    type: "question",
                  },
                  operator: "isClicked",
                },
              ],
            },
            actions: [
              {
                id: createId(),
                objective: "jumpToQuestion",
                target: defaultSurvey.endings[0].id,
              },
            ],
          },
        ],
        headline: { default: t("templates.star_rating_survey_question_2_headline") },
        required: true,
        buttonUrl: "https://formbricks.com/github",
        buttonLabel: { default: t("templates.star_rating_survey_question_2_button_label") },
        buttonExternal: true,
      },
      {
        id: reusableQuestionIds[2],
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: t("templates.star_rating_survey_question_3_headline") },
        required: true,
        subheader: { default: t("templates.star_rating_survey_question_3_subheader") },
        buttonLabel: { default: t("templates.star_rating_survey_question_3_button_label") },
        placeholder: { default: t("templates.star_rating_survey_question_3_placeholder") },
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
    ],
  };
};

const csatSurvey = (t: TFnType): TXMTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const defaultSurvey = getXMSurveyDefault(t);

  return {
    ...defaultSurvey,
    name: t("templates.csat_survey_name"),
    questions: [
      {
        id: reusableQuestionIds[0],
        type: TSurveyQuestionTypeEnum.Rating,
        logic: [
          {
            id: createId(),
            conditions: {
              id: createId(),
              connector: "and",
              conditions: [
                {
                  id: createId(),
                  leftOperand: {
                    value: reusableQuestionIds[0],
                    type: "question",
                  },
                  operator: "isLessThanOrEqual",
                  rightOperand: {
                    type: "static",
                    value: 3,
                  },
                },
              ],
            },
            actions: [
              {
                id: createId(),
                objective: "jumpToQuestion",
                target: reusableQuestionIds[2],
              },
            ],
          },
        ],
        range: 5,
        scale: "smiley",
        headline: { default: t("templates.csat_survey_question_1_headline") },
        required: true,
        lowerLabel: { default: t("templates.csat_survey_question_1_lower_label") },
        upperLabel: { default: t("templates.csat_survey_question_1_upper_label") },
        isColorCodingEnabled: false,
      },
      {
        id: reusableQuestionIds[1],
        type: TSurveyQuestionTypeEnum.OpenText,
        logic: [
          {
            id: createId(),
            conditions: {
              id: createId(),
              connector: "and",
              conditions: [
                {
                  id: createId(),
                  leftOperand: {
                    value: reusableQuestionIds[1],
                    type: "question",
                  },
                  operator: "isSubmitted",
                },
              ],
            },
            actions: [
              {
                id: createId(),
                objective: "jumpToQuestion",
                target: defaultSurvey.endings[0].id,
              },
            ],
          },
        ],
        headline: { default: t("templates.csat_survey_question_2_headline") },
        required: false,
        placeholder: { default: t("templates.csat_survey_question_2_placeholder") },
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
      {
        id: reusableQuestionIds[2],
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: t("templates.csat_survey_question_3_headline") },
        required: false,
        placeholder: { default: t("templates.csat_survey_question_3_placeholder") },
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
    ],
  };
};

const cessSurvey = (t: TFnType): TXMTemplate => {
  return {
    ...getXMSurveyDefault(t),
    name: t("templates.cess_survey_name"),
    questions: [
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.Rating,
        range: 5,
        scale: "number",
        headline: { default: t("templates.cess_survey_question_1_headline") },
        required: true,
        lowerLabel: { default: t("templates.cess_survey_question_1_lower_label") },
        upperLabel: { default: t("templates.cess_survey_question_1_upper_label") },
        isColorCodingEnabled: false,
      },
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: t("templates.cess_survey_question_2_headline") },
        required: true,
        placeholder: { default: t("templates.cess_survey_question_2_placeholder") },
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
    ],
  };
};

const smileysRatingSurvey = (t: TFnType): TXMTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const defaultSurvey = getXMSurveyDefault(t);

  return {
    ...defaultSurvey,
    name: t("templates.smileys_survey_name"),
    questions: [
      {
        id: reusableQuestionIds[0],
        type: TSurveyQuestionTypeEnum.Rating,
        logic: [
          {
            id: createId(),
            conditions: {
              id: createId(),
              connector: "and",
              conditions: [
                {
                  id: createId(),
                  leftOperand: {
                    value: reusableQuestionIds[0],
                    type: "question",
                  },
                  operator: "isLessThanOrEqual",
                  rightOperand: {
                    type: "static",
                    value: 3,
                  },
                },
              ],
            },
            actions: [
              {
                id: createId(),
                objective: "jumpToQuestion",
                target: reusableQuestionIds[2],
              },
            ],
          },
        ],
        range: 5,
        scale: "smiley",
        headline: { default: t("templates.smileys_survey_question_1_headline") },
        required: true,
        lowerLabel: { default: t("templates.smileys_survey_question_1_lower_label") },
        upperLabel: { default: t("templates.smileys_survey_question_1_upper_label") },
        isColorCodingEnabled: false,
      },
      {
        id: reusableQuestionIds[1],
        html: { default: t("templates.smileys_survey_question_2_html") },
        type: TSurveyQuestionTypeEnum.CTA,
        logic: [
          {
            id: createId(),
            conditions: {
              id: createId(),
              connector: "and",
              conditions: [
                {
                  id: createId(),
                  leftOperand: {
                    value: reusableQuestionIds[1],
                    type: "question",
                  },
                  operator: "isClicked",
                },
              ],
            },
            actions: [
              {
                id: createId(),
                objective: "jumpToQuestion",
                target: defaultSurvey.endings[0].id,
              },
            ],
          },
        ],
        headline: { default: t("templates.smileys_survey_question_2_headline") },
        required: true,
        buttonUrl: "https://formbricks.com/github",
        buttonLabel: { default: t("templates.smileys_survey_question_2_button_label") },
        buttonExternal: true,
      },
      {
        id: reusableQuestionIds[2],
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: t("templates.smileys_survey_question_3_headline") },
        required: true,
        subheader: { default: t("templates.smileys_survey_question_3_subheader") },
        buttonLabel: { default: t("templates.smileys_survey_question_3_button_label") },
        placeholder: { default: t("templates.smileys_survey_question_3_placeholder") },
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
    ],
  };
};

const enpsSurvey = (t: TFnType): TXMTemplate => {
  return {
    ...getXMSurveyDefault(t),
    name: t("templates.enps_survey_name"),
    questions: [
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.NPS,
        headline: {
          default: t("templates.enps_survey_question_1_headline"),
        },
        required: false,
        lowerLabel: { default: t("templates.enps_survey_question_1_lower_label") },
        upperLabel: { default: t("templates.enps_survey_question_1_upper_label") },
        isColorCodingEnabled: true,
      },
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: t("templates.enps_survey_question_2_headline") },
        required: false,
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: t("templates.enps_survey_question_3_headline") },
        required: false,
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
    ],
  };
};

export const getXMTemplates = (t: TFnType): TXMTemplate[] => {
  try {
    return [
      npsSurvey(t),
      starRatingSurvey(t),
      csatSurvey(t),
      cessSurvey(t),
      smileysRatingSurvey(t),
      enpsSurvey(t),
    ];
  } catch (error) {
    logger.warn({ error }, "Unable to load XM templates, returning empty array");
    return []; // Return an empty array or handle as needed
  }
};
