import { z } from "zod";
import { ZWorkflowNodeBase } from "../common";
import { WORKFLOW_ACTIONS } from "./enum";

/**
 * Send-email action config, 1:1 field parity with survey Follow-ups (`ZSurveyFollowUpAction`). The
 * runtime renders it exactly like Follow-ups:
 *  - `to`: a literal email address OR the element id of a survey question / hidden field whose answer
 *    holds the respondent's email (contact-info elements resolve index `[2]`). A *literal* address
 *    must belong to someone who can access the workflow's workspace — enable/test reject one who
 *    cannot and the runner refuses to send to them, so a workflow cannot forward response data to an
 *    arbitrary external inbox (ENG-2029) or to someone whose access was revoked (ENG-2186). An
 *    element-id `to` resolves to the respondent's own address and is never allowlist-checked.
 *  - `body`: HTML with recall tokens (`#recall:[elementId]/fallback:x#`) expanded against the response,
 *    then sanitized to a narrow allowlist and wrapped in the branded Follow-ups email template.
 *  - `subject`: used verbatim (recall is not applied to the subject).
 *  - `from`: vestigial seed value, NOT the actual sender. Emails always send from the deployment
 *    `MAIL_FROM` (parity with Follow-ups); `from` is only used to derive the stable Message-ID domain.
 *
 * One deliberate divergence from that parity: `subject` and `body` are length-bounded here and
 * unbounded in Follow-ups. Nothing else caps them — the persisted schema is permissive so authors can
 * save work in progress — so without these the only ceiling is the 16MB proxy body cap, and every
 * consumer that walks the body (the blankness predicate, recall expansion, sanitization) inherits it.
 * The limits sit far above any body a person would write; Follow-ups is left alone because tightening
 * it would have to reckon with already-stored surveys.
 */
// Gmail clips a message past ~102KB, so a body larger than this cannot render intact anyway.
const MAX_BODY_LENGTH = 100_000;
// RFC 5322's maximum line length, and ~13x what a client will actually display.
const MAX_SUBJECT_LENGTH = 998;

export const ZWorkflowSendEmailActionConfig = z.object({
  to: z
    .string()
    .describe(
      "Recipient: either a literal email address, which must belong to someone who can access this workspace, or the element id of a survey question / hidden field holding the respondent's email (contact-info elements resolve index [2]). Enabling or testing a workflow whose literal recipient cannot access the workspace fails, and the runner will not send to one."
    ),
  from: z.email(),
  replyTo: z.array(z.email()),
  subject: z.string().max(MAX_SUBJECT_LENGTH),
  body: z.string().max(MAX_BODY_LENGTH),
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
