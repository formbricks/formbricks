import { z } from "zod";
import { ZWorkflowNodeBase } from "../common";
import { ZWorkflowCondition } from "./base";

export const ZWorkflowIfElseNode = ZWorkflowNodeBase.extend({
  type: z.literal("if_else"),
  config: z.object({
    conditions: z.array(ZWorkflowCondition).min(1),
    combinator: z.enum(["and", "or"]).default("and"),
  }),
});
export type TWorkflowIfElseNode = z.infer<typeof ZWorkflowIfElseNode>;
