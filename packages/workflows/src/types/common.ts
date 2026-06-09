import { z } from "zod";

export const ZWorkflowStatus = z
  .enum(["draft", "enabled", "disabled", "archived"])
  .describe(
    "Lifecycle state of a workflow. Archived workflows are soft-deleted and excluded from default reads."
  );
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
  .catchall(z.unknown())
  .describe("Builder-only UI metadata that does not affect workflow execution.");
export type TWorkflowNodeUi = z.infer<typeof ZWorkflowNodeUi>;

export const ZWorkflowDataRef = z
  .object({
    path: z.string().min(1).describe("Dot-path to a value in the workflow run context."),
    fallback: z.string().optional().describe("Fallback string used when the referenced path is missing."),
  })
  .describe("Reference to dynamic workflow data used by conditions or actions.");

export type TWorkflowDataRef = z.infer<typeof ZWorkflowDataRef>;

export const ZWorkflowNodeBase = z.object({
  id: z.string().min(1),
  type: ZWorkflowNodeType,
  label: z.string().min(1).max(120).optional(),
  ui: ZWorkflowNodeUi.optional(),
});
