import { WORKFLOW_SWITCH_DEFAULT_BRANCH, toSwitchCaseCondition } from "@formbricks/workflows";
import { evaluateWorkflowCondition } from "./if-else";
import type { WorkflowStepExecutor } from "./types";

/**
 * A Switch (ENG-7157): its Variable against each case in order, compared as an If/else condition
 * is (ADR 0046). The first case that matches is the branch; none matching is Default. Cases after
 * the match are never tried, so run detail lists the cases up to the one taken.
 */
export const switchStepExecutor: WorkflowStepExecutor<"switch"> = {
  hasEffects: false,
  describeInput: (node) => ({ left: node.config.left, cases: node.config.cases }),
  execute: async ({ node, context }) => {
    const cases: { id: string; matched: boolean }[] = [];
    let branch = WORKFLOW_SWITCH_DEFAULT_BRANCH;
    for (const switchCase of node.config.cases) {
      const matched = evaluateWorkflowCondition(toSwitchCaseCondition(node.config.left, switchCase), context);
      cases.push({ id: switchCase.id, matched });
      if (matched) {
        branch = switchCase.id;
        break;
      }
    }
    return { status: "succeeded", error: null, output: { branch, cases } };
  },
  decide: (output) => {
    if (typeof output.branch !== "string" || output.branch === "") {
      throw new Error("switch step output has no branch");
    }
    return { next: "branch", branch: output.branch };
  },
};
