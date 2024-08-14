import { TJsTrackProperties } from "@formbricks/types/js";
import { InvalidCodeError, NetworkError, Result, err, okVoid } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { getIsDebug } from "../../shared/utils";
import { AppConfig } from "./config";
import { sync } from "./sync";
import { triggerSurvey } from "./widget";

const logger = Logger.getInstance();
const appConfig = AppConfig.getInstance();

export const trackAction = async (
  name: string,
  alias?: string,
  properties?: TJsTrackProperties
): Promise<Result<void, NetworkError>> => {
  const aliasName = alias || name;
  const { userId } = appConfig.get();

  if (userId) {
    // we skip the resync on a new action since this leads to too many requests if the user has a lot of actions
    // also this always leads to a second sync call on the `New Session` action
    // when debug: sync after every action for testing purposes
    if (getIsDebug()) {
      logger.debug(`Resync after action "${aliasName} in debug mode"`);
      await sync(
        {
          environmentId: appConfig.get().environmentId,
          apiHost: appConfig.get().apiHost,
          userId,
          attributes: appConfig.get().state.attributes,
        },
        true,
        appConfig
      );
    }
  }

  logger.debug(`Formbricks: Action "${aliasName}" tracked`);

  // get a list of surveys that are collecting insights
  const activeSurveys = appConfig.get().state?.surveys;

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
  const {
    state: { actionClasses = [] },
  } = appConfig.get();

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
