import type { TDeviceInfo, TShowConditions, TVisitSnapshot } from "@formbricks/types/show-conditions";
import type { TShowConditionsEvaluation } from "@formbricks/types/show-conditions-evaluate";

/**
 * The payload of the `formbricks_debug` event, which the debug panel (`formbricks-debug.js`) receives
 * through `formbricks.on()`. Both ship from the same instance but are cached separately, so the panel
 * must tolerate fields it does not know and fields that are missing.
 */

/** Why a survey was dropped before any trigger fired. */
export type TDebugSurveyExclusion =
  | "alreadyDisplayed"
  | "alreadyResponded"
  | "displayLimitReached"
  | "cooldown"
  | "segment";

export type TDebugSurveyOutcome =
  | "excluded"
  | "conditionsFailed"
  | "conditionsPassed"
  | "notSampled"
  | "anotherSurveyOpen"
  | "shown";

export interface TDebugSurveyEvent {
  type: "survey";
  at: number;
  surveyId: string;
  /** The trigger (action name) that fired. */
  action?: string;
  /** `afterDelay` is the second condition check, when a survey's delay ends. */
  stage: "trigger" | "afterDelay";
  outcome: TDebugSurveyOutcome;
  exclusion?: TDebugSurveyExclusion;
  /** The survey's conditions, so the panel can describe each result rather than show bare ids. */
  showConditions?: TShowConditions;
  conditions?: TShowConditionsEvaluation;
}

export interface TDebugVisitEvent {
  type: "visit";
  at: number;
  visit: TVisitSnapshot | null;
  device: TDeviceInfo;
}

export type TDebugEvent = TDebugSurveyEvent | TDebugVisitEvent;
