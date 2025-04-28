import {
  buildCTAQuestion,
  buildConsentQuestion,
  buildMultipleChoiceQuestion,
  buildNPSQuestion,
  buildOpenTextQuestion,
  buildRatingQuestion,
  buildSurvey,
  createChoiceJumpLogic,
  createJumpLogic,
  getDefaultEndingCard,
  getDefaultSurveyPreset,
  hiddenFieldsDefault,
} from "@/app/lib/survey-builder";
import { createId } from "@paralleldrive/cuid2";
import { TFnType } from "@tolgee/react";
import { TSurvey, TSurveyOpenTextQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TTemplate } from "@formbricks/types/templates";

const cartAbandonmentSurvey = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(t);
  return buildSurvey(
    {
      name: t("templates.card_abandonment_survey"),
      role: "productManager",
      industries: ["eCommerce"],
      channels: ["app", "website", "link"],
      description: t("templates.card_abandonment_survey_description"),
      endings: localSurvey.endings,
      questions: [
        buildCTAQuestion({
          id: reusableQuestionIds[0],
          html: t("templates.card_abandonment_survey_question_1_html"),
          logic: [createJumpLogic(reusableQuestionIds[0], localSurvey.endings[0].id, "isSkipped")],
          headline: t("templates.card_abandonment_survey_question_1_headline"),
          required: false,
          buttonLabel: t("templates.card_abandonment_survey_question_1_button_label"),
          buttonExternal: false,
          dismissButtonLabel: t("templates.card_abandonment_survey_question_1_dismiss_button_label"),
          t,
        }),
        buildMultipleChoiceQuestion({
          headline: t("templates.card_abandonment_survey_question_2_headline"),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          subheader: t("templates.card_abandonment_survey_question_2_subheader"),
          choices: [
            t("templates.card_abandonment_survey_question_2_choice_1"),
            t("templates.card_abandonment_survey_question_2_choice_2"),
            t("templates.card_abandonment_survey_question_2_choice_3"),
            t("templates.card_abandonment_survey_question_2_choice_4"),
            t("templates.card_abandonment_survey_question_2_choice_5"),
            t("templates.card_abandonment_survey_question_2_choice_6"),
          ],
          containsOther: true,
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.card_abandonment_survey_question_3_headline"),
          required: false,
          inputType: "text",
          t,
        }),
        buildRatingQuestion({
          headline: t("templates.card_abandonment_survey_question_4_headline"),
          required: true,
          scale: "number",
          range: 5,
          lowerLabel: t("templates.card_abandonment_survey_question_4_lower_label"),
          upperLabel: t("templates.card_abandonment_survey_question_4_upper_label"),
          t,
        }),
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: t("templates.card_abandonment_survey_question_5_headline"),
          subheader: t("templates.card_abandonment_survey_question_5_subheader"),

          required: true,
          choices: [
            t("templates.card_abandonment_survey_question_5_choice_1"),
            t("templates.card_abandonment_survey_question_5_choice_2"),
            t("templates.card_abandonment_survey_question_5_choice_3"),
            t("templates.card_abandonment_survey_question_5_choice_4"),
            t("templates.card_abandonment_survey_question_5_choice_5"),
            t("templates.card_abandonment_survey_question_5_choice_6"),
          ],
          containsOther: true,
          t,
        }),
        buildConsentQuestion({
          id: reusableQuestionIds[1],
          logic: [createJumpLogic(reusableQuestionIds[1], reusableQuestionIds[2], "isSkipped")],
          headline: t("templates.card_abandonment_survey_question_6_headline"),
          required: false,
          label: t("templates.card_abandonment_survey_question_6_label"),
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.card_abandonment_survey_question_7_headline"),
          required: true,
          inputType: "email",
          longAnswer: false,
          placeholder: "example@email.com",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[2],
          headline: t("templates.card_abandonment_survey_question_8_headline"),
          required: false,
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const siteAbandonmentSurvey = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(t);

  return buildSurvey(
    {
      name: t("templates.site_abandonment_survey"),
      role: "productManager",
      industries: ["eCommerce"],
      channels: ["app", "website"],
      description: t("templates.site_abandonment_survey_description"),
      endings: localSurvey.endings,
      questions: [
        buildCTAQuestion({
          id: reusableQuestionIds[0],
          html: t("templates.site_abandonment_survey_question_1_html"),
          logic: [createJumpLogic(reusableQuestionIds[0], localSurvey.endings[0].id, "isSkipped")],
          headline: t("templates.site_abandonment_survey_question_2_headline"),
          required: false,
          buttonLabel: t("templates.site_abandonment_survey_question_2_button_label"),
          buttonExternal: false,
          dismissButtonLabel: t("templates.site_abandonment_survey_question_2_dismiss_button_label"),
          t,
        }),
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.site_abandonment_survey_question_3_headline"),
          subheader: t("templates.site_abandonment_survey_question_3_subheader"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.site_abandonment_survey_question_3_choice_1"),
            t("templates.site_abandonment_survey_question_3_choice_2"),
            t("templates.site_abandonment_survey_question_3_choice_3"),
            t("templates.site_abandonment_survey_question_3_choice_4"),
            t("templates.site_abandonment_survey_question_3_choice_5"),
            t("templates.site_abandonment_survey_question_3_choice_6"),
          ],
          containsOther: true,
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.site_abandonment_survey_question_4_headline"),
          required: false,
          inputType: "text",
          t,
        }),
        buildRatingQuestion({
          headline: t("templates.site_abandonment_survey_question_5_headline"),
          required: true,
          scale: "number",
          range: 5,
          lowerLabel: t("templates.site_abandonment_survey_question_5_lower_label"),
          upperLabel: t("templates.site_abandonment_survey_question_5_upper_label"),
          t,
        }),
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: t("templates.site_abandonment_survey_question_6_headline"),
          subheader: t("templates.site_abandonment_survey_question_6_subheader"),
          required: true,
          choices: [
            t("templates.site_abandonment_survey_question_6_choice_1"),
            t("templates.site_abandonment_survey_question_6_choice_2"),
            t("templates.site_abandonment_survey_question_6_choice_3"),
            t("templates.site_abandonment_survey_question_6_choice_4"),
            t("templates.site_abandonment_survey_question_6_choice_5"),
          ],
          t,
        }),
        buildConsentQuestion({
          id: reusableQuestionIds[1],
          logic: [createJumpLogic(reusableQuestionIds[1], reusableQuestionIds[2], "isSkipped")],
          headline: t("templates.site_abandonment_survey_question_7_headline"),
          required: false,
          label: t("templates.site_abandonment_survey_question_7_label"),
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.site_abandonment_survey_question_8_headline"),
          required: true,
          inputType: "email",
          longAnswer: false,
          placeholder: "example@email.com",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[2],
          headline: t("templates.site_abandonment_survey_question_9_headline"),
          required: false,
          inputType: "text",
          t,
        }),
      ],
    },
    t
  );
};

const productMarketFitSuperhuman = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId()];
  const localSurvey = getDefaultSurveyPreset(t);
  return buildSurvey(
    {
      name: t("templates.product_market_fit_superhuman"),
      role: "productManager",
      industries: ["saas"],
      channels: ["app", "link"],
      description: t("templates.product_market_fit_superhuman_description"),
      endings: localSurvey.endings,
      questions: [
        buildCTAQuestion({
          id: reusableQuestionIds[0],
          html: t("templates.product_market_fit_superhuman_question_1_html"),
          logic: [createJumpLogic(reusableQuestionIds[0], localSurvey.endings[0].id, "isSkipped")],
          headline: t("templates.product_market_fit_superhuman_question_1_headline"),
          required: false,
          buttonLabel: t("templates.product_market_fit_superhuman_question_1_button_label"),
          buttonExternal: false,
          dismissButtonLabel: t("templates.product_market_fit_superhuman_question_1_dismiss_button_label"),
          t,
        }),
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.product_market_fit_superhuman_question_2_headline"),
          subheader: t("templates.product_market_fit_superhuman_question_2_subheader"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.product_market_fit_superhuman_question_2_choice_1"),
            t("templates.product_market_fit_superhuman_question_2_choice_2"),
            t("templates.product_market_fit_superhuman_question_2_choice_3"),
          ],
          t,
        }),
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: "templates.product_market_fit_superhuman_question_3_headline",
          subheader: t("templates.product_market_fit_superhuman_question_3_subheader"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.product_market_fit_superhuman_question_3_choice_1"),
            t("templates.product_market_fit_superhuman_question_3_choice_2"),
            t("templates.product_market_fit_superhuman_question_3_choice_3"),
            t("templates.product_market_fit_superhuman_question_3_choice_4"),
            t("templates.product_market_fit_superhuman_question_3_choice_5"),
          ],
          t,
        }),
        buildOpenTextQuestion({
          id: createId(),
          headline: t("templates.product_market_fit_superhuman_question_4_headline"),
          required: true,
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.product_market_fit_superhuman_question_5_headline"),
          required: true,
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.product_market_fit_superhuman_question_6_headline"),
          subheader: t("templates.product_market_fit_superhuman_question_6_subheader"),
          required: true,
          inputType: "text",
          t,
        }),
      ],
    },
    t
  );
};

const onboardingSegmentation = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.onboarding_segmentation"),
      role: "productManager",
      industries: ["saas"],
      channels: ["app", "link"],
      description: t("templates.onboarding_segmentation_description"),
      questions: [
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.onboarding_segmentation_question_1_headline"),
          subheader: t("templates.onboarding_segmentation_question_1_subheader"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.onboarding_segmentation_question_1_choice_1"),
            t("templates.onboarding_segmentation_question_1_choice_2"),
            t("templates.onboarding_segmentation_question_1_choice_3"),
            t("templates.onboarding_segmentation_question_1_choice_4"),
            t("templates.onboarding_segmentation_question_1_choice_5"),
          ],
          t,
        }),
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.onboarding_segmentation_question_2_headline"),
          subheader: t("templates.onboarding_segmentation_question_2_subheader"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.onboarding_segmentation_question_2_choice_1"),
            t("templates.onboarding_segmentation_question_2_choice_2"),
            t("templates.onboarding_segmentation_question_2_choice_3"),
            t("templates.onboarding_segmentation_question_2_choice_4"),
            t("templates.onboarding_segmentation_question_2_choice_5"),
          ],
          t,
        }),
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.onboarding_segmentation_question_3_headline"),
          subheader: t("templates.onboarding_segmentation_question_3_subheader"),
          required: true,
          buttonLabel: t("templates.finish"),
          shuffleOption: "none",
          choices: [
            t("templates.onboarding_segmentation_question_3_choice_1"),
            t("templates.onboarding_segmentation_question_3_choice_2"),
            t("templates.onboarding_segmentation_question_3_choice_3"),
            t("templates.onboarding_segmentation_question_3_choice_4"),
            t("templates.onboarding_segmentation_question_3_choice_5"),
          ],
          t,
        }),
      ],
    },
    t
  );
};

