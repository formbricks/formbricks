import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { triggerSurvey } from "@/lib/survey/widget";
import { type InvalidCodeError, type NetworkError, type Result, err, okVoid } from "@/types/error";

/**
 * Tracks an action name and triggers associated surveys
 * @param name - The name of the action to track
 * @param alias - Optional alias for the action name
 * @returns Result indicating success or network error
 */
export const trackAction = async (name: string, alias?: string): Promise<Result<void, NetworkError>> => {
  const logger = Logger.getInstance();
  const appConfig = Config.getInstance();

  const aliasName = alias ?? name;

  logger.debug(`Formbricks: Action "${aliasName}" tracked`);

  // get a list of surveys that are collecting insights
  const activeSurveys = appConfig.get().filteredSurveys;

  if (Boolean(activeSurveys) && activeSurveys.length > 0) {
    for (const survey of activeSurveys) {
      for (const trigger of survey.triggers) {
        if (trigger.actionClass.name === name) {
          await triggerSurvey(survey, name);
        }
      }
    }
  } else {
    logger.debug("No active surveys to display");
  }

  return okVoid();
};

/**
 * Tracks an action by its code and triggers associated surveys (used for code actions only)
 * @param code - The action code to track
 * @returns Result indicating success, network error, or invalid code error
 */
export const trackCodeAction = async (
  code: string
): Promise<Result<void, NetworkError> | Result<void, InvalidCodeError>> => {
  const appConfig = Config.getInstance();

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

export const trackNoCodeAction = (name: string): Promise<Result<void, NetworkError>> => {
  return trackAction(name);
};
