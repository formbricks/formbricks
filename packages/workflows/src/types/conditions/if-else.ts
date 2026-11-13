import { z } from "zod";
import { ZWorkflowNodeBase } from "../common";
import { ZWorkflowConditionGroup } from "./base";

export const ZWorkflowIfElseNode = ZWorkflowNodeBase.extend({
  type: z.literal("if_else"),
  config: z.object({
    condition: ZWorkflowConditionGroup,
  }),
}).describe(
  "If/else step: the run continues down its then edge when the condition group holds, else down its else edge."
);

export type TWorkflowIfElseNode = z.infer<typeof ZWorkflowIfElseNode>;
