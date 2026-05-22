import type { TWorkflowDefinition } from "@formbricks/types/workflows";

export const createDefaultWorkflowDefinition = (): TWorkflowDefinition => ({
  schemaVersion: 1,
  entryNodeId: "trigger-response-completed",
  trigger: {
    id: "trigger-response-completed",
    type: "trigger",
    config: {
      type: "response.completed",
    },
    ui: {
      position: { x: 120, y: 80 },
    },
  },
  nodes: [
    {
      id: "if-response-finished",
      type: "ifElse",
      config: {
        condition: {
          id: "group-response-finished",
          connector: "and",
          conditions: [
            {
              id: "condition-response-finished",
              left: {
                type: "ref",
                path: "trigger.response.finished",
              },
              operator: "equals",
              right: true,
            },
          ],
        },
      },
      ui: {
        position: { x: 120, y: 240 },
      },
    },
    {
      id: "send-email-preview",
      type: "action",
      actionType: "sendEmailPreview",
      config: {
        to: "team@example.com",
        replyTo: [],
        subject: "Response completed",
        body: "A response completed this workflow path.",
        includeResponseData: true,
      },
      ui: {
        position: { x: -120, y: 420 },
      },
    },
    {
      id: "send-webhook-preview",
      type: "action",
      actionType: "sendWebhookPreview",
      config: {
        url: "https://example.com/workflow-preview",
        method: "POST",
        headers: {},
      },
      ui: {
        position: { x: 360, y: 420 },
      },
    },
  ],
  edges: [
    {
      id: "edge-trigger-if",
      source: "trigger-response-completed",
      target: "if-response-finished",
      branch: "next",
    },
    {
      id: "edge-if-email",
      source: "if-response-finished",
      target: "send-email-preview",
      branch: "then",
    },
    {
      id: "edge-if-webhook",
      source: "if-response-finished",
      target: "send-webhook-preview",
      branch: "else",
    },
  ],
});