const churnSurvey = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(t);
  return buildSurvey(
    {
      name: t("templates.churn_survey"),
      role: "sales",
      industries: ["saas", "eCommerce", "other"],
      channels: ["app", "link"],
      description: t("templates.churn_survey_description"),
      endings: localSurvey.endings,
      questions: [
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[0], reusableQuestionIds[1]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[1], reusableQuestionIds[2]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[2], reusableQuestionIds[3]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[3], reusableQuestionIds[4]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[4], localSurvey.endings[0].id),
          ],
          choices: [
            t("templates.churn_survey_question_1_choice_1"),
            t("templates.churn_survey_question_1_choice_2"),
            t("templates.churn_survey_question_1_choice_3"),
            t("templates.churn_survey_question_1_choice_4"),
            t("templates.churn_survey_question_1_choice_5"),
          ],
          choiceIds: [
            reusableOptionIds[0],
            reusableOptionIds[1],
            reusableOptionIds[2],
            reusableOptionIds[3],
            reusableOptionIds[4],
          ],
          headline: t("templates.churn_survey_question_1_headline"),
          required: true,
          subheader: t("templates.churn_survey_question_1_subheader"),
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[1],
          logic: [createJumpLogic(reusableQuestionIds[1], localSurvey.endings[0].id, "isSubmitted")],
          headline: t("templates.churn_survey_question_2_headline"),
          required: true,
          buttonLabel: t("templates.churn_survey_question_2_button_label"),
          inputType: "text",
          t,
        }),
        buildCTAQuestion({
          id: reusableQuestionIds[2],
          html: t("templates.churn_survey_question_3_html"),
          logic: [createJumpLogic(reusableQuestionIds[2], localSurvey.endings[0].id, "isClicked")],
          headline: t("templates.churn_survey_question_3_headline"),
          required: true,
          buttonUrl: "https://formbricks.com",
          buttonLabel: t("templates.churn_survey_question_3_button_label"),
          buttonExternal: true,
          dismissButtonLabel: t("templates.churn_survey_question_3_dismiss_button_label"),
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[3],
          logic: [createJumpLogic(reusableQuestionIds[3], localSurvey.endings[0].id, "isSubmitted")],
          headline: t("templates.churn_survey_question_4_headline"),
          required: true,
          inputType: "text",
          t,
        }),
        buildCTAQuestion({
          id: reusableQuestionIds[4],
          html: t("templates.churn_survey_question_5_html"),
          logic: [createJumpLogic(reusableQuestionIds[4], localSurvey.endings[0].id, "isClicked")],
          headline: t("templates.churn_survey_question_5_headline"),
          required: true,
          buttonUrl: "mailto:ceo@company.com",
          buttonLabel: t("templates.churn_survey_question_5_button_label"),
          buttonExternal: true,
          dismissButtonLabel: t("templates.churn_survey_question_5_dismiss_button_label"),
          t,
        }),
      ],
    },
    t
  );
};

const earnedAdvocacyScore = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(t);
  return buildSurvey(
    {
      name: t("templates.earned_advocacy_score_name"),
      role: "customerSuccess",
      industries: ["saas", "eCommerce", "other"],
      channels: ["app", "link"],
      description: t("templates.earned_advocacy_score_description"),
      endings: localSurvey.endings,
      questions: [
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[1], reusableQuestionIds[2]),
          ],
          shuffleOption: "none",
          choices: [
            t("templates.earned_advocacy_score_question_1_choice_1"),
            t("templates.earned_advocacy_score_question_1_choice_2"),
          ],
          choiceIds: [reusableOptionIds[0], reusableOptionIds[1]],
          headline: t("templates.earned_advocacy_score_question_1_headline"),
          required: true,
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[1],
          logic: [createJumpLogic(reusableQuestionIds[1], reusableQuestionIds[3], "isSubmitted")],
          headline: t("templates.earned_advocacy_score_question_2_headline"),
          required: true,
          placeholder: t("templates.earned_advocacy_score_question_2_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[2],
          headline: t("templates.earned_advocacy_score_question_3_headline"),
          required: true,
          placeholder: t("templates.earned_advocacy_score_question_3_placeholder"),
          inputType: "text",
          t,
        }),
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [
            createChoiceJumpLogic(reusableQuestionIds[3], reusableOptionIds[3], localSurvey.endings[0].id),
          ],
          shuffleOption: "none",
          choices: [
            t("templates.earned_advocacy_score_question_4_choice_1"),
            t("templates.earned_advocacy_score_question_4_choice_2"),
          ],
          choiceIds: [reusableOptionIds[2], reusableOptionIds[3]],
          headline: t("templates.earned_advocacy_score_question_4_headline"),
          required: true,
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.earned_advocacy_score_question_5_headline"),
          required: true,
          placeholder: t("templates.earned_advocacy_score_question_5_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const improveTrialConversion = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId(), createId()];
  const reusableOptionIds = [
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
  ];
  const localSurvey = getDefaultSurveyPreset(t);
  return buildSurvey(
    {
      name: t("templates.improve_trial_conversion_name"),
      role: "sales",
      industries: ["saas"],
      channels: ["link", "app"],
      description: t("templates.improve_trial_conversion_description"),
      endings: localSurvey.endings,
      questions: [
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[0], reusableQuestionIds[1]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[1], reusableQuestionIds[2]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[2], reusableQuestionIds[3]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[3], reusableQuestionIds[4]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[4], localSurvey.endings[0].id),
          ],
          choices: [
            t("templates.improve_trial_conversion_question_1_choice_1"),
            t("templates.improve_trial_conversion_question_1_choice_2"),
            t("templates.improve_trial_conversion_question_1_choice_3"),
            t("templates.improve_trial_conversion_question_1_choice_4"),
            t("templates.improve_trial_conversion_question_1_choice_5"),
          ],
          choiceIds: [
            reusableOptionIds[0],
            reusableOptionIds[1],
            reusableOptionIds[2],
            reusableOptionIds[3],
            reusableOptionIds[4],
          ],
          headline: t("templates.improve_trial_conversion_question_1_headline"),
          required: true,
          subheader: t("templates.improve_trial_conversion_question_1_subheader"),
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[1],
          logic: [createJumpLogic(reusableQuestionIds[1], reusableQuestionIds[5], "isSubmitted")],
          headline: t("templates.improve_trial_conversion_question_2_headline"),
          required: true,
          buttonLabel: t("templates.improve_trial_conversion_question_2_button_label"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[2],
          logic: [createJumpLogic(reusableQuestionIds[2], reusableQuestionIds[5], "isSubmitted")],
          headline: t("templates.improve_trial_conversion_question_2_headline"),
          required: true,
          buttonLabel: t("templates.improve_trial_conversion_question_2_button_label"),
          inputType: "text",
          t,
        }),
        buildCTAQuestion({
          id: reusableQuestionIds[3],
          html: t("templates.improve_trial_conversion_question_4_html"),
          logic: [createJumpLogic(reusableQuestionIds[3], localSurvey.endings[0].id, "isClicked")],
          headline: t("templates.improve_trial_conversion_question_4_headline"),
          required: true,
          buttonUrl: "https://formbricks.com/github",
          buttonLabel: t("templates.improve_trial_conversion_question_4_button_label"),
          buttonExternal: true,
          dismissButtonLabel: t("templates.improve_trial_conversion_question_4_dismiss_button_label"),
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[4],
          logic: [createJumpLogic(reusableQuestionIds[4], reusableQuestionIds[5], "isSubmitted")],
          headline: t("templates.improve_trial_conversion_question_5_headline"),
          required: true,
          subheader: t("templates.improve_trial_conversion_question_5_subheader"),
          buttonLabel: t("templates.improve_trial_conversion_question_5_button_label"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[5],
          logic: [
            createJumpLogic(reusableQuestionIds[5], localSurvey.endings[0].id, "isSubmitted"),
            createJumpLogic(reusableQuestionIds[5], localSurvey.endings[0].id, "isSkipped"),
          ],
          headline: t("templates.improve_trial_conversion_question_6_headline"),
          required: false,
          subheader: t("templates.improve_trial_conversion_question_6_subheader"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const reviewPrompt = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId()];

  return buildSurvey(
    {
      name: t("templates.review_prompt_name"),
      role: "marketing",
      industries: ["saas", "eCommerce", "other"],
      channels: ["link", "app"],
      description: t("templates.review_prompt_description"),
      endings: localSurvey.endings,
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
          scale: "star",
          headline: t("templates.review_prompt_question_1_headline"),
          required: true,
          lowerLabel: t("templates.review_prompt_question_1_lower_label"),
          upperLabel: t("templates.review_prompt_question_1_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildCTAQuestion({
          id: reusableQuestionIds[1],
          html: t("templates.review_prompt_question_2_html"),
          logic: [createJumpLogic(reusableQuestionIds[1], localSurvey.endings[0].id, "isClicked")],
          headline: t("templates.review_prompt_question_2_headline"),
          required: true,
          buttonUrl: "https://formbricks.com/github",
          buttonLabel: t("templates.review_prompt_question_2_button_label"),
          buttonExternal: true,
          backButtonLabel: t("templates.back"),
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[2],
          headline: t("templates.review_prompt_question_3_headline"),
          required: true,
          subheader: t("templates.review_prompt_question_3_subheader"),
          buttonLabel: t("templates.review_prompt_question_3_button_label"),
          placeholder: t("templates.review_prompt_question_3_placeholder"),
          inputType: "text",
          t,
        }),
      ],
    },
    t
  );
};

const interviewPrompt = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.interview_prompt_name"),
      role: "productManager",
      industries: ["saas"],
      channels: ["app"],
      description: t("templates.interview_prompt_description"),
      questions: [
        buildCTAQuestion({
          id: createId(),
          headline: t("templates.interview_prompt_question_1_headline"),
          html: t("templates.interview_prompt_question_1_html"),
          buttonLabel: t("templates.interview_prompt_question_1_button_label"),
          buttonUrl: "https://cal.com/johannes",
          buttonExternal: true,
          required: false,
          t,
        }),
      ],
    },
    t
  );
};

