import { z } from "zod";
import { ZWorkflowNodeBase } from "../common";
import { WORKFLOW_ACTIONS } from "./enum";

/**
 * Send-email action config, 1:1 field parity with survey Follow-ups (`ZSurveyFollowUpAction`). The
 * runtime renders it exactly like Follow-ups:
 *  - `to`: a literal email address OR the element id of a survey question / hidden field whose answer
 *    holds the respondent's email (contact-info elements resolve index `[2]`).
 *  - `body`: HTML with recall tokens (`#recall:[elementId]/fallback:x#`) expanded against the response,
 *    then sanitized to a narrow allowlist and wrapped in the branded Follow-ups email template.
 *  - `subject`: used verbatim (recall is not applied to the subject).
 */
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

export const ZWorkflowSendEmailActionNode = ZWorkflowNodeBase.extend({
  type: z.literal("action"),
  actionType: z.literal(WORKFLOW_ACTIONS.SEND_EMAIL),
  config: ZWorkflowSendEmailActionConfig,
});

export type TWorkflowSendEmailActionNode = z.infer<typeof ZWorkflowSendEmailActionNode>;
