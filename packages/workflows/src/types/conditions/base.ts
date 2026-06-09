import { z } from "zod";
import { ZWorkflowDataRef } from "../common";

export const ZWorkflowConditionOperator = z.enum([
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "exists",
  "notExists",
]);
export type TWorkflowConditionOperator = z.infer<typeof ZWorkflowConditionOperator>;

export const ZWorkflowCondition = z.object({
  left: ZWorkflowDataRef,
  operator: ZWorkflowConditionOperator,
  right: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});
export type TWorkflowCondition = z.infer<typeof ZWorkflowCondition>;
