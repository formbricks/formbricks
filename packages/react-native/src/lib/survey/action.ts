import { RNConfig } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { shouldDisplayBasedOnPercentage } from "@/lib/common/utils";
import { SurveyStore } from "@/lib/survey/store";
import type { TEnvironmentStateSurvey } from "@/types/config";
import { type InvalidCodeError, type NetworkError, type Result, err, okVoid } from "@/types/error";
import { fetch } from "@react-native-community/netinfo";

/**
 * Triggers the display of a survey if it meets the display percentage criteria
 * @param survey - The survey configuration to potentially display
 */
export const triggerSurvey = (survey: TEnvironmentStateSurvey): void => {
  const surveyStore = SurveyStore.getInstance();
  const logger = Logger.getInstance();

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

/**
 * Tracks an action name and triggers associated surveys
 * @param name - The name of the action to track
 * @param alias - Optional alias for the action name
 * @returns Result indicating success or network error
 */
export const trackAction = (name: string, alias?: string): Result<void, NetworkError> => {
  const logger = Logger.getInstance();
  const appConfig = RNConfig.getInstance();

  const aliasName = alias ?? name;

  logger.debug(`Formbricks: Action "${aliasName}" tracked`);

  // get a list of surveys that are collecting insights
  const activeSurveys = appConfig.get().filteredSurveys;

  if (Boolean(activeSurveys) && activeSurveys.length > 0) {
    for (const survey of activeSurveys) {
      for (const trigger of survey.triggers) {
        if (trigger.actionClass.name === name) {
          triggerSurvey(survey);
        }
      }
    }
  } else {
    logger.debug("No active surveys to display");
  }

  return okVoid();
};

/**
 * Tracks an action by its code and triggers associated surveys (used for code actions only)
 * @param code - The action code to track
 * @returns Result indicating success, network error, or invalid code error
 */
export const track = async (
  code: string
): Promise<
  | Result<void, NetworkError>
  | Result<void, InvalidCodeError>
  | Result<void, { code: "error"; message: string }>
> => {
  try {
    const appConfig = RNConfig.getInstance();

    const netInfo = await fetch();

    if (!netInfo.isConnected) {
      return err({
        code: "network_error",
        status: 500,
        message: "No internet connection. Please check your connection and try again.",
        responseMessage: "No internet connection. Please check your connection and try again.",
        url: new URL(`${appConfig.get().appUrl}/js/surveys.umd.cjs`),
      });
    }

    const {
      environment: {
        data: { actionClasses = [] },
      },
    } = appConfig.get();

    const codeActionClasses = actionClasses.filter((action) => action.type === "code");
    const actionClass = codeActionClasses.find((action) => action.key === code);

    if (!actionClass) {
      return err({
        code: "invalid_code",
        message: `${code} action unknown. Please add this action in Formbricks first in order to use it in your code.`,
      });
    }

    return trackAction(actionClass.name, code);
  } catch (error) {
    return err({
      code: "error",
      message: "Error tracking action",
    });
  }
};
