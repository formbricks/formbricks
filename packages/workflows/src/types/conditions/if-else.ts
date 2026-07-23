import { z } from "zod";
import { ZWorkflowNodeBase } from "../common";
import { ZWorkflowConditionGroup } from "./base";

export const ZWorkflowIfElseNode = ZWorkflowNodeBase.extend({
  type: z.literal("if_else"),
  config: z.object({
    condition: ZWorkflowConditionGroup,
  }),
}).describe("Workflow branch node for conditional logic. Not executable by the current workflow runner.");

export type TWorkflowIfElseNode = z.infer<typeof ZWorkflowIfElseNode>;
