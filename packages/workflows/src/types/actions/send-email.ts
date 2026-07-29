import { z } from "zod";
import { ZWorkflowNodeBase } from "../common";
import { WORKFLOW_ACTIONS } from "./enum";

/**
 * Send-email action config, 1:1 field parity with survey Follow-ups (`ZSurveyFollowUpAction`). The
 * runtime renders it exactly like Follow-ups:
 *  - `to`: a literal email address OR the element id of a survey question / hidden field whose answer
 *    holds the respondent's email (contact-info elements resolve index `[2]`). A *literal* address
 *    must belong to a member of the workflow's organization — enable/test reject a non-member and the
 *    runner refuses to send to one, so a workflow cannot forward response data to an arbitrary
 *    external inbox (ENG-2029). An element-id `to` resolves to the respondent's own address and is
 *    never allowlist-checked.
 *  - `body`: HTML with recall tokens (`#recall:[elementId]/fallback:x#`) expanded against the response,
 *    then sanitized to a narrow allowlist and wrapped in the branded Follow-ups email template.
 *  - `subject`: used verbatim (recall is not applied to the subject).
 *  - `from`: vestigial seed value, NOT the actual sender. Emails always send from the deployment
 *    `MAIL_FROM` (parity with Follow-ups); `from` is only used to derive the stable Message-ID domain.
 */
export const ZWorkflowSendEmailActionConfig = z.object({
  to: z
    .string()
    .describe(
      "Recipient: either a literal email address, which must belong to a member of this organization, or the element id of a survey question / hidden field holding the respondent's email (contact-info elements resolve index [2]). Enabling or testing a workflow whose literal recipient is not an organization member fails, and the runner will not send to one."
    ),
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