const improveActivationRate = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(t);
  return buildSurvey(
    {
      name: t("templates.improve_activation_rate_name"),
      role: "productManager",
      industries: ["saas"],
      channels: ["link"],
      description: t("templates.improve_activation_rate_description"),
      endings: localSurvey.endings,
      questions: [
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[1], reusableQuestionIds[2]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[2], reusableQuestionIds[3]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[3], reusableQuestionIds[4]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[4], reusableQuestionIds[5]),
          ],
          choices: [
            t("templates.improve_activation_rate_question_1_choice_1"),
            t("templates.improve_activation_rate_question_1_choice_2"),
            t("templates.improve_activation_rate_question_1_choice_3"),
            t("templates.improve_activation_rate_question_1_choice_4"),
            t("templates.improve_activation_rate_question_1_choice_5"),
          ],
          choiceIds: [
            reusableOptionIds[0],
            reusableOptionIds[1],
            reusableOptionIds[2],
            reusableOptionIds[3],
            reusableOptionIds[4],
          ],
          headline: t("templates.improve_activation_rate_question_1_headline"),
          required: true,
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[1],
          logic: [createJumpLogic(reusableQuestionIds[1], localSurvey.endings[0].id, "isSubmitted")],
          headline: t("templates.improve_activation_rate_question_2_headline"),
          required: true,
          placeholder: t("templates.improve_activation_rate_question_2_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[2],
          logic: [createJumpLogic(reusableQuestionIds[2], localSurvey.endings[0].id, "isSubmitted")],
          headline: t("templates.improve_activation_rate_question_3_headline"),
          required: true,
          placeholder: t("templates.improve_activation_rate_question_3_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[3],
          logic: [createJumpLogic(reusableQuestionIds[3], localSurvey.endings[0].id, "isSubmitted")],
          headline: t("templates.improve_activation_rate_question_4_headline"),
          required: true,
          placeholder: t("templates.improve_activation_rate_question_4_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[4],
          logic: [createJumpLogic(reusableQuestionIds[4], localSurvey.endings[0].id, "isSubmitted")],
          headline: t("templates.improve_activation_rate_question_5_headline"),
          required: true,
          placeholder: t("templates.improve_activation_rate_question_5_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[5],
          logic: [],
          headline: t("templates.improve_activation_rate_question_6_headline"),
          required: false,
          subheader: t("templates.improve_activation_rate_question_6_subheader"),
          placeholder: t("templates.improve_activation_rate_question_6_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const employeeSatisfaction = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.employee_satisfaction_name"),
      role: "peopleManager",
      industries: ["saas", "eCommerce", "other"],
      channels: ["app", "link"],
      description: t("templates.employee_satisfaction_description"),
      questions: [
        buildRatingQuestion({
          range: 5,
          scale: "star",
          headline: t("templates.employee_satisfaction_question_1_headline"),
          required: true,
          lowerLabel: t("templates.employee_satisfaction_question_1_lower_label"),
          upperLabel: t("templates.employee_satisfaction_question_1_upper_label"),
          isColorCodingEnabled: true,
          t,
        }),
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            t("templates.employee_satisfaction_question_2_choice_1"),
            t("templates.employee_satisfaction_question_2_choice_2"),
            t("templates.employee_satisfaction_question_2_choice_3"),
            t("templates.employee_satisfaction_question_2_choice_4"),
            t("templates.employee_satisfaction_question_2_choice_5"),
          ],
          headline: t("templates.employee_satisfaction_question_2_headline"),
          required: true,
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.employee_satisfaction_question_3_headline"),
          required: false,
          placeholder: t("templates.employee_satisfaction_question_3_placeholder"),
          inputType: "text",
          t,
        }),
        buildRatingQuestion({
          range: 5,
          scale: "number",
          headline: t("templates.employee_satisfaction_question_5_headline"),
          required: true,
          lowerLabel: t("templates.employee_satisfaction_question_5_lower_label"),
          upperLabel: t("templates.employee_satisfaction_question_5_upper_label"),
          isColorCodingEnabled: true,
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.employee_satisfaction_question_6_headline"),
          required: false,
          placeholder: t("templates.employee_satisfaction_question_6_placeholder"),
          inputType: "text",
          t,
        }),
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            t("templates.employee_satisfaction_question_7_choice_1"),
            t("templates.employee_satisfaction_question_7_choice_2"),
            t("templates.employee_satisfaction_question_7_choice_3"),
            t("templates.employee_satisfaction_question_7_choice_4"),
            t("templates.employee_satisfaction_question_7_choice_5"),
          ],
          headline: t("templates.employee_satisfaction_question_7_headline"),
          required: true,
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const uncoverStrengthsAndWeaknesses = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.uncover_strengths_and_weaknesses_name"),
      role: "productManager",
      industries: ["saas", "other"],
      channels: ["app", "link"],
      description: t("templates.uncover_strengths_and_weaknesses_description"),
      questions: [
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            t("templates.uncover_strengths_and_weaknesses_question_1_choice_1"),
            t("templates.uncover_strengths_and_weaknesses_question_1_choice_2"),
            t("templates.uncover_strengths_and_weaknesses_question_1_choice_3"),
            t("templates.uncover_strengths_and_weaknesses_question_1_choice_4"),
            t("templates.uncover_strengths_and_weaknesses_question_1_choice_5"),
          ],
          headline: t("templates.uncover_strengths_and_weaknesses_question_1_headline"),
          required: true,
          containsOther: true,
          t,
        }),
        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            t("templates.uncover_strengths_and_weaknesses_question_2_choice_1"),
            t("templates.uncover_strengths_and_weaknesses_question_2_choice_2"),
            t("templates.uncover_strengths_and_weaknesses_question_2_choice_3"),
            t("templates.uncover_strengths_and_weaknesses_question_2_choice_4"),
          ],
          headline: t("templates.uncover_strengths_and_weaknesses_question_2_headline"),
          required: true,
          subheader: t("templates.uncover_strengths_and_weaknesses_question_2_subheader"),
          containsOther: true,
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.uncover_strengths_and_weaknesses_question_3_headline"),
          required: false,
          subheader: t("templates.uncover_strengths_and_weaknesses_question_3_subheader"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const productMarketFitShort = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.product_market_fit_short_name"),
      role: "productManager",
      industries: ["saas"],
      channels: ["app", "link"],
      description: t("templates.product_market_fit_short_description"),
      questions: [
        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.product_market_fit_short_question_1_headline"),
          subheader: t("templates.product_market_fit_short_question_1_subheader"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.product_market_fit_short_question_1_choice_1"),
            t("templates.product_market_fit_short_question_1_choice_2"),
            t("templates.product_market_fit_short_question_1_choice_3"),
          ],
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.product_market_fit_short_question_2_headline"),
          subheader: t("templates.product_market_fit_short_question_2_subheader"),
          required: true,
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const marketAttribution = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.market_attribution_name"),
      role: "marketing",
      industries: ["saas", "eCommerce"],
      channels: ["website", "app", "link"],
      description: t("templates.market_attribution_description"),
      questions: [
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.market_attribution_question_1_headline"),
          subheader: t("templates.market_attribution_question_1_subheader"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.market_attribution_question_1_choice_1"),
            t("templates.market_attribution_question_1_choice_2"),
            t("templates.market_attribution_question_1_choice_3"),
            t("templates.market_attribution_question_1_choice_4"),
            t("templates.market_attribution_question_1_choice_5"),
          ],
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const changingSubscriptionExperience = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.changing_subscription_experience_name"),
      role: "productManager",
      industries: ["saas"],
      channels: ["app"],
      description: t("templates.changing_subscription_experience_description"),
      questions: [
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.changing_subscription_experience_question_1_headline"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.changing_subscription_experience_question_1_choice_1"),
            t("templates.changing_subscription_experience_question_1_choice_2"),
            t("templates.changing_subscription_experience_question_1_choice_3"),
            t("templates.changing_subscription_experience_question_1_choice_4"),
            t("templates.changing_subscription_experience_question_1_choice_5"),
          ],
          buttonLabel: t("templates.next"),
          t,
        }),
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.changing_subscription_experience_question_2_headline"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.changing_subscription_experience_question_2_choice_1"),
            t("templates.changing_subscription_experience_question_2_choice_2"),
            t("templates.changing_subscription_experience_question_2_choice_3"),
          ],
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const identifyCustomerGoals = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.identify_customer_goals_name"),
      role: "productManager",
      industries: ["saas", "other"],
      channels: ["app", "website"],
      description: t("templates.identify_customer_goals_description"),
      questions: [
        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: "What's your primary goal for using $[projectName]?",
          required: true,
          shuffleOption: "none",
          choices: [
            "Understand my user base deeply",
            "Identify upselling opportunities",
            "Build the best possible product",
            "Rule the world to make everyone breakfast brussels sprouts.",
          ],
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const featureChaser = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.feature_chaser_name"),
      role: "productManager",
      industries: ["saas"],
      channels: ["app"],
      description: t("templates.feature_chaser_description"),
      questions: [
        buildRatingQuestion({
          range: 5,
          scale: "number",
          headline: t("templates.feature_chaser_question_1_headline"),
          required: true,
          lowerLabel: t("templates.feature_chaser_question_1_lower_label"),
          upperLabel: t("templates.feature_chaser_question_1_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            t("templates.feature_chaser_question_2_choice_1"),
            t("templates.feature_chaser_question_2_choice_2"),
            t("templates.feature_chaser_question_2_choice_3"),
            t("templates.feature_chaser_question_2_choice_4"),
          ],
          headline: t("templates.feature_chaser_question_2_headline"),
          required: true,
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const fakeDoorFollowUp = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.fake_door_follow_up_name"),
      role: "productManager",
      industries: ["saas", "eCommerce"],
      channels: ["app", "website"],
      description: t("templates.fake_door_follow_up_description"),
      questions: [
        buildRatingQuestion({
          headline: t("templates.fake_door_follow_up_question_1_headline"),
          required: true,
          lowerLabel: t("templates.fake_door_follow_up_question_1_lower_label"),
          upperLabel: t("templates.fake_door_follow_up_question_1_upper_label"),
          range: 5,
          scale: "number",
          isColorCodingEnabled: false,
          buttonLabel: t("templates.next"),
          t,
        }),
        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: t("templates.fake_door_follow_up_question_2_headline"),
          required: false,
          shuffleOption: "none",
          choices: [
            t("templates.fake_door_follow_up_question_2_choice_1"),
            t("templates.fake_door_follow_up_question_2_choice_2"),
            t("templates.fake_door_follow_up_question_2_choice_3"),
            t("templates.fake_door_follow_up_question_2_choice_4"),
          ],
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const feedbackBox = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(t);
  return buildSurvey(
    {
      name: t("templates.feedback_box_name"),
      role: "productManager",
      industries: ["saas"],
      channels: ["app"],
      description: t("templates.feedback_box_description"),
      endings: localSurvey.endings,
      questions: [
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[0], reusableQuestionIds[1]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[1], reusableQuestionIds[3]),
          ],
          choices: [
            t("templates.feedback_box_question_1_choice_1"),
            t("templates.feedback_box_question_1_choice_2"),
          ],
          headline: t("templates.feedback_box_question_1_headline"),
          required: true,
          subheader: t("templates.feedback_box_question_1_subheader"),
          buttonLabel: t("templates.next"),
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[1],
          logic: [createJumpLogic(reusableQuestionIds[1], reusableQuestionIds[2], "isSubmitted")],
          headline: t("templates.feedback_box_question_2_headline"),
          required: true,
          subheader: t("templates.feedback_box_question_2_subheader"),
          inputType: "text",
          t,
        }),
        buildCTAQuestion({
          id: reusableQuestionIds[2],
          html: t("templates.feedback_box_question_3_html"),
          logic: [
            createJumpLogic(reusableQuestionIds[2], localSurvey.endings[0].id, "isClicked"),
            createJumpLogic(reusableQuestionIds[2], localSurvey.endings[0].id, "isSkipped"),
          ],
          headline: t("templates.feedback_box_question_3_headline"),
          required: false,
          buttonLabel: t("templates.feedback_box_question_3_button_label"),
          buttonExternal: false,
          dismissButtonLabel: t("templates.feedback_box_question_3_dismiss_button_label"),
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[3],
          headline: t("templates.feedback_box_question_4_headline"),
          required: true,
          subheader: t("templates.feedback_box_question_4_subheader"),
          buttonLabel: t("templates.feedback_box_question_4_button_label"),
          placeholder: t("templates.feedback_box_question_4_placeholder"),
          inputType: "text",
          t,
        }),
      ],
    },
    t
  );
};

