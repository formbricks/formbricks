import { z } from "zod";
import { ZWorkflowDataRef, ZWorkflowNodeBase } from "../common";
import {
  type TWorkflowCondition,
  type TWorkflowConditionOperator,
  type TWorkflowConditionValue,
  ZWorkflowConditionOperator,
  ZWorkflowConditionValue,
  checkConditionOperands,
} from "./base";

/** The branch a Switch takes when no case matches; no case may use it as its id. */
export const WORKFLOW_SWITCH_DEFAULT_BRANCH = "default";

/** Longest case name; checked on save, since the name is the branch's label on the canvas. */
export const MAX_SWITCH_CASE_NAME_LENGTH = 50;

export interface TWorkflowSwitchCase {
  id: string;
  name: string;
  operator: TWorkflowConditionOperator;
  right?: TWorkflowConditionValue;
}

/**
 * One case of a Switch: a name (its branch's label) and a comparison of the Switch's Variable, with
 * the If/else operators and value rules (ADR 0046). The id is the branch's `sourceHandle`.
 */
export const ZWorkflowSwitchCase: z.ZodType<TWorkflowSwitchCase> = z
  .object({
    id: z.string().min(1).describe("The case's branch: edges leaving by it use this as their sourceHandle."),
    name: z.string().describe(`The branch's label, at most ${MAX_SWITCH_CASE_NAME_LENGTH} characters.`),
    operator: ZWorkflowConditionOperator,
    right: ZWorkflowConditionValue.optional().describe(
      "What the Variable is compared against: a fixed value, a list of texts for list operators, or a Variable reference. Omit for presence operators."
    ),
  })
  .superRefine(checkConditionOperands);

export const ZWorkflowSwitchNode = ZWorkflowNodeBase.extend({
  type: z.literal("switch"),
  config: z.object({
    left: ZWorkflowDataRef.describe("The one Variable every case compares."),
    cases: z
      .array(ZWorkflowSwitchCase)
      .describe("2 to 10 cases, tried in order; the run takes the first that matches."),
  }),
}).describe(
  "Switch step: the run continues down the edge of the first case that matches (sourceHandle = the case id), or down its default edge when none does."
);

export type TWorkflowSwitchNode = z.infer<typeof ZWorkflowSwitchNode>;

/** A case as the condition it is: the Switch's Variable on the left, the case's comparison on the right. */
export const toSwitchCaseCondition = (
  left: TWorkflowSwitchNode["config"]["left"],
  switchCase: TWorkflowSwitchCase
): TWorkflowCondition => ({
  id: switchCase.id,
  left,
  operator: switchCase.operator,
  ...(switchCase.right === undefined ? {} : { right: switchCase.right }),
});

/** Every branch of a Switch in the order the canvas draws them: its cases, then Default. */
export const getSwitchBranches = (node: TWorkflowSwitchNode): string[] => [
  ...node.config.cases.map((switchCase) => switchCase.id),
  WORKFLOW_SWITCH_DEFAULT_BRANCH,
];
