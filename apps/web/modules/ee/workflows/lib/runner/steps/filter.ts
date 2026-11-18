import { createChoiceAnswerReader } from "./choice-answers";
import { evaluateWorkflowConditionGroup } from "./if-else";
import type { WorkflowStepExecutor } from "./types";

/**
 * A Filter (ADR 0056): its conditions compared exactly as an If/else's (ADR 0046). When they hold,
 * the run goes on to the next step; when they don't, the run ends here, completed, and the steps
 * after it are not taken.
 */
export const filterStepExecutor: WorkflowStepExecutor<"filter"> = {
  hasEffects: false,
  describeInput: (node) => ({ condition: node.config.condition }),
  execute: async ({ node, context, environment }) => {
    const { matched, conditions } = evaluateWorkflowConditionGroup(
      node.config.condition,
      context,
      createChoiceAnswerReader(environment.surveyResponse)
    );
    return { status: "succeeded", error: null, output: { passed: matched, conditions } };
  },
  decide: (output) => {
    if (typeof output.passed !== "boolean") {
      throw new TypeError("filter step output has no result");
    }
    return output.passed ? { next: "continue" } : { next: "end" };
  },
};
