import { Config } from "./config";
import { NetworkError, Result, err, okVoid } from "./errors";
import { Logger } from "./logger";
import { renderWidget } from "./widget";
import { Survey } from "@formbricks/types/js";
const logger = Logger.getInstance();
const config = Config.getInstance();

export const trackEvent = async (
  eventName: string,
  properties?: any
): Promise<Result<void, NetworkError>> => {
  const res = await fetch(
    `${config.get().apiHost}/api/v1/client/environments/${config.get().environmentId}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        sessionId: config.get().session.id,
        eventName,
        properties,
      }),
    }
  );

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

  logger.debug(`Formbricks: Event "${eventName}" tracked`);

  // get a list of surveys that are collecting insights
  const activeSurveys = config.get().settings?.surveys;

  if (activeSurveys.length > 0) {
    triggerSurvey(eventName, activeSurveys);
  } else {
    logger.debug("No active surveys to display");
  }

  return okVoid();
};

export const triggerSurvey = (eventName: string, activeSurveys: Survey[]): void => {
  for (const survey of activeSurveys) {
    for (const trigger of survey.triggers) {
      if (trigger.eventClass?.name === eventName) {
        logger.debug(`Formbricks: survey ${survey.id} triggered by event "${eventName}"`);
        renderWidget(survey);
        return;
      }
    }
  }
};
