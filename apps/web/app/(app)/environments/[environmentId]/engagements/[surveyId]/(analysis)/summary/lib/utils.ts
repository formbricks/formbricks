import { TFnType } from "@tolgee/react";
import { TSurvey, TSurveyQuestionId, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export const convertFloatToNDecimal = (num: number, N: number = 2) => {
  return Math.round(num * Math.pow(10, N)) / Math.pow(10, N);
};

export const convertFloatTo2Decimal = (num: number) => {
  return Math.round(num * 100) / 100;
};

export const constructToastMessage = (
  questionType: TSurveyQuestionTypeEnum,
  filterValue: string,
  survey: TSurvey,
  questionId: TSurveyQuestionId,
  t: TFnType,
  filterComboBoxValue?: string | string[]
) => {
  const questionIdx = survey.questions.findIndex((question) => question.id === questionId);
  if (questionType === "matrix") {
    return t("environments.surveys.summary.added_filter_for_responses_where_answer_to_question", {
      questionIdx: questionIdx + 1,
      filterComboBoxValue: filterComboBoxValue?.toString() ?? "",
      filterValue,
    });
  } else if (filterComboBoxValue === undefined) {
    return t("environments.surveys.summary.added_filter_for_responses_where_answer_to_question_is_skipped", {
      questionIdx: questionIdx + 1,
    });
  } else {
    return t("environments.surveys.summary.added_filter_for_responses_where_answer_to_question", {
      questionIdx: questionIdx + 1,
      filterComboBoxValue: Array.isArray(filterComboBoxValue)
        ? filterComboBoxValue.join(",")
        : filterComboBoxValue,
      filterValue,
    });
  }
};

export const needsInsightsGeneration = (survey: TSurvey): boolean => {
  const openTextQuestions = survey.questions.filter((question) => question.type === "openText");
  const questionWithoutInsightsEnabled = openTextQuestions.some(
    (question) => question.type === "openText" && typeof question.insightsEnabled === "undefined"
  );

  return openTextQuestions.length > 0 && questionWithoutInsightsEnabled;
};
