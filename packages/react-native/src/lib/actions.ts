import { FormbricksAPI } from "@formbricks/api";
import { TJsActionInput } from "@formbricks/types/js";
import { TSurvey } from "@formbricks/types/surveys/types";
import { InvalidCodeError, NetworkError, Result, err, okVoid } from "../../../js-core/src/shared/errors";
import { Logger } from "../../../js-core/src/shared/logger";
import { shouldDisplayBasedOnPercentage } from "../../../js-core/src/shared/utils";
import { appConfig } from "./config";
import { SurveyStore } from "./surveyStore";

const logger = Logger.getInstance();
const surveyStore = SurveyStore.getInstance();

export const triggerSurvey = async (survey: TSurvey): Promise<void> => {
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

export const trackAction = async (name: string, alias?: string): Promise<Result<void, NetworkError>> => {
  const aliasName = alias || name;
  const { userId } = appConfig.get();
  const input: TJsActionInput = {
    environmentId: appConfig.get().environmentId,
    userId,
    name,
  };

  // don't send actions to the backend if the person is not identified
  if (userId) {
    logger.debug(`Sending action "${aliasName}" to backend`);

    const api = new FormbricksAPI({
      apiHost: appConfig.get().apiHost,
      environmentId: appConfig.get().environmentId,
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
        url: `${appConfig.get().apiHost}/api/v1/client/${appConfig.get().environmentId}/actions`,
        responseMessage: res.error.message,
      });
    }
  }

  logger.debug(`Formbricks: Action "${aliasName}" tracked`);

  // get a list of surveys that are collecting insights
  const activeSurveys = appConfig.get().state?.surveys;

  if (!!activeSurveys && activeSurveys.length > 0) {
    for (const survey of activeSurveys) {
      for (const trigger of survey.triggers) {
        if (trigger.actionClass.name === name) {
          await triggerSurvey(survey);
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
  } = appConfig.get();

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
