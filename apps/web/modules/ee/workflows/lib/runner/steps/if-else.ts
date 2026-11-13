import { compareConditionValues } from "@formbricks/types/surveys/condition-comparison";
import type { TSurveyLogicConditionsOperator } from "@formbricks/types/surveys/logic";
import { evaluateConditionGroup } from "@formbricks/types/surveys/logic-evaluation";
import {
  type TWorkflowCondition,
  type TWorkflowConditionGroup,
  type TWorkflowDataRef,
  type TWorkflowIfElseBranch,
  type TWorkflowRunContext,
  resolveWorkflowVariable,
  toSurveyConditionOperator,
} from "@formbricks/workflows";
import type { WorkflowStepExecutor } from "./types";

const isDataRef = (value: TWorkflowCondition["right"]): value is TWorkflowDataRef =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A Variable's value, or its fallback when the run has none (`undefined` without a fallback). */
const readRef = (ref: TWorkflowDataRef, context: TWorkflowRunContext): unknown => {
  const resolved = resolveWorkflowVariable(context, ref.path);
  if (resolved.found) return resolved.value;
  return ref.fallback;
};

/**
 * One condition, compared exactly as survey logic compares (ADR 0046). A Variable has no survey
 * element behind it, so no element context is passed and the plain value rules apply. Legacy
 * operator names are read as the survey operator they mean.
 */
export const evaluateWorkflowCondition = (
  condition: TWorkflowCondition,
  context: TWorkflowRunContext
): boolean => {
  // Typed against the survey operator enum: a workflow operator that is not a survey operator fails to compile.
  const operator: TSurveyLogicConditionsOperator = toSurveyConditionOperator(condition.operator);
  const left = readRef(condition.left, context);
  const right = isDataRef(condition.right) ? readRef(condition.right, context) : condition.right;
  return compareConditionValues(operator, left, right);
};

export interface TWorkflowConditionGroupResult {
  matched: boolean;
  /** Each leaf condition's result, in order, for run detail ("matched" / "not matched"). */
  conditions: { id: string; matched: boolean }[];
}

export const evaluateWorkflowConditionGroup = (
  group: TWorkflowConditionGroup,
  context: TWorkflowRunContext
): TWorkflowConditionGroupResult => {
  const conditions: TWorkflowConditionGroupResult["conditions"] = [];
  const matched = evaluateConditionGroup<TWorkflowCondition>(group, (condition) => {
    const result = evaluateWorkflowCondition(condition, context);
    conditions.push({ id: condition.id, matched: result });
    return result;
  });
  return { matched, conditions };
};

const isBranch = (value: unknown): value is TWorkflowIfElseBranch => value === "then" || value === "else";

export const ifElseStepExecutor: WorkflowStepExecutor<"if_else"> = {
  hasEffects: false,
  describeInput: (node) => ({ condition: node.config.condition }),
  execute: async ({ node, context }) => {
    const { matched, conditions } = evaluateWorkflowConditionGroup(node.config.condition, context);
    const branch: TWorkflowIfElseBranch = matched ? "then" : "else";
    return { status: "succeeded", error: null, output: { branch, matched, conditions } };
  },
  decide: (output) => {
    if (!isBranch(output.branch)) {
      throw new Error("if_else step output has no branch");
    }
    return { next: "branch", branch: output.branch };
  },
};
