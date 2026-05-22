import { z } from "zod";

// this file defines the data contract for a workflow and its steps.

export const DataRefSchema = z.object({
  $ref: z.string().min(1),
});

export const TriggerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("survey.response.created"),
    surveyId: z.string().min(1),
  }),
]);

export const OperatorSchema = z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "isSet", "isEmpty"]);

export const ConditionSchema = z.object({
  id: z.string().min(1),
  left: DataRefSchema,
  operator: OperatorSchema,
  right: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const ActionSchema = z.object({
  id: z.string().min(1),
  integration: z.string().min(1),
  operation: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
});

export const WorkflowStatusSchema = z.enum(["draft", "enabled", "disabled"]);

export const WorkflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: WorkflowStatusSchema,
  trigger: TriggerSchema.nullable(),
  conditions: z.array(ConditionSchema),
  actions: z.array(ActionSchema),
  ownerId: z.string().min(1),
  updatedAt: z.string(),
});

//the draft schema only should hold the fields that are editable
export const WorkflowDraftSchema = z.object({
  name: z.string().min(1).max(120),
  trigger: TriggerSchema.nullable(),
  conditions: z.array(ConditionSchema),
  actions: z.array(ActionSchema),
});

export type DataRef = z.infer<typeof DataRefSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type TriggerType = Trigger["type"];
export type Operator = z.infer<typeof OperatorSchema>;
export type Condition = z.infer<typeof ConditionSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowDraft = z.infer<typeof WorkflowDraftSchema>;
