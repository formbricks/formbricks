import { TJsTrackProperties } from "@formbricks/types/js";
import { Config } from "./config";
import { InvalidCodeError, NetworkError, Result, err, okVoid } from "./errors";
import { Logger } from "./logger";
import { triggerSurvey } from "./widget";

const logger = Logger.getInstance();
const config = Config.getInstance();

export const trackAction = async (
  name: string,
  alias?: string,
  properties?: TJsTrackProperties
): Promise<Result<void, NetworkError>> => {
  const aliasName = alias || name;

  logger.debug(`Formbricks: Action "${aliasName}" tracked`);

  // get a list of surveys that are collecting insights
  const activeSurveys = config.get().filteredSurveys;

  if (!!activeSurveys && activeSurveys.length > 0) {
    for (const survey of activeSurveys) {
      for (const trigger of survey.triggers) {
        if (trigger.actionClass.name === name) {
          await triggerSurvey(survey, name, properties);
        }
      }
    }
  } else {
    logger.debug("No active surveys to display");
  }

  return okVoid();
};

export const trackCodeAction = (
  code: string,
  properties?: TJsTrackProperties
): Promise<Result<void, NetworkError>> | Result<void, InvalidCodeError> => {
  const actionClasses = config.get().environmentState.data.actionClasses;

  const codeActionClasses = actionClasses.filter((action) => action.type === "code");
  const action = codeActionClasses.find((action) => action.key === code);

  if (!action) {
    return err({
      code: "invalid_code",
      message: `${code} action unknown. Please add this action in Formbricks first in order to use it in your code.`,
    });
  }

  return trackAction(action.name, code, properties);
};

export const trackNoCodeAction = (name: string): Promise<Result<void, NetworkError>> => {
  return trackAction(name);
};