const integrationSetupSurvey = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];

  return buildSurvey(
    {
      name: t("templates.integration_setup_survey_name"),
      role: "productManager",
      industries: ["saas"],
      channels: ["app"],
      description: t("templates.integration_setup_survey_description"),
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
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
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
          headline: t("templates.integration_setup_survey_question_1_headline"),
          required: true,
          lowerLabel: t("templates.integration_setup_survey_question_1_lower_label"),
          upperLabel: t("templates.integration_setup_survey_question_1_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[1],
          headline: t("templates.integration_setup_survey_question_2_headline"),
          required: false,
          placeholder: t("templates.integration_setup_survey_question_2_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[2],
          headline: t("templates.integration_setup_survey_question_3_headline"),
          required: false,
          subheader: t("templates.integration_setup_survey_question_3_subheader"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const newIntegrationSurvey = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.new_integration_survey_name"),
      role: "productManager",
      industries: ["saas"],
      channels: ["app"],
      description: t("templates.new_integration_survey_description"),
      questions: [
        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.new_integration_survey_question_1_headline"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.new_integration_survey_question_1_choice_1"),
            t("templates.new_integration_survey_question_1_choice_2"),
            t("templates.new_integration_survey_question_1_choice_3"),
            t("templates.new_integration_survey_question_1_choice_4"),
            t("templates.new_integration_survey_question_1_choice_5"),
          ],
          buttonLabel: t("templates.finish"),
          containsOther: true,
          t,
        }),
      ],
    },
    t
  );
};

const docsFeedback = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.docs_feedback_name"),
      role: "productManager",
      industries: ["saas"],
      channels: ["app", "website", "link"],
      description: t("templates.docs_feedback_description"),
      questions: [
        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.docs_feedback_question_1_headline"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.docs_feedback_question_1_choice_1"),
            t("templates.docs_feedback_question_1_choice_2"),
          ],
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.docs_feedback_question_2_headline"),
          required: false,
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.docs_feedback_question_3_headline"),
          required: false,
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const nps = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.nps_name"),
      role: "customerSuccess",
      industries: ["saas", "eCommerce", "other"],
      channels: ["app", "link", "website"],
      description: t("templates.nps_description"),
      questions: [
        buildNPSQuestion({
          headline: t("templates.nps_question_1_headline"),
          required: false,
          lowerLabel: t("templates.nps_question_1_lower_label"),
          upperLabel: t("templates.nps_question_1_upper_label"),
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.nps_question_2_headline"),
          required: false,
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const customerSatisfactionScore = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
  ];
  return buildSurvey(
    {
      name: t("templates.csat_name"),
      role: "customerSuccess",
      industries: ["saas", "eCommerce", "other"],
      channels: ["app", "link", "website"],
      description: t("templates.csat_description"),
      questions: [
        buildRatingQuestion({
          id: reusableQuestionIds[0],
          range: 10,
          scale: "number",
          headline: t("templates.csat_question_1_headline"),
          required: true,
          lowerLabel: t("templates.csat_question_1_lower_label"),
          upperLabel: t("templates.csat_question_1_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.csat_question_2_headline"),
          subheader: t("templates.csat_question_2_subheader"),
          required: true,
          choices: [
            t("templates.csat_question_2_choice_1"),
            t("templates.csat_question_2_choice_2"),
            t("templates.csat_question_2_choice_3"),
            t("templates.csat_question_2_choice_4"),
            t("templates.csat_question_2_choice_5"),
          ],
          t,
        }),
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: t("templates.csat_question_3_headline"),
          subheader: t("templates.csat_question_3_subheader"),
          required: true,
          choices: [
            t("templates.csat_question_3_choice_1"),
            t("templates.csat_question_3_choice_2"),
            t("templates.csat_question_3_choice_3"),
            t("templates.csat_question_3_choice_4"),
            t("templates.csat_question_3_choice_5"),
            t("templates.csat_question_3_choice_6"),
            t("templates.csat_question_3_choice_7"),
            t("templates.csat_question_3_choice_8"),
            t("templates.csat_question_3_choice_9"),
            t("templates.csat_question_3_choice_10"),
          ],
          t,
        }),
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.csat_question_4_headline"),
          subheader: t("templates.csat_question_4_subheader"),
          required: true,
          choices: [
            t("templates.csat_question_4_choice_1"),
            t("templates.csat_question_4_choice_2"),
            t("templates.csat_question_4_choice_3"),
            t("templates.csat_question_4_choice_4"),
            t("templates.csat_question_4_choice_5"),
          ],
          t,
        }),
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.csat_question_5_headline"),
          subheader: t("templates.csat_question_5_subheader"),
          required: true,
          choices: [
            t("templates.csat_question_5_choice_1"),
            t("templates.csat_question_5_choice_2"),
            t("templates.csat_question_5_choice_3"),
            t("templates.csat_question_5_choice_4"),
            t("templates.csat_question_5_choice_5"),
          ],
          t,
        }),
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.csat_question_6_headline"),
          subheader: t("templates.csat_question_6_subheader"),
          required: true,
          choices: [
            t("templates.csat_question_6_choice_1"),
            t("templates.csat_question_6_choice_2"),
            t("templates.csat_question_6_choice_3"),
            t("templates.csat_question_6_choice_4"),
            t("templates.csat_question_6_choice_5"),
          ],
          t,
        }),
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[6],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.csat_question_7_headline"),
          subheader: t("templates.csat_question_7_subheader"),
          required: true,
          choices: [
            t("templates.csat_question_7_choice_1"),
            t("templates.csat_question_7_choice_2"),
            t("templates.csat_question_7_choice_3"),
            t("templates.csat_question_7_choice_4"),
            t("templates.csat_question_7_choice_5"),
          ],
          t,
        }),
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[7],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.csat_question_8_headline"),
          subheader: t("templates.csat_question_8_subheader"),
          required: true,
          choices: [
            t("templates.csat_question_8_choice_1"),
            t("templates.csat_question_8_choice_2"),
            t("templates.csat_question_8_choice_3"),
            t("templates.csat_question_8_choice_4"),
            t("templates.csat_question_8_choice_5"),
          ],
          t,
        }),
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[8],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.csat_question_9_headline"),
          subheader: t("templates.csat_question_9_subheader"),
          required: true,
          choices: [
            t("templates.csat_question_9_choice_1"),
            t("templates.csat_question_9_choice_2"),
            t("templates.csat_question_9_choice_3"),
            t("templates.csat_question_9_choice_4"),
            t("templates.csat_question_9_choice_5"),
          ],
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[9],
          headline: t("templates.csat_question_10_headline"),
          required: false,
          placeholder: t("templates.csat_question_10_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const collectFeedback = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
  ];
  return buildSurvey(
    {
      name: t("templates.collect_feedback_name"),
      role: "productManager",
      industries: ["other", "eCommerce"],
      channels: ["website", "link"],
      description: t("templates.collect_feedback_description"),
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
          scale: "star",
          headline: t("templates.collect_feedback_question_1_headline"),
          subheader: t("templates.collect_feedback_question_1_subheader"),
          required: true,
          lowerLabel: t("templates.collect_feedback_question_1_lower_label"),
          upperLabel: t("templates.collect_feedback_question_1_upper_label"),
          isColorCodingEnabled: false,
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
                  target: reusableQuestionIds[3],
                },
              ],
            },
          ],
          headline: t("templates.collect_feedback_question_2_headline"),
          required: true,
          longAnswer: true,
          placeholder: t("templates.collect_feedback_question_2_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[2],
          headline: t("templates.collect_feedback_question_3_headline"),
          required: true,
          longAnswer: true,
          placeholder: t("templates.collect_feedback_question_3_placeholder"),
          inputType: "text",
          t,
        }),
        buildRatingQuestion({
          id: reusableQuestionIds[3],
          range: 5,
          scale: "smiley",
          headline: t("templates.collect_feedback_question_4_headline"),
          required: true,
          lowerLabel: t("templates.collect_feedback_question_4_lower_label"),
          upperLabel: t("templates.collect_feedback_question_4_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[4],
          headline: t("templates.collect_feedback_question_5_headline"),
          required: false,
          longAnswer: true,
          placeholder: t("templates.collect_feedback_question_5_placeholder"),
          inputType: "text",
          t,
        }),
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          choices: [
            t("templates.collect_feedback_question_6_choice_1"),
            t("templates.collect_feedback_question_6_choice_2"),
            t("templates.collect_feedback_question_6_choice_3"),
            t("templates.collect_feedback_question_6_choice_4"),
            t("templates.collect_feedback_question_6_choice_5"),
          ],
          headline: t("templates.collect_feedback_question_6_headline"),
          required: true,
          shuffleOption: "none",
          containsOther: true,
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[6],
          headline: t("templates.collect_feedback_question_7_headline"),
          required: false,
          inputType: "email",
          longAnswer: false,
          placeholder: t("templates.collect_feedback_question_7_placeholder"),
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const identifyUpsellOpportunities = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.identify_upsell_opportunities_name"),
      role: "sales",
      industries: ["saas"],
      channels: ["app", "link"],
      description: t("templates.identify_upsell_opportunities_description"),
      questions: [
        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.identify_upsell_opportunities_question_1_headline"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.identify_upsell_opportunities_question_1_choice_1"),
            t("templates.identify_upsell_opportunities_question_1_choice_2"),
            t("templates.identify_upsell_opportunities_question_1_choice_3"),
            t("templates.identify_upsell_opportunities_question_1_choice_4"),
          ],
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const prioritizeFeatures = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.prioritize_features_name"),
      role: "productManager",
      industries: ["saas"],
      channels: ["app"],
      description: t("templates.prioritize_features_description"),
      questions: [
        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [],
          shuffleOption: "none",
          choices: [
            t("templates.prioritize_features_question_1_choice_1"),
            t("templates.prioritize_features_question_1_choice_2"),
            t("templates.prioritize_features_question_1_choice_3"),
            t("templates.prioritize_features_question_1_choice_4"),
          ],
          headline: t("templates.prioritize_features_question_1_headline"),
          required: true,
          t,
          containsOther: true,
        }),
        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [],
          shuffleOption: "none",
          choices: [
            t("templates.prioritize_features_question_2_choice_1"),
            t("templates.prioritize_features_question_2_choice_2"),
            t("templates.prioritize_features_question_2_choice_3"),
          ],
          headline: t("templates.prioritize_features_question_2_headline"),
          required: true,
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.prioritize_features_question_3_headline"),
          required: true,
          placeholder: t("templates.prioritize_features_question_3_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const gaugeFeatureSatisfaction = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.gauge_feature_satisfaction_name"),
      role: "productManager",
      industries: ["saas"],
      channels: ["app"],
      description: t("templates.gauge_feature_satisfaction_description"),
      questions: [
        buildRatingQuestion({
          headline: t("templates.gauge_feature_satisfaction_question_1_headline"),
          required: true,
          lowerLabel: t("templates.gauge_feature_satisfaction_question_1_lower_label"),
          upperLabel: t("templates.gauge_feature_satisfaction_question_1_upper_label"),
          scale: "number",
          range: 5,
          isColorCodingEnabled: false,
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.gauge_feature_satisfaction_question_2_headline"),
          required: false,
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
      endings: [getDefaultEndingCard([], t)],
      hiddenFields: hiddenFieldsDefault,
    },
    t
  );
};

