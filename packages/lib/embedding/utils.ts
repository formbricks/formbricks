export const getQuestionResponseReferenceId = (surveyId: string, questionId: string) => {
  return `${surveyId}-${questionId}`;
};
