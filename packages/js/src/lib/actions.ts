import { FormbricksAPI } from "@formbricks/api";
import { TJsActionInput } from "@formbricks/types/js";
import { TSurvey } from "@formbricks/types/surveys";

import { Config } from "./config";
import { NetworkError, Result, err, okVoid } from "./errors";
import { Logger } from "./logger";
import { sync } from "./sync";
import { getIsDebug } from "./utils";
import { renderWidget } from "./widget";

const logger = Logger.getInstance();
const config = Config.getInstance();

const intentsToNotCreateOnApp = ["Exit Intent (Desktop)", "50% Scroll"];

const shouldDisplayBasedOnPercentage = (displayPercentage: number) => {
  const randomNum = Math.floor(Math.random() * 100) + 1;
  return randomNum <= displayPercentage;
};

export const trackAction = async (name: string): Promise<Result<void, NetworkError>> => {
  const {
    userId,
    state: { surveys = [] },
  } = config.get();

  // if surveys have a inline triggers, we need to check the name of the action in the code action config
  surveys.forEach(async (survey) => {
    const { inlineTriggers } = survey;
    const { codeConfig } = inlineTriggers ?? {};

    if (name === codeConfig?.identifier) {
      await renderWidget(survey);
      return;
    }
  });

  const input: TJsActionInput = {
    environmentId: config.get().environmentId,
    userId,
    name,
  };

  // don't send actions to the backend if the person is not identified
  if (userId && !intentsToNotCreateOnApp.includes(name)) {
    logger.debug(`Sending action "${name}" to backend`);

    const api = new FormbricksAPI({
      apiHost: config.get().apiHost,
      environmentId: config.get().environmentId,
    });
    const res = await api.client.action.create({
      ...input,
      userId,
    });

    if (!res.ok) {
      return err({
        code: "network_error",
        message: `Error tracking action ${name}`,
        status: 500,
        url: `${config.get().apiHost}/api/v1/client/${config.get().environmentId}/actions`,
        responseMessage: res.error.message,
      });
    }

    // we skip the resync on a new action since this leads to too many requests if the user has a lot of actions
    // also this always leads to a second sync call on the `New Session` action
    // when debug: sync after every action for testing purposes
    if (getIsDebug()) {
      await sync(
        {
          environmentId: config.get().environmentId,
          apiHost: config.get().apiHost,
          userId,
        },
        true
      );
    }
  }

  logger.debug(`Formbricks: Action "${name}" tracked`);

  // get a list of surveys that are collecting insights
  const activeSurveys = config.get().state?.surveys;

  if (!!activeSurveys && activeSurveys.length > 0) {
    await triggerSurvey(name, activeSurveys);
  } else {
    logger.debug("No active surveys to display");
  }

  return okVoid();
};

export const triggerSurvey = async (actionName: string, activeSurveys: TSurvey[]): Promise<void> => {
  for (const survey of activeSurveys) {
    // Check if the survey should be displayed based on displayPercentage
    if (survey.displayPercentage) {
      const shouldDisplaySurvey = shouldDisplayBasedOnPercentage(survey.displayPercentage);
      if (!shouldDisplaySurvey) {
        logger.debug("Survey display skipped based on displayPercentage.");
        continue;
      }
    }
    for (const trigger of survey.triggers) {
      if (trigger === actionName) {
        logger.debug(`Formbricks: survey ${survey.id} triggered by action "${actionName}"`);
        await renderWidget(survey);
        return;
      }
    }
  }
};
