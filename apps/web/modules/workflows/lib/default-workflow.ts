import { createId } from "@paralleldrive/cuid2";
import type { TWorkflowDefinition } from "@formbricks/workflows";

/**
 * A Scope-1-valid `ZWorkflowDefinition` used to seed a brand-new draft workflow.
 *
 * The shape mirrors what the editor (ENG-1225) will let the user refine: a single
 * `response.completed` trigger wired by one edge to a single `send_email` action. It is the
 * minimal graph that both `ZWorkflowDefinition` and the create POST handler accept (the handler
 * only parses the *persistable* definition, not the executable one — survey/email verification
 * happens later, at enable time). Consequently the trigger `surveyId` is a generated placeholder
 * cuid2 and the email fields are well-formed placeholders; the editor swaps in real values before
 * the workflow can be enabled.
 *
 * `surveyId` is generated per call so two drafts created in the same session never collide on the
 * placeholder reference.
 */
export const createDefaultWorkflowDefinition = (): TWorkflowDefinition => {
  const triggerId = "trigger-response-completed";
  const sendEmailId = "action-send-email";

  return {
    schemaVersion: 1,
    entryNodeId: triggerId,
    trigger: {
      id: triggerId,
      type: "trigger",
      triggerType: "response.completed",
      config: {
        surveyId: createId(),
        endingCardIds: [],
      },
      ui: { position: { x: 0, y: 0 } },
    },
    nodes: [
      {
        id: sendEmailId,
        type: "action",
        actionType: "send_email",
        config: {
          to: "{{ response.email }}",
          from: "noreply@example.com",
          replyTo: [],
          subject: "Thanks for completing the survey",
          body: "Thanks for completing the survey. We will be in touch soon.",
          attachResponseData: false,
        },
        ui: { position: { x: 0, y: 160 } },
      },
    ],
    edges: [
      {
        id: "edge-trigger-send-email",
        source: triggerId,
        target: sendEmailId,
      },
    ],
  };
};
