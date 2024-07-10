import { TSurvey } from "@formbricks/types/surveys/types";

export const getFirstEnabledEnding = (survey: TSurvey) => {
  const firstEnabledEnding = survey.endings.find((ending) => {
    return ending.enabled;
  });
  return firstEnabledEnding;
};

export const getEnabledEndingCardsCount = (survey: TSurvey): number => {
  let count = 0;
  survey.endings.forEach((ending) => {
    if (ending.enabled) count++;
  });
  return count;
};
