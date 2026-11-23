import { z } from "zod";
import { ZWorkflowNodeBase } from "../common";
import { ZWorkflowConditionGroup } from "./base";

/**
 * A Filter (ADR 0056): an If/else with one way out. When its conditions hold, the run continues to the
 * next step; when they don't, the run ends there, completed, and the steps after it are not taken.
 * It takes the If/else's condition group, operators and limits.
 */
export const ZWorkflowFilterNode = ZWorkflowNodeBase.extend({
  type: z.literal("filter"),
  config: z.strictObject({
    condition: ZWorkflowConditionGroup,
  }),
})
  .strict()
  .describe(
    "Filter step: the run continues down its one edge when the condition group holds; otherwise the run ends there, completed."
  );

export type TWorkflowFilterNode = z.infer<typeof ZWorkflowFilterNode>;

/**
 * The steps that take a condition group: an If/else and a Filter. Its conditions follow the same rules
 * in both (limits, operator names, Variables, run detail).
 */
export const isConditionStepNode = <TNode extends { type: string }>(
  node: TNode
): node is Extract<TNode, { type: "if_else" | "filter" }> =>
  node.type === "if_else" || node.type === "filter";