const marketSiteClarity = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.market_site_clarity_name"),
      role: "marketing",
      industries: ["saas", "eCommerce", "other"],
      channels: ["website"],
      description: t("templates.market_site_clarity_description"),
      questions: [
        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.market_site_clarity_question_1_headline"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.market_site_clarity_question_1_choice_1"),
            t("templates.market_site_clarity_question_1_choice_2"),
            t("templates.market_site_clarity_question_1_choice_3"),
          ],
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.market_site_clarity_question_2_headline"),
          required: false,
          inputType: "text",
          t,
        }),
        buildCTAQuestion({
          headline: t("templates.market_site_clarity_question_3_headline"),
          required: false,
          buttonLabel: t("templates.market_site_clarity_question_3_button_label"),
          buttonUrl: "https://app.formbricks.com/auth/signup",
          buttonExternal: true,
          t,
        }),
      ],
    },
    t
  );
};

const customerEffortScore = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.customer_effort_score_name"),
      role: "productManager",
      industries: ["saas"],
      channels: ["app"],
      description: t("templates.customer_effort_score_description"),
      questions: [
        buildRatingQuestion({
          range: 5,
          scale: "number",
          headline: t("templates.customer_effort_score_question_1_headline"),
          required: true,
          lowerLabel: t("templates.customer_effort_score_question_1_lower_label"),
          upperLabel: t("templates.customer_effort_score_question_1_upper_label"),
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.customer_effort_score_question_2_headline"),
          required: true,
          placeholder: t("templates.customer_effort_score_question_2_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const careerDevelopmentSurvey = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.career_development_survey_name"),
      role: "productManager",
      industries: ["saas", "eCommerce", "other"],
      channels: ["link"],
      description: t("templates.career_development_survey_description"),
      questions: [
        buildRatingQuestion({
          range: 5,
          scale: "number",
          headline: t("templates.career_development_survey_question_1_headline"),
          lowerLabel: t("templates.career_development_survey_question_1_lower_label"),
          upperLabel: t("templates.career_development_survey_question_1_upper_label"),
          required: true,
          t,
        }),
        buildRatingQuestion({
          range: 5,
          scale: "number",
          headline: t("templates.career_development_survey_question_2_headline"),
          lowerLabel: t("templates.career_development_survey_question_2_lower_label"),
          upperLabel: t("templates.career_development_survey_question_2_upper_label"),
          required: true,
          t,
        }),
        buildRatingQuestion({
          range: 5,
          scale: "number",
          headline: t("templates.career_development_survey_question_3_headline"),
          lowerLabel: t("templates.career_development_survey_question_3_lower_label"),
          upperLabel: t("templates.career_development_survey_question_3_upper_label"),
          required: true,
          t,
        }),
        buildRatingQuestion({
          range: 5,
          scale: "number",
          headline: t("templates.career_development_survey_question_4_headline"),
          lowerLabel: t("templates.career_development_survey_question_4_lower_label"),
          upperLabel: t("templates.career_development_survey_question_4_upper_label"),
          required: true,
          t,
        }),
        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.career_development_survey_question_5_headline"),
          subheader: t("templates.career_development_survey_question_5_subheader"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.career_development_survey_question_5_choice_1"),
            t("templates.career_development_survey_question_5_choice_2"),
            t("templates.career_development_survey_question_5_choice_3"),
            t("templates.career_development_survey_question_5_choice_4"),
            t("templates.career_development_survey_question_5_choice_5"),
            t("templates.career_development_survey_question_5_choice_6"),
          ],
          containsOther: true,
          t,
        }),
        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.career_development_survey_question_6_headline"),
          subheader: t("templates.career_development_survey_question_6_subheader"),
          required: true,
          shuffleOption: "exceptLast",
          choices: [
            t("templates.career_development_survey_question_6_choice_1"),
            t("templates.career_development_survey_question_6_choice_2"),
            t("templates.career_development_survey_question_6_choice_3"),
            t("templates.career_development_survey_question_6_choice_4"),
            t("templates.career_development_survey_question_6_choice_5"),
            t("templates.career_development_survey_question_6_choice_6"),
          ],
          containsOther: true,
          t,
        }),
      ],
    },
    t
  );
};

const professionalDevelopmentSurvey = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.professional_development_survey_name"),
      role: "productManager",
      industries: ["saas", "eCommerce", "other"],
      channels: ["link"],
      description: t("templates.professional_development_survey_description"),
      questions: [
        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.professional_development_survey_question_1_headline"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.professional_development_survey_question_1_choice_1"),
            t("templates.professional_development_survey_question_1_choice_1"),
          ],
          t,
        }),

        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: t("templates.professional_development_survey_question_2_headline"),
          subheader: t("templates.professional_development_survey_question_2_subheader"),
          required: true,
          shuffleOption: "exceptLast",
          choices: [
            t("templates.professional_development_survey_question_2_choice_1"),
            t("templates.professional_development_survey_question_2_choice_2"),
            t("templates.professional_development_survey_question_2_choice_3"),
            t("templates.professional_development_survey_question_2_choice_4"),
            t("templates.professional_development_survey_question_2_choice_5"),
            t("templates.professional_development_survey_question_2_choice_6"),
          ],
          containsOther: true,
          t,
        }),
        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: t("templates.professional_development_survey_question_3_headline"),
          required: true,
          shuffleOption: "none",
          choices: [
            t("templates.professional_development_survey_question_3_choice_1"),
            t("templates.professional_development_survey_question_3_choice_2"),
          ],
          t,
        }),
        buildRatingQuestion({
          range: 5,
          scale: "number",
          headline: t("templates.professional_development_survey_question_4_headline"),
          lowerLabel: t("templates.professional_development_survey_question_4_lower_label"),
          upperLabel: t("templates.professional_development_survey_question_4_upper_label"),
          required: true,
          isColorCodingEnabled: false,
          t,
        }),
        buildMultipleChoiceQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: t("templates.professional_development_survey_question_5_headline"),
          required: true,
          shuffleOption: "exceptLast",
          choices: [
            t("templates.professional_development_survey_question_5_choice_1"),
            t("templates.professional_development_survey_question_5_choice_2"),
            t("templates.professional_development_survey_question_5_choice_3"),
            t("templates.professional_development_survey_question_5_choice_4"),
            t("templates.professional_development_survey_question_5_choice_5"),
            t("templates.professional_development_survey_question_5_choice_6"),
          ],
          buttonLabel: t("templates.finish"),
          containsOther: true,
          t,
        }),
      ],
    },
    t
  );
};

