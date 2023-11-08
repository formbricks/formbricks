import { TJsActionInput, TSurveyWithTriggers } from "@formbricks/types/js";
import { Config } from "./config";
import { NetworkError, Result, err, okVoid } from "./errors";
import { Logger } from "./logger";
import { renderWidget } from "./widget";
const logger = Logger.getInstance();
const config = Config.getInstance();

const intentsToNotCreateOnApp = ["Exit Intent (Desktop)", "50% Scroll"];

export const trackAction = async (
  name: string,
  properties: TJsActionInput["properties"] = {}
): Promise<Result<void, NetworkError>> => {
  const input: TJsActionInput = {
    environmentId: config.get().environmentId,
    personId: config.get().state?.person?.id || "",
    name,
    properties: properties || {},
  };

  if (config.get().state?.person?.id && !intentsToNotCreateOnApp.includes(name)) {
    // const res = await fetch(`${config.get().apiHost}/api/v1/js/actions`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },

    //   body: JSON.stringify(input),
    // });

    const res = await fetch(`${config.get().apiHost}/api/v1/client/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const error = await res.json();

      return err({
        code: "network_error",
        message: `Error tracking event: ${JSON.stringify(error)}`,
        status: res.status,
        url: res.url,
        responseMessage: error.message,
      });
    }
  }

  logger.debug(`Formbricks: Event "${name}" tracked`);

  // get a list of surveys that are collecting insights
  const activeSurveys = config.get().state?.surveys;

  if (!!activeSurveys && activeSurveys.length > 0) {
    triggerSurvey(name, activeSurveys);
  } else {
    logger.debug("No active surveys to display");
  }

  return okVoid();
};

export const triggerSurvey = (actionName: string, activeSurveys: TSurveyWithTriggers[]): void => {
  for (const survey of activeSurveys) {
    for (const trigger of survey.triggers) {
      if (typeof trigger === "string" ? trigger === actionName : trigger.name === actionName) {
        logger.debug(`Formbricks: survey ${survey.id} triggered by action "${actionName}"`);
        renderWidget(survey);
        return;
      }
    }
  }
};
