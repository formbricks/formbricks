import { describe, expect, test } from "vitest";
import { ZWorkflowDefinition, ZWorkflowExecutableDefinition } from "../document";
import { ZWorkflowRunData, ZWorkflowTriggerRunPayload } from "../runs";

const workspaceId = "cm9zr4mps000008l8btfy1vtz";

const webhookDefinition = {
  trigger: { id: "trigger", type: "trigger", triggerType: "webhook" },
  nodes: [
    {
      id: "send-email",
      type: "action",
      actionType: "send_email",
      config: {
        from: "noreply@example.com",
        to: "jane@example.com",
        replyTo: [],
        subject: "Order received",
        body: "Thanks",
        attachResponseData: false,
      },
    },
  ],
  edges: [{ id: "e1", source: "trigger", target: "send-email" }],
  entryNodeId: "trigger",
};

describe("webhook trigger", () => {
  test("a definition may start with a Webhook trigger that carries no configuration", () => {
    const parsed = ZWorkflowDefinition.parse(webhookDefinition);

    expect(parsed.trigger).toEqual({ id: "trigger", type: "trigger", triggerType: "webhook", config: {} });
  });

  test("a Webhook trigger refuses configuration it does not define, so the token can never be stored there", () => {
    const result = ZWorkflowDefinition.safeParse({
      ...webhookDefinition,
      trigger: { ...webhookDefinition.trigger, config: { token: "abc" } },
    });

    expect(result.success).toBe(false);
  });

  test("a Webhook workflow with a send_email step is executable", () => {
    expect(ZWorkflowExecutableDefinition.safeParse(webhookDefinition).success).toBe(true);
  });

  test("a run started by a webhook call stores the payload under its own trigger type", () => {
    const payload = {
      type: "webhook",
      workspaceId,
      payload: { order: { id: 42 } },
      triggeredAt: "2026-11-13T10:00:00.000Z",
    };

    expect(ZWorkflowTriggerRunPayload.parse(payload)).toEqual(payload);
    expect(ZWorkflowRunData.parse({ trigger: payload, steps: [] }).trigger).toEqual(payload);
  });

  test("a webhook run payload must be a JSON object", () => {
    const result = ZWorkflowTriggerRunPayload.safeParse({
      type: "webhook",
      workspaceId,
      payload: [1, 2],
      triggeredAt: "2026-11-13T10:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });
});
