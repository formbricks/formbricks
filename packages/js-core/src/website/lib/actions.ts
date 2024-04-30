import { NetworkError, Result, okVoid } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { WebsiteConfig } from "./config";
import { triggerSurvey } from "./widget";

const logger = Logger.getInstance();
const websiteConfig = WebsiteConfig.getInstance();

export const trackAction = async (name: string): Promise<Result<void, NetworkError>> => {
  logger.debug(`Formbricks: Action "${name}" tracked`);

  // get a list of surveys that are collecting insights
  const activeSurveys = websiteConfig.get().state?.surveys;

  if (!!activeSurveys && activeSurveys.length > 0) {
    for (const survey of activeSurveys) {
      for (const trigger of survey.triggers) {
        if (trigger.key === name) {
          await triggerSurvey(survey, name);
        }
      }
    }
  } else {
    logger.debug("No active surveys to display");
  }

  return okVoid();
};
