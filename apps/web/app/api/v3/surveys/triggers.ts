import "server-only";
import type { TActionClass } from "@formbricks/types/action-classes";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { V3SurveyReferenceValidationError } from "./reference-validation";
import type { TV3SurveyTrigger } from "./schemas";

/**
 * Validate trigger action-class ids against the workspace's action classes and resolve them to the
 * full action-class objects that the survey service expects (ZSurveyCreateInput / handleTriggerUpdates
 * both ultimately read `actionClass.id`, but ZSurveyCreateInput validates the full ZActionClass shape).
 * Throws structured `invalid_params` on unknown or duplicate ids; the v3 layer maps this to a 422.
 */
export function resolveV3SurveyTriggers(
  triggers: TV3SurveyTrigger[],
  actionClasses: TActionClass[]
): { actionClass: TActionClass }[] {
  const invalidParams: InvalidParam[] = [];
  const seen = new Set<string>();
  const resolved: { actionClass: TActionClass }[] = [];

  triggers.forEach((trigger, index) => {
    const name = `distribution.triggers.${index}.actionClassId`;

    if (seen.has(trigger.actionClassId)) {
      invalidParams.push({
        name,
        reason: `Duplicate trigger action class id '${trigger.actionClassId}'`,
        code: "duplicate_identifier",
        identifier: trigger.actionClassId,
      });
      return;
    }
    seen.add(trigger.actionClassId);

    const actionClass = actionClasses.find((candidate) => candidate.id === trigger.actionClassId);
    if (!actionClass) {
      invalidParams.push({
        name,
        reason: `Action class '${trigger.actionClassId}' was not found in this workspace`,
        code: "invalid_reference",
        identifier: trigger.actionClassId,
      });
      return;
    }

    resolved.push({ actionClass });
  });

  if (invalidParams.length > 0) {
    throw new V3SurveyReferenceValidationError(invalidParams);
  }

  return resolved;
}
