import { createId } from "@paralleldrive/cuid2";
import type { TWorkflowDefinition } from "@formbricks/workflows";

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
