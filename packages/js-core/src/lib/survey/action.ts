import { Config } from "@/lib/common/config";
import { emitDebugSurveyEvent, isDebugEnabled } from "@/lib/common/debug";
import { FORMBRICKS_EVENTS, emitFormbricksEvent } from "@/lib/common/events";
import { Logger } from "@/lib/common/logger";
import { getSurveyExclusionReason } from "@/lib/common/utils";
import { triggerSurvey } from "@/lib/survey/widget";
import { type InvalidCodeError, type NetworkError, type Result, err, okVoid } from "@/types/error";
import { type TTrackProperties } from "@/types/survey";

/**
 * Debug mode only: a survey on this trigger that was already dropped at setup (display option,
 * cooldown, segment) never reaches `triggerSurvey`, so it is reported here with the reason. Most
 * "why didn't it show?" questions are answered by one of these.
 */
const reportExcludedSurveys = (actionName: string): void => {
  const { workspace, user, filteredSurveys } = Config.getInstance().get();
  const eligibleIds = new Set(filteredSurveys.map((survey) => survey.id));

  for (const survey of workspace.data.surveys) {
    if (eligibleIds.has(survey.id)) continue;
    if (!survey.triggers.some((trigger) => trigger.actionClass.name === actionName)) continue;

    const exclusion = getSurveyExclusionReason(survey, workspace, user);
    if (exclusion) {
      emitDebugSurveyEvent({
        surveyId: survey.id,
        action: actionName,
        stage: "trigger",
        outcome: "excluded",
        exclusion,
      });
    }
  }
};

/**
 * Tracks an action name and triggers associated surveys
 * @param name - The name of the action to track
 * @param alias - Optional alias for the action name
 * @param properties - Optional properties to set, like the hidden fields (deprecated, hidden fields will be removed in a future version)
 * @returns Result indicating success or network error
 */
export const trackAction = async (
  name: string,
  alias?: string,
  properties?: TTrackProperties
): Promise<Result<void, NetworkError>> => {
  const logger = Logger.getInstance();
  const appConfig = Config.getInstance();

  const aliasName = alias ?? name;

  logger.debug(`Formbricks: Action "${aliasName}" tracked`);

  // The shared path under both code and no-code actions, so every tracked action reaches the host
  // exactly once — whether or not it triggers a survey (funnel analytics wants the misses too).
  emitFormbricksEvent(FORMBRICKS_EVENTS.actionTracked, { action: aliasName });

  if (isDebugEnabled()) reportExcludedSurveys(name);

  // get a list of surveys that are collecting insights
  const activeSurveys = appConfig.get().filteredSurveys;

  if (Boolean(activeSurveys) && activeSurveys.length > 0) {
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

/**
 * Tracks an action by its code and triggers associated surveys (used for code actions only)
 * @param code - The action code to track
 * @param properties - Optional properties to set, like the hidden fields (deprecated, hidden fields will be removed in a future version)
 * @returns Result indicating success, network error, or invalid code error
 */
export const trackCodeAction = async (
  code: string,
  properties?: TTrackProperties
): Promise<Result<void, NetworkError> | Result<void, InvalidCodeError>> => {
  const appConfig = Config.getInstance();

  const {
    workspace: {
      data: { actionClasses = [] },
    },
  } = appConfig.get();

  const codeActionClasses = actionClasses.filter((action) => action.type === "code");
  const actionClass = codeActionClasses.find((action) => action.key === code);

  if (!actionClass) {
    return err({
      code: "invalid_code",
      message: `Action with identifier '${code}' is unknown. Please add this action in Formbricks in order to use it via the SDK action tracking.`,
    });
  }

  return trackAction(actionClass.name, code, properties);
};

export const trackNoCodeAction = (name: string): Promise<Result<void, NetworkError>> => {
  return trackAction(name);
};
