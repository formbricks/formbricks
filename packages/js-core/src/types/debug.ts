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
  /** The stored conditions could not be read, so the survey stays hidden. */
  | "conditionsUnreadable"
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
  /** `beforeShow` is the second condition check, right before the survey appears (after any delay). */
  stage: "trigger" | "beforeShow";
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
