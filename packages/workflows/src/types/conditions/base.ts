import { z } from "zod";
import { ZWorkflowDataRef } from "../common";

export const ZWorkflowConditionOperator = z.enum([
  "equals",
  "notEquals",
  "lessThan",
  "lessEqual",
  "greaterThan",
  "greaterEqual",
  "contains",
  "notContains",
  "exists",
  "notExists",
]);
export type TWorkflowConditionOperator = z.infer<typeof ZWorkflowConditionOperator>;

export const ZWorkflowConditionValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  ZWorkflowDataRef,
]);
export type TWorkflowConditionValue = z.infer<typeof ZWorkflowConditionValue>;

const WORKFLOW_CONDITION_PRESENCE_OPERATORS = new Set<TWorkflowConditionOperator>(["exists", "notExists"]);

export interface TWorkflowCondition {
  id: string;
  left: z.infer<typeof ZWorkflowDataRef>;
  operator: TWorkflowConditionOperator;
  right?: TWorkflowConditionValue;
}

export interface TWorkflowConditionGroup {
  id: string;
  connector: "and" | "or";
  conditions: (TWorkflowCondition | TWorkflowConditionGroup)[];
}

export const ZWorkflowCondition: z.ZodType<TWorkflowCondition> = z
  .object({
    id: z.string().min(1),
    left: ZWorkflowDataRef,
    operator: ZWorkflowConditionOperator,
    right: ZWorkflowConditionValue.optional().describe(
      "Right-hand comparison value. Omit for presence operators."
    ),
  })
  .superRefine((condition, ctx) => {
    const isPresenceOperator = WORKFLOW_CONDITION_PRESENCE_OPERATORS.has(condition.operator);

    if (isPresenceOperator && condition.right !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: `Operator ${condition.operator} must not have a right-hand value`,
        path: ["right"],
      });
    }

    if (!isPresenceOperator && condition.right === undefined) {
      ctx.addIssue({
        code: "custom",
        message: `Operator ${condition.operator} requires a right-hand value`,
        path: ["right"],
      });
    }
  });

export const ZWorkflowConditionGroup: z.ZodType<TWorkflowConditionGroup> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    connector: z.enum(["and", "or"]),
    conditions: z.array(z.union([ZWorkflowCondition, ZWorkflowConditionGroup])).min(1),
  })
);
