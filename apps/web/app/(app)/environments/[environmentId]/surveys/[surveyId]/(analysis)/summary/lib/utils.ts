import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export const convertFloatToNDecimal = (num: number, N: number = 2) => {
  return Math.round(num * Math.pow(10, N)) / Math.pow(10, N);
};

export const constructToastMessage = (
  questionType: TSurveyQuestionTypeEnum,
  filterValue: string,
  survey: TSurvey,
  questionId: string,
  filterComboBoxValue?: string | string[]
) => {
  const questionIdx = survey.questions.findIndex((question) => question.id === questionId);
  if (questionType === "matrix") {
    return `Added filter for responses where answer to question ${questionIdx + 1} is ${filterComboBoxValue} - ${filterValue}`;
  } else if (filterComboBoxValue === undefined) {
    return `Added filter for responses where answer to question ${questionIdx + 1} is skipped`;
  } else {
    return `Added filter for responses where answer to question ${questionIdx + 1} ${filterValue} ${Array.isArray(filterComboBoxValue) ? filterComboBoxValue.join(",") : filterComboBoxValue}`;
  }
};
