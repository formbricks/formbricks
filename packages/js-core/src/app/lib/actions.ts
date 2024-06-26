import { FormbricksAPI } from "@formbricks/api";
import { InvalidCodeError, NetworkError, Result, err, okVoid } from "@formbricks/lib/js/errors";
import { Logger } from "@formbricks/lib/js/logger";
import { TJsActionInput, TJsTrackProperties } from "@formbricks/types/js";
import { AppConfig } from "./config";
import { triggerSurvey } from "./widget";

const logger = Logger.getInstance();
const inAppConfig = AppConfig.getInstance();

export const trackAction = async (
  name: string,
  alias?: string,
  properties?: TJsTrackProperties
): Promise<Result<void, NetworkError>> => {
  const aliasName = alias || name;
  const { userId } = inAppConfig.get();

  const input: TJsActionInput = {
    environmentId: inAppConfig.get().environmentId,
    userId,
    name,
  };

  // don't send actions to the backend if the person is not identified
  if (userId) {
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
  }

  logger.debug(`Formbricks: Action "${aliasName}" tracked`);

  // get a list of surveys that are collecting insights
  const activeSurveys = inAppConfig.get().state?.surveys;

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
  } = inAppConfig.get();

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
