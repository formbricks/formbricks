import { describe, expect, test, vi } from "vitest";
import { createDefaultWorkflowDefinition } from "./default-workflow";
import { executeWorkflowDefinition } from "./executor";

const triggerPayload = {
  event: "response.completed",
  workspaceId: "cm8cmpnjj000108jfdr9dfqe8",
  surveyId: "cm8cmpnjj000108jfdr9dfqe7",
  response: {
    id: "cm8cmpnjj000108jfdr9dfqe6",
    finished: true,
    data: {
      score: 10,
    },
  },
};

describe("executeWorkflowDefinition", () => {
  test("selects the then path and records an email preview without sending", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = executeWorkflowDefinition(createDefaultWorkflowDefinition(), triggerPayload);

    expect(result.status).toBe("completed");
    expect(result.steps.map((step) => step.nodeId)).toEqual([
      "trigger-response-completed",
      "if-response-finished",
      "send-email-preview",
    ]);
    expect(result.finalOutput).toEqual(
      expect.objectContaining({
        actionType: "sendEmailPreview",
        preview: true,
        sent: false,
      })
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test("selects the else path and wraps the previous output in the webhook preview envelope", () => {
    const result = executeWorkflowDefinition(createDefaultWorkflowDefinition(), {
      ...triggerPayload,
      response: {
        ...triggerPayload.response,
        finished: false,
      },
    });

    expect(result.status).toBe("completed");
    expect(result.steps.map((step) => step.nodeId)).toEqual([
      "trigger-response-completed",
      "if-response-finished",
      "send-webhook-preview",
    ]);
    expect(result.finalOutput).toEqual({
      actionType: "sendWebhookPreview",
      body: {
        response: {
          branch: "else",
          matched: false,
        },
      },
      headers: {},
      method: "POST",
      preview: true,
      sent: false,
      url: "https://example.com/workflow-preview",
    });
  });

  test("fails invalid workflow definitions before execution", () => {
    const result = executeWorkflowDefinition({ schemaVersion: 1 }, triggerPayload);

    expect(result.status).toBe("failed");
    expect(result.steps).toEqual([]);
    expect(result.error).toBeDefined();
  });
});
