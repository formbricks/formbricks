import { evaluateShowConditions } from "@formbricks/types/show-conditions-evaluate";
import { emitDebugSurveyEvent, isDebugEnabled } from "@/lib/common/debug";
import { Logger } from "@/lib/common/logger";
import { getDeviceInfo } from "@/lib/visit/device";
import { getVisitSnapshot } from "@/lib/visit/visit-store";
import { type TWorkspaceStateSurvey } from "@/types/config";

/**
 * Checks a survey's show conditions against this page, this visit and this device (ENG-3568,
 * ENG-3875). Called when a trigger fires and again when the survey's delay ends, since time on site
 * grows and an SPA can change page during the delay. A survey without conditions always passes.
 */
export const passesShowConditions = (
  survey: TWorkspaceStateSurvey,
  action: string | undefined,
  stage: "trigger" | "afterDelay"
): boolean => {
  const conditions = survey.showConditions ?? null;
  if (!conditions && !isDebugEnabled()) return true;

  const evaluation = evaluateShowConditions(conditions, {
    url: window.location.href,
    pageReferrer: document.referrer,
    visit: getVisitSnapshot(),
    device: getDeviceInfo(),
  });

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
