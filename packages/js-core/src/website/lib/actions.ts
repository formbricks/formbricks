import { NetworkError, Result, okVoid } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { WebsiteConfig } from "./config";
import { triggerSurvey } from "./widget";

const logger = Logger.getInstance();
const websiteConfig = WebsiteConfig.getInstance();

export const trackAction = async (name: string): Promise<Result<void, NetworkError>> => {
  const {
    state: { surveys = [] },
  } = websiteConfig.get();

  // if surveys have a inline triggers, we need to check the name of the action in the code action config
  surveys.forEach(async (survey) => {
    const { inlineTriggers } = survey;
    const { codeConfig } = inlineTriggers ?? {};

    if (name === codeConfig?.identifier) {
      await triggerSurvey(survey);
      return;
    }
  });

  logger.debug(`Formbricks: Action "${name}" tracked`);

  // get a list of surveys that are collecting insights
  const activeSurveys = websiteConfig.get().state?.surveys;

  if (!!activeSurveys && activeSurveys.length > 0) {
    for (const survey of activeSurveys) {
      for (const trigger of survey.triggers) {
        if (trigger === name) {
          await triggerSurvey(survey, name);
        }
      }
    }
  } else {
    logger.debug("No active surveys to display");
  }

  return okVoid();
};
