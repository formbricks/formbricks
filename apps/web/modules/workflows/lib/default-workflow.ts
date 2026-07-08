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
          // Recipient and body stay empty until a survey is bound — their options (recipient
          // fields, recall tokens) come from the survey, and the empty `to` makes the canvas
          // card render its "configure the recipient" summary instead of template syntax.
          to: "",
          from: "noreply@example.com",
          replyTo: [],
          subject: "Thanks for completing the survey",
          body: "",
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
