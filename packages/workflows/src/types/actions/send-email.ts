import { z } from "zod";

export const ZWorkflowSendEmailActionConfig = z.object({
  to: z.string(),
  from: z.email(),
  replyTo: z.array(z.email()),
  subject: z.string(),
  body: z.string(),
  attachResponseData: z.boolean(),
  includeVariables: z.boolean().optional(),
  includeHiddenFields: z.boolean().optional(),
});
export type TWorkflowSendEmailActionConfig = z.infer<typeof ZWorkflowSendEmailActionConfig>;
