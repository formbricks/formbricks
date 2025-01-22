import type { TJsEnvironmentStateSurvey } from "../types/config";
import { type InvalidCodeError, type NetworkError, type Result, err, okVoid } from "../types/errors";
import { RNConfig } from "./config";
import { Logger } from "./logger";
import { SurveyStore } from "./survey-store";
import { shouldDisplayBasedOnPercentage } from "./utils";

const appConfig = RNConfig.getInstance();
const logger = Logger.getInstance();
const surveyStore = SurveyStore.getInstance();

export const triggerSurvey = (survey: TJsEnvironmentStateSurvey): void => {
  // Check if the survey should be displayed based on displayPercentage
  if (survey.displayPercentage) {
    const shouldDisplaySurvey = shouldDisplayBasedOnPercentage(survey.displayPercentage);
    if (!shouldDisplaySurvey) {
      logger.debug(`Survey display of "${survey.name}" skipped based on displayPercentage.`);
      return; // skip displaying the survey
    }
  }

  surveyStore.setSurvey(survey);
};

export const trackAction = (name: string, alias?: string): Result<void, NetworkError> => {
  const aliasName = alias ?? name;

  logger.debug(`Formbricks: Action "${aliasName}" tracked`);

  // get a list of surveys that are collecting insights
  const activeSurveys = appConfig.get().filteredSurveys;

  if (Boolean(activeSurveys) && activeSurveys.length > 0) {
    for (const survey of activeSurveys) {
      for (const trigger of survey.triggers) {
        if (trigger.actionClass.name === name) {
          triggerSurvey(survey);
        }
      }
    }
  } else {
    logger.debug("No active surveys to display");
  }

  return okVoid();
};

export const trackCodeAction = (
  code: string
): Result<void, NetworkError> | Result<void, InvalidCodeError> => {
  const {
    environment: {
      data: { actionClasses = [] },
    },
  } = appConfig.get();

  const codeActionClasses = actionClasses.filter((action) => action.type === "code");
  const actionClass = codeActionClasses.find((action) => action.key === code);

  if (!actionClass) {
    return err({
      code: "invalid_code",
      message: `${code} action unknown. Please add this action in Formbricks first in order to use it in your code.`,
    });
  }

  return trackAction(actionClass.name, code);
};
