import { z } from "zod";
import { ZWorkflowDataRef, ZWorkflowNodeBase } from "../common";
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

/**
 * A recipient read from a Variable when the step runs (ENG-7169), such as the customer's address in a
 * Webhook payload: `{type: "variable", ref: "payload.customer.email"}`. Whoever controls the Variable
 * chooses who gets the email, so a step with one must have a fixed subject and body (no Variables, no
 * attached response data): the caller picks who gets it, not what it says. The resolved address is
 * not allowlist-checked; it is capped at 50 emails an hour per workflow on top of the organization's
 * caps, and an empty or invalid one fails the step.
 */
export const ZWorkflowVariableEmailRecipient = z
  .object({
    type: z.literal("variable"),
    ref: ZWorkflowDataRef.shape.path.describe(
      "Variable path holding the recipient's address, e.g. payload.customer.email."
    ),
  })
  .describe(
    "Recipient read from a Variable when the step runs. The step's subject and body must then be fixed: no Variables and no attached response data."
  );
export type TWorkflowVariableEmailRecipient = z.infer<typeof ZWorkflowVariableEmailRecipient>;

export const ZWorkflowEmailRecipient = z.union([
  z
    .string()
    .describe(
      "Either a literal email address, which must belong to someone who can access this workspace, or the element id of a survey question / hidden field holding the respondent's email (contact-info elements resolve index [2]). Enabling or testing a workflow whose literal recipient cannot access the workspace fails, and the runner will not send to one."
    ),
  ZWorkflowVariableEmailRecipient,
]);
export type TWorkflowEmailRecipient = z.infer<typeof ZWorkflowEmailRecipient>;

/**
 * Where the survey link goes in a `send_email` body. The editor's "Insert survey link" chip writes it
 * and the runner replaces each one with the link. A step with `surveyLink` must place it at least
 * once; the token without a `surveyLink` is refused on Enable.
 */
export const WORKFLOW_SURVEY_LINK_TOKEN = "#survey-link#";

const MAX_SURVEY_LINK_EMBEDDED_DATA = 30;
const MAX_EMBEDDED_DATA_KEY_LENGTH = 100;
// Spec §10 caps a URL at 2 KB, so no single value needs more.
const MAX_EMBEDDED_DATA_VALUE_LENGTH = 2048;

export const ZWorkflowSurveyLinkEmbeddedData = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(MAX_EMBEDDED_DATA_KEY_LENGTH)
    .describe(
      "Embedded Data key, used as the URL parameter name. The survey must declare it as a passed-in Embedded Data field; undeclared keys are left off the link."
    ),
  value: z
    .string()
    .max(MAX_EMBEDDED_DATA_VALUE_LENGTH)
    .describe(
      "Text that may insert Variables as recall tokens (#recall:payload.agent.id/fallback:#). URL-encoded when the link is built."
    ),
});
export type TWorkflowSurveyLinkEmbeddedData = z.infer<typeof ZWorkflowSurveyLinkEmbeddedData>;

/**
 * The link survey a `send_email` step links to (ENG-7117 D2): `<public domain>/s/<surveyId>?key=value`.
 * Its Embedded Data values may carry Variables, the one place a fixed-body email may, so the answer is
 * tied to the event that started the run.
 */
export const ZWorkflowSurveyLink = z
  .object({
    surveyId: z.cuid2().describe("A link survey in this workflow's workspace."),
    embeddedData: z
      .array(ZWorkflowSurveyLinkEmbeddedData)
      .max(MAX_SURVEY_LINK_EMBEDDED_DATA)
      .describe("Embedded Data put on the link as URL parameters, in order."),
  })
  .superRefine((link, ctx) => {
    // The link survey matches keys case-insensitively, so two spellings would fill one field.
    const seen = new Set<string>();
    for (const [index, { key }] of link.embeddedData.entries()) {
      const folded = key.toLowerCase();
      if (seen.has(folded)) {
        ctx.addIssue({
          code: "custom",
          message: `Embedded Data key ${key} is used twice`,
          path: ["embeddedData", index, "key"],
        });
      }
      seen.add(folded);
    }
  })
  .describe(`Survey link the email carries, placed in the body with ${WORKFLOW_SURVEY_LINK_TOKEN}.`);
export type TWorkflowSurveyLink = z.infer<typeof ZWorkflowSurveyLink>;

export const ZWorkflowSendEmailActionConfig = z
  .object({
    to: ZWorkflowEmailRecipient,
    from: z.email(),
    replyTo: z.array(z.email()),
    subject: z.string().max(MAX_SUBJECT_LENGTH),
    body: z.string().max(MAX_BODY_LENGTH),
    attachResponseData: z.boolean(),
    surveyLink: ZWorkflowSurveyLink.optional(),
    includeEmbeddedData: z
      .boolean()
      .optional()
      .describe(
        "Adds the response's Embedded Data to the attached response data. Replaces includeVariables."
      ),
    includeVariables: z.boolean().optional().meta({
      deprecated: true,
      description:
        "Deprecated: use includeEmbeddedData. Accepted until v7.0.0, never together with includeEmbeddedData.",
    }),
    includeHiddenFields: z.boolean().optional(),
  })
  .superRefine((config, ctx) => {
    // ADR 0050: an old and a new name are never mixed, so it is never unclear which one wins.
    if (config.includeEmbeddedData !== undefined && config.includeVariables !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Use includeEmbeddedData or the deprecated includeVariables, not both",
        path: ["includeVariables"],
      });
    }
  });

/** Whether a step's response data includes Embedded Data, read from either name (ADR 0050). */
export const getIncludeEmbeddedData = (config: TWorkflowSendEmailActionConfig): boolean =>
  config.includeEmbeddedData ?? config.includeVariables ?? false;

export const isVariableEmailRecipient = (
  to: TWorkflowEmailRecipient
): to is TWorkflowVariableEmailRecipient => typeof to === "object";

export type TWorkflowSendEmailActionConfig = z.infer<typeof ZWorkflowSendEmailActionConfig>;

export const ZWorkflowSendEmailActionNode = ZWorkflowNodeBase.extend({
  type: z.literal("action"),
  actionType: z.literal(WORKFLOW_ACTIONS.SEND_EMAIL),
  config: ZWorkflowSendEmailActionConfig,
});

export type TWorkflowSendEmailActionNode = z.infer<typeof ZWorkflowSendEmailActionNode>;
