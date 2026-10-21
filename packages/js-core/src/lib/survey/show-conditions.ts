import {
  type TShowConditionsEvaluation,
  evaluateShowConditions,
} from "@formbricks/types/show-conditions-evaluate";
import { emitDebugSurveyEvent, isDebugEnabled } from "@/lib/common/debug";
import { Logger } from "@/lib/common/logger";
import { getDeviceInfo } from "@/lib/visit/device";
import { getVisitSnapshot } from "@/lib/visit/visit-store";
import { type TWorkspaceStateSurvey } from "@/types/config";
import type { TDebugSurveyEvent } from "@/types/debug";

/**
 * Checks a survey's show conditions against this page, this visit and this device (ENG-3568,
 * ENG-3875). Called when a trigger fires and again right before the survey appears, since time on
 * site grows and an SPA can change page in between. A survey without conditions always passes.
 */
export const passesShowConditions = (
  survey: TWorkspaceStateSurvey,
  action: string | undefined,
  stage: TDebugSurveyEvent["stage"]
): boolean => {
  const conditions = survey.showConditions ?? null;
  if (!conditions && !isDebugEnabled()) return true;

  let evaluation: TShowConditionsEvaluation;
  try {
    evaluation = evaluateShowConditions(conditions, {
      url: window.location.href,
      pageReferrer: document.referrer,
      visit: getVisitSnapshot(),
      device: getDeviceInfo(),
    });
  } catch (error) {
    // Malformed stored conditions (a draft saved through the API, then published on a schedule).
    // Fail closed, and never throw: the caller loops over every survey on the trigger, and a throw
    // would stop the ones after this survey from showing too.
    Logger.getInstance().error(
      `Survey "${survey.id}" skipped: its show conditions could not be read. ${String(error)}`
    );
    emitDebugSurveyEvent({ surveyId: survey.id, action, stage, outcome: "conditionsUnreadable" });
    return false;
  }

  if (!evaluation.passed) {
    Logger.getInstance().debug(`Survey "${survey.id}" skipped: its show conditions do not match.`);
  }
  emitDebugSurveyEvent({
    surveyId: survey.id,
    action,
    stage,
    outcome: evaluation.passed ? "conditionsPassed" : "conditionsFailed",
    showConditions: conditions,
    conditions: evaluation,
  });

  return evaluation.passed;
};
