import { z } from "zod";

export const ZWorkflowStatus = z.enum(["draft", "enabled", "disabled", "archived"]);
export type TWorkflowStatus = z.infer<typeof ZWorkflowStatus>;

export const ZWorkflowNodeType = z.enum(["action", "if_else", "trigger"]);
export type TWorkflowNodeType = z.infer<typeof ZWorkflowNodeType>;

export const ZWorkflowChildNodeType = z.enum(["action", "if_else"]);
export type TWorkflowChildNodeType = z.infer<typeof ZWorkflowChildNodeType>;

export const ZWorkflowNodePosition = z.object({
  x: z.number(),
  y: z.number(),
});
export type TWorkflowNodePosition = z.infer<typeof ZWorkflowNodePosition>;

export const ZWorkflowNodeUi = z
  .object({
    position: ZWorkflowNodePosition.optional(),
    collapsed: z.boolean().optional(),
  })
  .catchall(z.unknown());
export type TWorkflowNodeUi = z.infer<typeof ZWorkflowNodeUi>;

export const ZWorkflowDataRef = z.object({
  path: z.string().min(1),
  fallback: z.string().optional(),
});

export type TWorkflowDataRef = z.infer<typeof ZWorkflowDataRef>;

export const ZWorkflowNodeBase = z.object({
  id: z.string().min(1),
  type: ZWorkflowNodeType,
  label: z.string().min(1).max(120).optional(),
  ui: ZWorkflowNodeUi.optional(),
});
