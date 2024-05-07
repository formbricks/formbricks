import { FormbricksAPI } from "@formbricks/api";
import { TJsActionInput } from "@formbricks/types/js";

import { InvalidCodeError, NetworkError, Result, err, okVoid } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { getIsDebug } from "../../shared/utils";
import { AppConfig } from "./config";
import { sync } from "./sync";
import { triggerSurvey } from "./widget";

const logger = Logger.getInstance();
const inAppConfig = AppConfig.getInstance();

const intentsToNotCreateOnApp = ["Exit Intent (Desktop)", "50% Scroll"];

export const trackAction = async (name: string, alias?: string): Promise<Result<void, NetworkError>> => {
  const aliasName = alias || name;
  const { userId } = inAppConfig.get();

  const input: TJsActionInput = {
    environmentId: inAppConfig.get().environmentId,
    userId,
    name,
  };

  // don't send actions to the backend if the person is not identified
  if (userId && !intentsToNotCreateOnApp.includes(name)) {
    logger.debug(`Sending action "${aliasName}" to backend`);

    const api = new FormbricksAPI({
      apiHost: inAppConfig.get().apiHost,
      environmentId: inAppConfig.get().environmentId,
    });
    const res = await api.client.action.create({
      ...input,
      userId,
    });

    if (!res.ok) {
      return err({
        code: "network_error",
        message: `Error tracking action ${aliasName}`,
        status: 500,
        url: `${inAppConfig.get().apiHost}/api/v1/client/${inAppConfig.get().environmentId}/actions`,
        responseMessage: res.error.message,
      });
    }

    // we skip the resync on a new action since this leads to too many requests if the user has a lot of actions
    // also this always leads to a second sync call on the `New Session` action
    // when debug: sync after every action for testing purposes
    if (getIsDebug()) {
      await sync(
        {
          environmentId: inAppConfig.get().environmentId,
          apiHost: inAppConfig.get().apiHost,
          userId,
          attributes: inAppConfig.get().state.attributes,
        },
        true
      );
    }
  }

  logger.debug(`Formbricks: Action "${aliasName}" tracked`);

  // get a list of surveys that are collecting insights
  const activeSurveys = inAppConfig.get().state?.surveys;

  if (!!activeSurveys && activeSurveys.length > 0) {
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

export const trackCodeAction = (
  code: string
): Promise<Result<void, NetworkError>> | Result<void, InvalidCodeError> => {
  const {
    state: { actionClasses = [] },
  } = inAppConfig.get();

  const codeActionClasses = actionClasses.filter((action) => action.type === "code");
  const action = codeActionClasses.find((action) => action.key === code);

  if (!action) {
    return err({
      code: "invalid_code",
      message: `${code} action unknown. Please add this action in Formbricks first in order to use it in your code.`,
    });
  }

  return trackAction(action.name, code);
};

export const trackNoCodeAction = (name: string): Promise<Result<void, NetworkError>> => {
  return trackAction(name);
};