const rateCheckoutExperience = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId()];
  return buildSurvey(
    {
      name: t("templates.rate_checkout_experience_name"),
      role: "productManager",
      industries: ["eCommerce"],
      channels: ["website", "app"],
      description: t("templates.rate_checkout_experience_description"),
      endings: localSurvey.endings,
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
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
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
          headline: t("templates.rate_checkout_experience_question_1_headline"),
          required: true,
          lowerLabel: t("templates.rate_checkout_experience_question_1_lower_label"),
          upperLabel: t("templates.rate_checkout_experience_question_1_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[1],
          logic: [createJumpLogic(reusableQuestionIds[1], localSurvey.endings[0].id, "isSubmitted")],
          headline: t("templates.rate_checkout_experience_question_2_headline"),
          required: true,
          placeholder: t("templates.rate_checkout_experience_question_2_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[2],
          headline: t("templates.rate_checkout_experience_question_3_headline"),
          required: true,
          placeholder: t("templates.rate_checkout_experience_question_3_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const measureSearchExperience = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId()];
  return buildSurvey(
    {
      name: t("templates.measure_search_experience_name"),
      role: "productManager",
      industries: ["saas", "eCommerce"],
      channels: ["app", "website"],
      description: t("templates.measure_search_experience_description"),
      endings: localSurvey.endings,
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
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
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
          headline: t("templates.measure_search_experience_question_1_headline"),
          required: true,
          lowerLabel: t("templates.measure_search_experience_question_1_lower_label"),
          upperLabel: t("templates.measure_search_experience_question_1_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[1],
          logic: [createJumpLogic(reusableQuestionIds[1], localSurvey.endings[0].id, "isSubmitted")],
          headline: t("templates.measure_search_experience_question_2_headline"),
          required: true,
          placeholder: t("templates.measure_search_experience_question_2_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[2],
          headline: t("templates.measure_search_experience_question_3_headline"),
          required: true,
          placeholder: t("templates.measure_search_experience_question_3_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const evaluateContentQuality = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId()];
  return buildSurvey(
    {
      name: t("templates.evaluate_content_quality_name"),
      role: "marketing",
      industries: ["other"],
      channels: ["website"],
      description: t("templates.evaluate_content_quality_description"),
      endings: localSurvey.endings,
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
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
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
          headline: t("templates.evaluate_content_quality_question_1_headline"),
          required: true,
          lowerLabel: t("templates.evaluate_content_quality_question_1_lower_label"),
          upperLabel: t("templates.evaluate_content_quality_question_1_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[1],
          logic: [createJumpLogic(reusableQuestionIds[1], localSurvey.endings[0].id, "isSubmitted")],
          headline: t("templates.evaluate_content_quality_question_2_headline"),
          required: true,
          placeholder: t("templates.evaluate_content_quality_question_2_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[2],
          headline: t("templates.evaluate_content_quality_question_3_headline"),
          required: true,
          placeholder: t("templates.evaluate_content_quality_question_3_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const measureTaskAccomplishment = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId()];
  return buildSurvey(
    {
      name: t("templates.measure_task_accomplishment_name"),
      role: "productManager",
      industries: ["saas"],
      channels: ["app", "website"],
      description: t("templates.measure_task_accomplishment_description"),
      endings: localSurvey.endings,
      questions: [
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[1], reusableQuestionIds[3]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[0], reusableQuestionIds[1]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[2], reusableQuestionIds[4]),
          ],
          choices: [
            t("templates.measure_task_accomplishment_question_1_option_1_label"),
            t("templates.measure_task_accomplishment_question_1_option_2_label"),
            t("templates.measure_task_accomplishment_question_1_option_3_label"),
          ],
          headline: t("templates.measure_task_accomplishment_question_1_headline"),
          required: true,
          t,
        }),
        buildRatingQuestion({
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
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: t("templates.measure_task_accomplishment_question_2_headline"),
          required: false,
          lowerLabel: t("templates.measure_task_accomplishment_question_2_lower_label"),
          upperLabel: t("templates.measure_task_accomplishment_question_2_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[2],
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "or",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: t("templates.measure_task_accomplishment_question_3_headline"),
          required: false,
          placeholder: t("templates.measure_task_accomplishment_question_3_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[3],
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "or",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[3],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: t("templates.measure_task_accomplishment_question_4_headline"),
          required: false,
          buttonLabel: t("templates.measure_task_accomplishment_question_4_button_label"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[4],
          headline: t("templates.measure_task_accomplishment_question_5_headline"),
          required: true,
          buttonLabel: t("templates.measure_task_accomplishment_question_5_button_label"),
          placeholder: t("templates.measure_task_accomplishment_question_5_placeholder"),
          inputType: "text",
          t,
        }),
      ],
    },
    t
  );
};

const identifySignUpBarriers = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
  ];
  const reusableOptionIds = [createId(), createId(), createId(), createId(), createId()];

  return buildSurvey(
    {
      name: t("templates.identify_sign_up_barriers_name"),
      role: "marketing",
      industries: ["saas", "eCommerce", "other"],
      channels: ["website"],
      description: t("templates.identify_sign_up_barriers_description"),
      endings: localSurvey.endings,
      questions: [
        buildCTAQuestion({
          id: reusableQuestionIds[0],
          html: t("templates.identify_sign_up_barriers_question_1_html"),
          logic: [createJumpLogic(reusableQuestionIds[0], localSurvey.endings[0].id, "isSkipped")],
          headline: t("templates.identify_sign_up_barriers_question_1_headline"),
          required: false,
          buttonLabel: t("templates.identify_sign_up_barriers_question_1_button_label"),
          buttonExternal: false,
          dismissButtonLabel: t("templates.identify_sign_up_barriers_question_1_dismiss_button_label"),
          t,
        }),
        buildRatingQuestion({
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
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: 5,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: t("templates.identify_sign_up_barriers_question_2_headline"),
          required: true,
          lowerLabel: t("templates.identify_sign_up_barriers_question_2_lower_label"),
          upperLabel: t("templates.identify_sign_up_barriers_question_2_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            createChoiceJumpLogic(reusableQuestionIds[2], reusableOptionIds[0], reusableQuestionIds[3]),
            createChoiceJumpLogic(reusableQuestionIds[2], reusableOptionIds[1], reusableQuestionIds[4]),
            createChoiceJumpLogic(reusableQuestionIds[2], reusableOptionIds[2], reusableQuestionIds[5]),
            createChoiceJumpLogic(reusableQuestionIds[2], reusableOptionIds[3], reusableQuestionIds[6]),
            createChoiceJumpLogic(reusableQuestionIds[2], reusableOptionIds[4], reusableQuestionIds[7]),
          ],
          choices: [
            t("templates.identify_sign_up_barriers_question_3_choice_1_label"),
            t("templates.identify_sign_up_barriers_question_3_choice_2_label"),
            t("templates.identify_sign_up_barriers_question_3_choice_3_label"),
            t("templates.identify_sign_up_barriers_question_3_choice_4_label"),
            t("templates.identify_sign_up_barriers_question_3_choice_5_label"),
          ],
          choiceIds: [
            reusableOptionIds[0],
            reusableOptionIds[1],
            reusableOptionIds[2],
            reusableOptionIds[3],
            reusableOptionIds[4],
          ],
          headline: t("templates.identify_sign_up_barriers_question_3_headline"),
          required: true,
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[3],
          logic: [createJumpLogic(reusableQuestionIds[3], reusableQuestionIds[8], "isSubmitted")],
          headline: t("templates.identify_sign_up_barriers_question_4_headline"),
          required: true,
          placeholder: t("templates.identify_sign_up_barriers_question_4_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[4],
          logic: [createJumpLogic(reusableQuestionIds[4], reusableQuestionIds[8], "isSubmitted")],
          headline: t("templates.identify_sign_up_barriers_question_5_headline"),
          required: true,
          placeholder: t("templates.identify_sign_up_barriers_question_5_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[5],
          logic: [createJumpLogic(reusableQuestionIds[5], reusableQuestionIds[8], "isSubmitted")],
          headline: t("templates.identify_sign_up_barriers_question_6_headline"),
          required: true,
          placeholder: t("templates.identify_sign_up_barriers_question_6_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[6],
          logic: [createJumpLogic(reusableQuestionIds[6], reusableQuestionIds[8], "isSubmitted")],
          headline: t("templates.identify_sign_up_barriers_question_7_headline"),
          required: true,
          placeholder: t("templates.identify_sign_up_barriers_question_7_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[7],
          headline: t("templates.identify_sign_up_barriers_question_8_headline"),
          required: true,
          placeholder: t("templates.identify_sign_up_barriers_question_8_placeholder"),
          inputType: "text",
          t,
        }),
        buildCTAQuestion({
          id: reusableQuestionIds[8],
          html: t("templates.identify_sign_up_barriers_question_9_html"),
          headline: t("templates.identify_sign_up_barriers_question_9_headline"),
          required: false,
          buttonUrl: "https://app.formbricks.com/auth/signup",
          buttonLabel: t("templates.identify_sign_up_barriers_question_9_button_label"),
          buttonExternal: true,
          dismissButtonLabel: t("templates.identify_sign_up_barriers_question_9_dismiss_button_label"),
          t,
        }),
      ],
    },
    t
  );
};

const buildProductRoadmap = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.build_product_roadmap_name"),
      role: "productManager",
      industries: ["saas"],
      channels: ["app", "link"],
      description: t("templates.build_product_roadmap_description"),
      questions: [
        buildRatingQuestion({
          range: 5,
          scale: "number",
          headline: t("templates.build_product_roadmap_question_1_headline"),
          required: true,
          lowerLabel: t("templates.build_product_roadmap_question_1_lower_label"),
          upperLabel: t("templates.build_product_roadmap_question_1_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.build_product_roadmap_question_2_headline"),
          required: true,
          placeholder: t("templates.build_product_roadmap_question_2_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const understandPurchaseIntention = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId()];
  return buildSurvey(
    {
      name: t("templates.understand_purchase_intention_name"),
      role: "sales",
      industries: ["eCommerce"],
      channels: ["website", "link", "app"],
      description: t("templates.understand_purchase_intention_description"),
      endings: localSurvey.endings,
      questions: [
        buildRatingQuestion({
          id: reusableQuestionIds[0],
          logic: [
            createChoiceJumpLogic(reusableQuestionIds[0], "2", reusableQuestionIds[1]),
            createChoiceJumpLogic(reusableQuestionIds[0], "3", reusableQuestionIds[2]),
            createChoiceJumpLogic(reusableQuestionIds[0], "4", reusableQuestionIds[2]),
            createChoiceJumpLogic(reusableQuestionIds[0], "5", localSurvey.endings[0].id),
          ],
          range: 5,
          scale: "number",
          headline: t("templates.understand_purchase_intention_question_1_headline"),
          required: true,
          lowerLabel: t("templates.understand_purchase_intention_question_1_lower_label"),
          upperLabel: t("templates.understand_purchase_intention_question_1_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[1],
          logic: [
            createJumpLogic(reusableQuestionIds[1], localSurvey.endings[0].id, "isSubmitted"),
            createJumpLogic(reusableQuestionIds[1], localSurvey.endings[0].id, "isSkipped"),
          ],
          headline: t("templates.understand_purchase_intention_question_2_headline"),
          required: false,
          placeholder: t("templates.understand_purchase_intention_question_2_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[2],
          headline: t("templates.understand_purchase_intention_question_3_headline"),
          required: true,
          placeholder: t("templates.understand_purchase_intention_question_3_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const improveNewsletterContent = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId()];
  return buildSurvey(
    {
      name: t("templates.improve_newsletter_content_name"),
      role: "marketing",
      industries: ["eCommerce", "saas", "other"],
      channels: ["link"],
      description: t("templates.improve_newsletter_content_description"),
      endings: localSurvey.endings,
      questions: [
        buildRatingQuestion({
          id: reusableQuestionIds[0],
          logic: [
            createChoiceJumpLogic(reusableQuestionIds[0], "5", reusableQuestionIds[2]),
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
                    operator: "isLessThan",
                    rightOperand: {
                      type: "static",
                      value: 5,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[1],
                },
              ],
            },
          ],
          range: 5,
          scale: "smiley",
          headline: t("templates.improve_newsletter_content_question_1_headline"),
          required: true,
          lowerLabel: t("templates.improve_newsletter_content_question_1_lower_label"),
          upperLabel: t("templates.improve_newsletter_content_question_1_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[1],
          logic: [
            createJumpLogic(reusableQuestionIds[1], localSurvey.endings[0].id, "isSubmitted"),
            createJumpLogic(reusableQuestionIds[1], localSurvey.endings[0].id, "isSkipped"),
          ],
          headline: t("templates.improve_newsletter_content_question_2_headline"),
          required: false,
          placeholder: t("templates.improve_newsletter_content_question_2_placeholder"),
          inputType: "text",
          t,
        }),
        buildCTAQuestion({
          id: reusableQuestionIds[2],
          html: t("templates.improve_newsletter_content_question_3_html"),
          headline: t("templates.improve_newsletter_content_question_3_headline"),
          required: false,
          buttonUrl: "https://formbricks.com",
          buttonLabel: t("templates.improve_newsletter_content_question_3_button_label"),
          buttonExternal: true,
          dismissButtonLabel: t("templates.improve_newsletter_content_question_3_dismiss_button_label"),
          t,
        }),
      ],
    },
    t
  );
};

const evaluateAProductIdea = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
  ];
  return buildSurvey(
    {
      name: t("templates.evaluate_a_product_idea_name"),
      role: "productManager",
      industries: ["saas", "other"],
      channels: ["link", "app"],
      description: t("templates.evaluate_a_product_idea_description"),
      questions: [
        buildCTAQuestion({
          id: reusableQuestionIds[0],
          html: t("templates.evaluate_a_product_idea_question_1_html"),
          headline: t("templates.evaluate_a_product_idea_question_1_headline"),
          required: true,
          buttonLabel: t("templates.evaluate_a_product_idea_question_1_button_label"),
          buttonExternal: false,
          dismissButtonLabel: t("templates.evaluate_a_product_idea_question_1_dismiss_button_label"),
          t,
        }),
        buildRatingQuestion({
          id: reusableQuestionIds[1],
          logic: [
            createChoiceJumpLogic(reusableQuestionIds[1], "3", reusableQuestionIds[2]),
            createChoiceJumpLogic(reusableQuestionIds[1], "4", reusableQuestionIds[3]),
          ],
          range: 5,
          scale: "number",
          headline: t("templates.evaluate_a_product_idea_question_2_headline"),
          required: true,
          lowerLabel: t("templates.evaluate_a_product_idea_question_2_lower_label"),
          upperLabel: t("templates.evaluate_a_product_idea_question_2_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[2],
          headline: t("templates.evaluate_a_product_idea_question_3_headline"),
          required: true,
          placeholder: t("templates.evaluate_a_product_idea_question_3_placeholder"),
          inputType: "text",
          t,
        }),
        buildCTAQuestion({
          id: reusableQuestionIds[3],
          html: t("templates.evaluate_a_product_idea_question_4_html"),
          headline: t("templates.evaluate_a_product_idea_question_4_headline"),
          required: true,
          buttonLabel: t("templates.evaluate_a_product_idea_question_4_button_label"),
          buttonExternal: false,
          dismissButtonLabel: t("templates.evaluate_a_product_idea_question_4_dismiss_button_label"),
          t,
        }),
        buildRatingQuestion({
          id: reusableQuestionIds[4],
          logic: [
            createChoiceJumpLogic(reusableQuestionIds[4], "3", reusableQuestionIds[5]),
            createChoiceJumpLogic(reusableQuestionIds[4], "4", reusableQuestionIds[6]),
          ],
          range: 5,
          scale: "number",
          headline: t("templates.evaluate_a_product_idea_question_5_headline"),
          required: true,
          lowerLabel: t("templates.evaluate_a_product_idea_question_5_lower_label"),
          upperLabel: t("templates.evaluate_a_product_idea_question_5_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[5],
          logic: [createJumpLogic(reusableQuestionIds[5], reusableQuestionIds[7], "isSubmitted")],
          headline: t("templates.evaluate_a_product_idea_question_6_headline"),
          required: true,
          placeholder: t("templates.evaluate_a_product_idea_question_6_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[6],
          headline: t("templates.evaluate_a_product_idea_question_7_headline"),
          required: true,
          placeholder: t("templates.evaluate_a_product_idea_question_7_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[7],
          headline: t("templates.evaluate_a_product_idea_question_8_headline"),
          required: false,
          placeholder: t("templates.evaluate_a_product_idea_question_8_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const understandLowEngagement = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId(), createId()];

  const reusableOptionIds = [createId(), createId(), createId(), createId()];
  return buildSurvey(
    {
      name: t("templates.understand_low_engagement_name"),
      role: "productManager",
      industries: ["saas"],
      channels: ["link"],
      description: t("templates.understand_low_engagement_description"),
      endings: localSurvey.endings,
      questions: [
        buildMultipleChoiceQuestion({
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[0], reusableQuestionIds[1]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[1], reusableQuestionIds[2]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[2], reusableQuestionIds[3]),
            createChoiceJumpLogic(reusableQuestionIds[0], reusableOptionIds[3], reusableQuestionIds[4]),
            createChoiceJumpLogic(reusableQuestionIds[0], "other", reusableQuestionIds[5]),
          ],
          choices: [
            t("templates.understand_low_engagement_question_1_choice_1"),
            t("templates.understand_low_engagement_question_1_choice_2"),
            t("templates.understand_low_engagement_question_1_choice_3"),
            t("templates.understand_low_engagement_question_1_choice_4"),
            t("templates.understand_low_engagement_question_1_choice_5"),
          ],
          headline: t("templates.understand_low_engagement_question_1_headline"),
          required: true,
          containsOther: true,
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[1],
          logic: [createJumpLogic(reusableQuestionIds[1], localSurvey.endings[0].id, "isSubmitted")],
          headline: t("templates.understand_low_engagement_question_2_headline"),
          required: true,
          placeholder: t("templates.understand_low_engagement_question_2_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[2],
          logic: [createJumpLogic(reusableQuestionIds[2], localSurvey.endings[0].id, "isSubmitted")],
          headline: t("templates.understand_low_engagement_question_3_headline"),
          required: true,
          placeholder: t("templates.understand_low_engagement_question_3_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[3],
          logic: [createJumpLogic(reusableQuestionIds[3], localSurvey.endings[0].id, "isSubmitted")],
          headline: t("templates.understand_low_engagement_question_4_headline"),
          required: true,
          placeholder: t("templates.understand_low_engagement_question_4_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[4],
          logic: [createJumpLogic(reusableQuestionIds[4], localSurvey.endings[0].id, "isSubmitted")],
          headline: t("templates.understand_low_engagement_question_5_headline"),
          required: true,
          placeholder: t("templates.understand_low_engagement_question_5_placeholder"),
          inputType: "text",
          t,
        }),
        buildOpenTextQuestion({
          id: reusableQuestionIds[5],
          logic: [],
          headline: t("templates.understand_low_engagement_question_6_headline"),
          required: false,
          placeholder: t("templates.understand_low_engagement_question_6_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const employeeWellBeing = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.employee_well_being_name"),
      role: "peopleManager",
      industries: ["saas", "eCommerce", "other"],
      channels: ["link"],
      description: t("templates.employee_well_being_description"),
      questions: [
        buildRatingQuestion({
          headline: t("templates.employee_well_being_question_1_headline"),
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: t("templates.employee_well_being_question_1_lower_label"),
          upperLabel: t("templates.employee_well_being_question_1_upper_label"),
          t,
        }),
        buildRatingQuestion({
          headline: t("templates.employee_well_being_question_2_headline"),
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: t("templates.employee_well_being_question_2_lower_label"),
          upperLabel: t("templates.employee_well_being_question_2_upper_label"),
          t,
        }),
        buildRatingQuestion({
          headline: t("templates.employee_well_being_question_3_headline"),
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: t("templates.employee_well_being_question_3_lower_label"),
          upperLabel: t("templates.employee_well_being_question_3_upper_label"),
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.employee_well_being_question_4_headline"),
          required: false,
          placeholder: t("templates.employee_well_being_question_4_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const longTermRetentionCheckIn = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.long_term_retention_check_in_name"),
      role: "peopleManager",
      industries: ["saas", "other"],
      channels: ["app", "link"],
      description: t("templates.long_term_retention_check_in_description"),
      questions: [
        buildRatingQuestion({
          range: 5,
          scale: "star",
          headline: t("templates.long_term_retention_check_in_question_1_headline"),
          required: true,
          lowerLabel: t("templates.long_term_retention_check_in_question_1_lower_label"),
          upperLabel: t("templates.long_term_retention_check_in_question_1_upper_label"),
          isColorCodingEnabled: true,
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.long_term_retention_check_in_question_2_headline"),
          required: false,
          placeholder: t("templates.long_term_retention_check_in_question_2_placeholder"),
          inputType: "text",
          t,
        }),
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            t("templates.long_term_retention_check_in_question_3_choice_1"),
            t("templates.long_term_retention_check_in_question_3_choice_2"),
            t("templates.long_term_retention_check_in_question_3_choice_3"),
            t("templates.long_term_retention_check_in_question_3_choice_4"),
            t("templates.long_term_retention_check_in_question_3_choice_5"),
          ],
          headline: t("templates.long_term_retention_check_in_question_3_headline"),
          required: true,
          t,
        }),
        buildRatingQuestion({
          range: 5,
          scale: "number",
          headline: t("templates.long_term_retention_check_in_question_4_headline"),
          required: true,
          lowerLabel: t("templates.long_term_retention_check_in_question_4_lower_label"),
          upperLabel: t("templates.long_term_retention_check_in_question_4_upper_label"),
          isColorCodingEnabled: true,
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.long_term_retention_check_in_question_5_headline"),
          required: false,
          placeholder: t("templates.long_term_retention_check_in_question_5_placeholder"),
          inputType: "text",
          t,
        }),
        buildNPSQuestion({
          headline: t("templates.long_term_retention_check_in_question_6_headline"),
          required: false,
          lowerLabel: t("templates.long_term_retention_check_in_question_6_lower_label"),
          upperLabel: t("templates.long_term_retention_check_in_question_6_upper_label"),
          isColorCodingEnabled: false,
          t,
        }),
        buildMultipleChoiceQuestion({
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          shuffleOption: "none",
          choices: [
            t("templates.long_term_retention_check_in_question_7_choice_1"),
            t("templates.long_term_retention_check_in_question_7_choice_2"),
            t("templates.long_term_retention_check_in_question_7_choice_3"),
            t("templates.long_term_retention_check_in_question_7_choice_4"),
            t("templates.long_term_retention_check_in_question_7_choice_5"),
          ],
          headline: t("templates.long_term_retention_check_in_question_7_headline"),
          required: true,
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.long_term_retention_check_in_question_8_headline"),
          required: false,
          placeholder: t("templates.long_term_retention_check_in_question_8_placeholder"),
          inputType: "text",
          t,
        }),
        buildRatingQuestion({
          range: 5,
          scale: "smiley",
          headline: t("templates.long_term_retention_check_in_question_9_headline"),
          required: true,
          lowerLabel: t("templates.long_term_retention_check_in_question_9_lower_label"),
          upperLabel: t("templates.long_term_retention_check_in_question_9_upper_label"),
          isColorCodingEnabled: true,
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.long_term_retention_check_in_question_10_headline"),
          required: false,
          placeholder: t("templates.long_term_retention_check_in_question_10_placeholder"),
          inputType: "text",
          t,
        }),
      ],
    },
    t
  );
};

const professionalDevelopmentGrowth = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.professional_development_growth_survey_name"),
      role: "peopleManager",
      industries: ["saas", "eCommerce", "other"],
      channels: ["link"],
      description: t("templates.professional_development_growth_survey_description"),
      questions: [
        buildRatingQuestion({
          headline: t("templates.professional_development_growth_survey_question_1_headline"),
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: t("templates.professional_development_growth_survey_question_1_lower_label"),
          upperLabel: t("templates.professional_development_growth_survey_question_1_upper_label"),
          t,
        }),
        buildRatingQuestion({
          headline: t("templates.professional_development_growth_survey_question_2_headline"),
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: t("templates.professional_development_growth_survey_question_2_lower_label"),
          upperLabel: t("templates.professional_development_growth_survey_question_2_upper_label"),
          t,
        }),
        buildRatingQuestion({
          headline: t("templates.professional_development_growth_survey_question_3_headline"),
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: t("templates.professional_development_growth_survey_question_3_lower_label"),
          upperLabel: t("templates.professional_development_growth_survey_question_3_upper_label"),
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.professional_development_growth_survey_question_4_headline"),
          required: false,
          placeholder: t("templates.professional_development_growth_survey_question_4_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const recognitionAndReward = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.recognition_and_reward_survey_name"),
      role: "peopleManager",
      industries: ["saas", "eCommerce", "other"],
      channels: ["link"],
      description: t("templates.recognition_and_reward_survey_description"),
      questions: [
        buildRatingQuestion({
          headline: t("templates.recognition_and_reward_survey_question_1_headline"),
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: t("templates.recognition_and_reward_survey_question_1_lower_label"),
          upperLabel: t("templates.recognition_and_reward_survey_question_1_upper_label"),
          t,
        }),
        buildRatingQuestion({
          headline: t("templates.recognition_and_reward_survey_question_2_headline"),
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: t("templates.recognition_and_reward_survey_question_2_lower_label"),
          upperLabel: t("templates.recognition_and_reward_survey_question_2_upper_label"),
          t,
        }),
        buildRatingQuestion({
          headline: t("templates.recognition_and_reward_survey_question_3_headline"),
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: t("templates.recognition_and_reward_survey_question_3_lower_label"),
          upperLabel: t("templates.recognition_and_reward_survey_question_3_upper_label"),
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.recognition_and_reward_survey_question_4_headline"),
          required: false,
          placeholder: t("templates.recognition_and_reward_survey_question_4_placeholder"),
          inputType: "text",
          t,
        }),
      ],
    },
    t
  );
};

const alignmentAndEngagement = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.alignment_and_engagement_survey_name"),
      role: "peopleManager",
      industries: ["saas", "eCommerce", "other"],
      channels: ["link"],
      description: t("templates.alignment_and_engagement_survey_description"),
      questions: [
        buildRatingQuestion({
          headline: t("templates.alignment_and_engagement_survey_question_1_headline"),
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: t("templates.alignment_and_engagement_survey_question_1_lower_label"),
          upperLabel: t("templates.alignment_and_engagement_survey_question_1_upper_label"),
          t,
        }),
        buildRatingQuestion({
          headline: t("templates.alignment_and_engagement_survey_question_2_headline"),
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: t("templates.alignment_and_engagement_survey_question_2_lower_label"),
          t,
        }),
        buildRatingQuestion({
          headline: t("templates.alignment_and_engagement_survey_question_3_headline"),
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: t("templates.alignment_and_engagement_survey_question_3_lower_label"),
          upperLabel: t("templates.alignment_and_engagement_survey_question_3_upper_label"),
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.alignment_and_engagement_survey_question_4_headline"),
          required: false,
          placeholder: t("templates.alignment_and_engagement_survey_question_4_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

const supportiveWorkCulture = (t: TFnType): TTemplate => {
  return buildSurvey(
    {
      name: t("templates.supportive_work_culture_survey_name"),
      role: "peopleManager",
      industries: ["saas", "eCommerce", "other"],
      channels: ["link"],
      description: t("templates.supportive_work_culture_survey_description"),
      questions: [
        buildRatingQuestion({
          headline: t("templates.supportive_work_culture_survey_question_1_headline"),
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: t("templates.supportive_work_culture_survey_question_1_lower_label"),
          upperLabel: t("templates.supportive_work_culture_survey_question_1_upper_label"),
          t,
        }),
        buildRatingQuestion({
          headline: t("templates.supportive_work_culture_survey_question_2_headline"),
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: t("templates.supportive_work_culture_survey_question_2_lower_label"),
          upperLabel: t("templates.supportive_work_culture_survey_question_2_upper_label"),
          t,
        }),
        buildRatingQuestion({
          headline: t("templates.supportive_work_culture_survey_question_3_headline"),
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: t("templates.supportive_work_culture_survey_question_3_lower_label"),
          upperLabel: t("templates.supportive_work_culture_survey_question_3_upper_label"),
          t,
        }),
        buildOpenTextQuestion({
          headline: t("templates.supportive_work_culture_survey_question_4_headline"),
          required: false,
          placeholder: t("templates.supportive_work_culture_survey_question_4_placeholder"),
          inputType: "text",
          buttonLabel: t("templates.finish"),
          t,
        }),
      ],
    },
    t
  );
};

export const templates = (t: TFnType): TTemplate[] => [
  cartAbandonmentSurvey(t),
  siteAbandonmentSurvey(t),
  productMarketFitSuperhuman(t),
  onboardingSegmentation(t),
  churnSurvey(t),
  earnedAdvocacyScore(t),
  improveTrialConversion(t),
  reviewPrompt(t),
  interviewPrompt(t),
  improveActivationRate(t),
  uncoverStrengthsAndWeaknesses(t),
  productMarketFitShort(t),
  marketAttribution(t),
  changingSubscriptionExperience(t),
  identifyCustomerGoals(t),
  featureChaser(t),
  fakeDoorFollowUp(t),
  feedbackBox(t),
  integrationSetupSurvey(t),
  newIntegrationSurvey(t),
  docsFeedback(t),
  nps(t),
  customerSatisfactionScore(t),
  collectFeedback(t),
  identifyUpsellOpportunities(t),
  prioritizeFeatures(t),
  gaugeFeatureSatisfaction(t),
  marketSiteClarity(t),
  customerEffortScore(t),
  rateCheckoutExperience(t),
  measureSearchExperience(t),
  evaluateContentQuality(t),
  measureTaskAccomplishment(t),
  identifySignUpBarriers(t),
  buildProductRoadmap(t),
  understandPurchaseIntention(t),
  improveNewsletterContent(t),
  evaluateAProductIdea(t),
  understandLowEngagement(t),
  employeeSatisfaction(t),
  employeeWellBeing(t),
  longTermRetentionCheckIn(t),
  supportiveWorkCulture(t),
  alignmentAndEngagement(t),
  recognitionAndReward(t),
  professionalDevelopmentGrowth(t),
  professionalDevelopmentSurvey(t),
  careerDevelopmentSurvey(t),
];

export const customSurveyTemplate = (t: TFnType): TTemplate => {
  return {
    name: t("templates.custom_survey_name"),
    description: t("templates.custom_survey_description"),
    preset: {
      ...getDefaultSurveyPreset(t),
      name: t("templates.custom_survey_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: t("templates.custom_survey_question_1_headline") },
          placeholder: { default: t("templates.custom_survey_question_1_placeholder") },
          buttonLabel: { default: t("templates.next") },
          required: true,
          inputType: "text",
          charLimit: {
            enabled: false,
          },
        } as TSurveyOpenTextQuestion,
      ],
    },
  };
};

export const previewSurvey = (projectName: string, t: TFnType) => {
  return {
    id: "cltxxaa6x0000g8hacxdxejeu",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: t("templates.preview_survey_name"),
    type: "link",
    environmentId: "cltwumfcz0009echxg02fh7oa",
    createdBy: "cltwumfbz0000echxysz6ptvq",
    status: "inProgress",
    welcomeCard: {
      html: {
        default: t("templates.preview_survey_welcome_card_html"),
      },
      enabled: false,
      headline: {
        default: t("templates.preview_survey_welcome_card_headline"),
      },
      timeToFinish: false,
      showResponseCount: false,
    },
    styling: null,
    segment: null,
    questions: [
      {
        ...buildRatingQuestion({
          id: "lbdxozwikh838yc6a8vbwuju",
          range: 5,
          scale: "star",
          headline: t("templates.preview_survey_question_1_headline", { projectName }),
          required: true,
          subheader: t("templates.preview_survey_question_1_subheader"),
          lowerLabel: t("templates.preview_survey_question_1_lower_label"),
          upperLabel: t("templates.preview_survey_question_1_upper_label"),
          t,
        }),
        isDraft: true,
      },
      {
        ...buildMultipleChoiceQuestion({
          id: "rjpu42ps6dzirsn9ds6eydgt",
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          choiceIds: ["x6wty2s72v7vd538aadpurqx", "fbcj4530t2n357ymjp2h28d6"],
          choices: [
            t("templates.preview_survey_question_2_choice_1_label"),
            t("templates.preview_survey_question_2_choice_2_label"),
          ],
          headline: t("templates.preview_survey_question_2_headline"),
          backButtonLabel: t("templates.preview_survey_question_2_back_button_label"),
          required: true,
          shuffleOption: "none",
          t,
        }),
        isDraft: true,
      },
    ],
    endings: [
      {
        id: "cltyqp5ng000108l9dmxw6nde",
        type: "endScreen",
        headline: { default: t("templates.preview_survey_ending_card_headline") },
        subheader: { default: t("templates.preview_survey_ending_card_description") },
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
    isBackButtonHidden: false,
  } as TSurvey;
};
