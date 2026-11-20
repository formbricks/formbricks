import type { TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import {
  BOOLEAN_ASSIGN_MESSAGE,
  BOOLEAN_VALUE_TARGET_MESSAGE,
  isStaticBooleanValue,
  isValidBooleanAssign,
} from "@formbricks/types/surveys/boolean-assign";
import type { TExpressionTypeContext } from "@formbricks/types/surveys/expression-types";
import type { InvalidParam } from "@/app/api/v3/lib/response";

type TCalculateAction = Extract<TSurveyBlockLogicAction, { objective: "calculate" }>;

/** Whether a calculate step writes a declared computed field of a type other than true/false. */
const isKnownNonBooleanTarget = (variableId: string, typeContext: TExpressionTypeContext): boolean => {
  const dataType = typeContext.getComputedFieldType(variableId);
  return dataType !== undefined && dataType !== "boolean";
};

/** Why a step that does not write a true/false field may not take this value; `undefined` when it may. */
const getNonBooleanTargetReason = (
  action: TCalculateAction,
  typeContext: TExpressionTypeContext
): string | undefined => {
  // An unknown target is left to the missing-reference check.
  if (!isKnownNonBooleanTarget(action.variableId, typeContext)) return undefined;
  if (isStaticBooleanValue(action.value)) return BOOLEAN_VALUE_TARGET_MESSAGE;
  if (
    action.value.type === "variable" &&
    typeContext.getComputedFieldType(action.value.value) === "boolean"
  ) {
    return "A true/false field can only be copied to another true/false field";
  }
  return undefined;
};

/**
 * The true/false rule a calculate action's value breaks (ENG-6973), as the issue a save would
 * report; `undefined` when it breaks none.
 *
 * On a computed true/false field it is the shared `isValidBooleanAssign`: a one-step assign of True,
 * False or another true/false field. On a field of any other type, True, False and a calculated
 * true/false field are refused: the save's refinement refuses them, and PATCH skips that refinement.
 */
export const getBooleanCalculateIssue = (
  action: TCalculateAction,
  name: string,
  typeContext: TExpressionTypeContext
): InvalidParam | undefined => {
  let reason: string | undefined;
  if (typeContext.getComputedFieldType(action.variableId) === "boolean") {
    const getFieldType = (storageKey: string, source: "computed" | "ingested") =>
      source === "computed"
        ? typeContext.getComputedFieldType(storageKey)
        : typeContext.getIngestedFieldType(storageKey);
    if (!isValidBooleanAssign(action, getFieldType)) reason = BOOLEAN_ASSIGN_MESSAGE;
  } else {
    reason = getNonBooleanTargetReason(action, typeContext);
  }
  return reason === undefined ? undefined : { name, reason: `Conditional Logic: ${reason}` };
};
