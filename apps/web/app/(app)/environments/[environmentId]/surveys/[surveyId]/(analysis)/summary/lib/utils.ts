import { TFunction } from "i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { getQuestionsFromBlocks } from "@/modules/survey/editor/lib/blocks";

export const convertFloatToNDecimal = (num: number, N: number = 2) => {
  return Math.round(num * Math.pow(10, N)) / Math.pow(10, N);
};

export const convertFloatTo2Decimal = (num: number) => {
  return Math.round(num * 100) / 100;
};

export const constructToastMessage = (
  questionType: TSurveyElementTypeEnum,
  filterValue: string,
  survey: TSurvey,
  questionId: TSurveyQuestionId,
  t: TFunction,
  filterComboBoxValue?: string | string[]
) => {
  // Derive questions from blocks
  const questions = getQuestionsFromBlocks(survey.blocks);
  const questionIdx = questions.findIndex((question) => question.id === questionId);
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
