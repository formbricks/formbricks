import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export const convertFloatToNDecimal = (num: number, N: number = 2) => {
  return Math.round(num * Math.pow(10, N)) / Math.pow(10, N);
};

export const constructToastMessage = (
  questionType: TSurveyQuestionTypeEnum,
  filterComboBoxValue: string | string[],
  filterValue: string,
  survey: TSurvey,
  questionId: string
) => {
  const questionIdx = survey.questions.findIndex((question) => question.id === questionId);
  if (questionType === "pictureSelection") {
    const question = survey.questions[questionIdx];
    if (question && question.type === "pictureSelection" && typeof filterComboBoxValue === "string") {
      const pictureIndex = question.choices.findIndex((choice) => choice.id === filterComboBoxValue);
      if (pictureIndex !== -1) {
        return `Added filter for responses where answer to question ${questionIdx + 1} is Picture ${pictureIndex + 1}`;
      }
    }
  } else if (questionType === "matrix") {
    return `Added filter for responses where answer to question ${questionIdx + 1} is ${filterComboBoxValue} - ${filterValue}`;
  } else {
    return `Added filter for responses where answer to question ${questionIdx + 1} is ${Array.isArray(filterComboBoxValue) ? filterComboBoxValue.join(",") : filterComboBoxValue}`;
  }
};
