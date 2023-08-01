import type { TResponseData } from "../../../types/v1/responses";

export const storeAnswer = (surveyId: string, answer: TResponseData) => {
  const storedAnswers = localStorage.getItem(`formbricks-${surveyId}-responses`);
  if (storedAnswers) {
    const parsedAnswers = JSON.parse(storedAnswers);
    localStorage.setItem(`formbricks-${surveyId}-responses`, JSON.stringify({ ...parsedAnswers, ...answer }));
  } else {
    localStorage.setItem(`formbricks-${surveyId}-responses`, JSON.stringify(answer));
  }
};

export const getStoredAnswer = (surveyId: string, questionId: string): string | null => {
  const storedAnswers = localStorage.getItem(`formbricks-${surveyId}-responses`);
  if (storedAnswers) {
    const parsedAnswers = JSON.parse(storedAnswers);
    return parsedAnswers[questionId] || null;
  }
  return null;
};

export const clearStoredAnswers = (surveyId: string) => {
  localStorage.removeItem(`formbricks-${surveyId}-responses`);
};
