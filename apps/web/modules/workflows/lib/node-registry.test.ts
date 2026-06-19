import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type {
  TWorkflowIfElseNode,
  TWorkflowResponseCompletedTriggerNode,
  TWorkflowSendEmailActionNode,
} from "@formbricks/workflows";
import { getNodeRegistryEntry, getNodeRegistryKind } from "./node-registry";

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as unknown as TFunction;

const triggerNode: TWorkflowResponseCompletedTriggerNode = {
  id: "trigger-1",
  type: "trigger",
  triggerType: "response.completed",
  config: { surveyId: "u9aohwvk1n3e0gms8p2q6lwt", endingCardIds: [] },
};

const triggerNodeWithEndings: TWorkflowResponseCompletedTriggerNode = {
  ...triggerNode,
  config: { surveyId: "u9aohwvk1n3e0gms8p2q6lwt", endingCardIds: ["ending-1", "ending-2"] },
};

const sendEmailNode: TWorkflowSendEmailActionNode = {
  id: "action-1",
  type: "action",
  actionType: "send_email",
  config: {
    to: "respondent@example.com",
    from: "team@example.com",
    replyTo: [],
    subject: "Subject",
    body: "Body",
    attachResponseData: false,
  },
};

const ifElseNode: TWorkflowIfElseNode = {
  id: "if-1",
  type: "if_else",
  config: { condition: { connector: "and", conditions: [] } },
} as unknown as TWorkflowIfElseNode;

describe("getNodeRegistryKind", () => {
  test.each([
    [triggerNode, "trigger:response.completed"],
    [sendEmailNode, "action:send_email"],
    [ifElseNode, "if_else"],
  ] as const)("maps node to its kind", (node, expectedKind) => {
    expect(getNodeRegistryKind(node)).toBe(expectedKind);
  });
});

describe("getNodeRegistryEntry", () => {
  test("trigger entry exposes title and summary", () => {
    const entry = getNodeRegistryEntry(triggerNode);
    expect(entry.category).toBe("trigger");
    expect(entry.icon).toBe("trigger");
    expect(entry.title(triggerNode, t)).toBe("workspace.workflows.response_completed");
    expect(entry.summary(triggerNode, t)).toBe("workspace.workflows.trigger_summary_all_endings");
  });

  test("trigger summary includes ending-card count when configured", () => {
    const entry = getNodeRegistryEntry(triggerNodeWithEndings);
    expect(entry.summary(triggerNodeWithEndings, t)).toContain('"count":2');
  });

  test("send-email entry includes recipient in summary", () => {
    const entry = getNodeRegistryEntry(sendEmailNode);
    expect(entry.category).toBe("action");
    expect(entry.icon).toBe("email");
    expect(entry.title(sendEmailNode, t)).toBe("workspace.workflows.send_email");
    expect(entry.summary(sendEmailNode, t)).toContain("respondent@example.com");
  });
});
