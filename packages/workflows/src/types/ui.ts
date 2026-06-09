import { z } from "zod";

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
