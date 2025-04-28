import {
  buildCTAQuestion,
  buildNPSQuestion,
  buildOpenTextQuestion,
  buildRatingQuestion,
  getDefaultEndingCard,
} from "@/app/lib/survey-builder";
import { createId } from "@paralleldrive/cuid2";
import { TFnType } from "@tolgee/react";
import { logger } from "@formbricks/logger";
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
      buildNPSQuestion({
        headline: t("templates.nps_survey_question_1_headline"),
        required: true,
        lowerLabel: t("templates.nps_survey_question_1_lower_label"),
        upperLabel: t("templates.nps_survey_question_1_upper_label"),
        isColorCodingEnabled: true,
        t,
      }),
      buildOpenTextQuestion({
        headline: t("templates.nps_survey_question_2_headline"),
        required: false,
        inputType: "text",
        t,
      }),
      buildOpenTextQuestion({
        headline: t("templates.nps_survey_question_3_headline"),
        required: false,
        inputType: "text",
        t,
      }),
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
      buildRatingQuestion({
        id: reusableQuestionIds[0],
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
        headline: t("templates.star_rating_survey_question_1_headline"),
        required: true,
        lowerLabel: t("templates.star_rating_survey_question_1_lower_label"),
        upperLabel: t("templates.star_rating_survey_question_1_upper_label"),
        t,
      }),
      buildCTAQuestion({
        id: reusableQuestionIds[1],
        html: t("templates.star_rating_survey_question_2_html"),
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
        headline: t("templates.star_rating_survey_question_2_headline"),
        required: true,
        buttonUrl: "https://formbricks.com/github",
        buttonLabel: t("templates.star_rating_survey_question_2_button_label"),
        buttonExternal: true,
        t,
      }),
      buildOpenTextQuestion({
        id: reusableQuestionIds[2],
        headline: t("templates.star_rating_survey_question_3_headline"),
        required: true,
        subheader: t("templates.star_rating_survey_question_3_subheader"),
        buttonLabel: t("templates.star_rating_survey_question_3_button_label"),
        placeholder: t("templates.star_rating_survey_question_3_placeholder"),
        inputType: "text",
        t,
      }),
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
      buildRatingQuestion({
        id: reusableQuestionIds[0],
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
        headline: t("templates.csat_survey_question_1_headline"),
        required: true,
        lowerLabel: t("templates.csat_survey_question_1_lower_label"),
        upperLabel: t("templates.csat_survey_question_1_upper_label"),
        t,
      }),
      buildOpenTextQuestion({
        id: reusableQuestionIds[1],
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
        headline: t("templates.csat_survey_question_2_headline"),
        required: false,
        placeholder: t("templates.csat_survey_question_2_placeholder"),
        inputType: "text",
        t,
      }),
      buildOpenTextQuestion({
        id: reusableQuestionIds[2],
        headline: t("templates.csat_survey_question_3_headline"),
        required: false,
        placeholder: t("templates.csat_survey_question_3_placeholder"),
        inputType: "text",
        t,
      }),
    ],
  };
};

const cessSurvey = (t: TFnType): TXMTemplate => {
  return {
    ...getXMSurveyDefault(t),
    name: t("templates.cess_survey_name"),
    questions: [
      buildRatingQuestion({
        range: 5,
        scale: "number",
        headline: t("templates.cess_survey_question_1_headline"),
        required: true,
        lowerLabel: t("templates.cess_survey_question_1_lower_label"),
        upperLabel: t("templates.cess_survey_question_1_upper_label"),
        t,
      }),
      buildOpenTextQuestion({
        headline: t("templates.cess_survey_question_2_headline"),
        required: true,
        placeholder: t("templates.cess_survey_question_2_placeholder"),
        inputType: "text",
        t,
      }),
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
      buildRatingQuestion({
        id: reusableQuestionIds[0],
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
        headline: t("templates.smileys_survey_question_1_headline"),
        required: true,
        lowerLabel: t("templates.smileys_survey_question_1_lower_label"),
        upperLabel: t("templates.smileys_survey_question_1_upper_label"),
        t,
      }),
      buildCTAQuestion({
        id: reusableQuestionIds[1],
        html: t("templates.smileys_survey_question_2_html"),
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
        headline: t("templates.smileys_survey_question_2_headline"),
        required: true,
        buttonUrl: "https://formbricks.com/github",
        buttonLabel: t("templates.smileys_survey_question_2_button_label"),
        buttonExternal: true,
        t,
      }),
      buildOpenTextQuestion({
        id: reusableQuestionIds[2],
        headline: t("templates.smileys_survey_question_3_headline"),
        required: true,
        subheader: t("templates.smileys_survey_question_3_subheader"),
        buttonLabel: t("templates.smileys_survey_question_3_button_label"),
        placeholder: t("templates.smileys_survey_question_3_placeholder"),
        inputType: "text",
        t,
      }),
    ],
  };
};

const enpsSurvey = (t: TFnType): TXMTemplate => {
  return {
    ...getXMSurveyDefault(t),
    name: t("templates.enps_survey_name"),
    questions: [
      buildNPSQuestion({
        headline: t("templates.enps_survey_question_1_headline"),
        required: false,
        lowerLabel: t("templates.enps_survey_question_1_lower_label"),
        upperLabel: t("templates.enps_survey_question_1_upper_label"),
        isColorCodingEnabled: true,
        t,
      }),
      buildOpenTextQuestion({
        headline: t("templates.enps_survey_question_2_headline"),
        required: false,
        inputType: "text",
        t,
      }),
      buildOpenTextQuestion({
        headline: t("templates.enps_survey_question_3_headline"),
        required: false,
        inputType: "text",
        t,
      }),
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
    logger.error(error, "Unable to load XM templates, returning empty array");
    return []; // Return an empty array or handle as needed
  }
};
