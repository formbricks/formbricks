import { renderWidget } from "./widget";
import { Logger } from "./logger";
import { Config } from "./config";

const logger = Logger.getInstance();
const config = Config.getInstance();

export const trackEvent = async (eventName: string, properties?: any): Promise<void> => {
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
    logger.error(`Formbricks: Error tracking event: ${JSON.stringify(error)}`);
    return;
  }
  logger.debug(`Formbricks: Event "${eventName}" tracked`);
  triggerSurvey(eventName);
};

export const triggerSurvey = (eventName: string): void => {
  for (const survey of config.get().settings?.surveys) {
    for (const trigger of survey.triggers) {
      if (trigger.eventClass?.name === eventName) {
        logger.debug(`Formbricks: survey ${survey.id} triggered by event "${eventName}"`);
        renderWidget(survey);
        return;
      }
    }
  }
};
