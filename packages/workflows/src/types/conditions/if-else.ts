import { z } from "zod";
import { ZWorkflowNodeBase } from "../common";
import { ZWorkflowCondition } from "./base";

export const ZWorkflowIfElseNode = ZWorkflowNodeBase.extend({
  type: z.literal("if_else"),
  config: z.object({
    conditions: z
      .array(ZWorkflowCondition)
      .min(1)
      .describe("Conditions evaluated to choose the next branch."),
    combinator: z.enum(["and", "or"]).default("and"),
  }),
}).describe("Workflow branch node for conditional logic. Not executable in Scope 1 workflows.");

export type TWorkflowIfElseNode = z.infer<typeof ZWorkflowIfElseNode>;
