import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type {
  TWorkflowHttpRequestActionNode,
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

  test("send-email entry uses label override when present", () => {
    const labelled = { ...sendEmailNode, label: "Custom send" };
    expect(getNodeRegistryEntry(labelled).title(labelled, t)).toBe("Custom send");
  });

  test("send-email entry falls back to the unconfigured summary when `to` is blank", () => {
    const unconfigured = { ...sendEmailNode, config: { ...sendEmailNode.config, to: "" } };
    expect(getNodeRegistryEntry(unconfigured).summary(unconfigured, t)).toBe(
      "workspace.workflows.send_email_unconfigured"
    );
  });

  test("if-else entry exposes flow category + summary key", () => {
    const entry = getNodeRegistryEntry(ifElseNode);
    expect(entry.category).toBe("flow");
    expect(entry.icon).toBe("ifElse");
    expect(entry.title(ifElseNode, t)).toBe("workspace.workflows.if_else");
    expect(entry.summary(ifElseNode, t)).toBe("workspace.workflows.if_else_summary");
    expect(entry.ConfigForm).not.toBeNull();
  });

  test("if-else card shows the step's own name when it has one", () => {
    const named = { ...ifElseNode, label: "Enterprise customer?" };
    expect(getNodeRegistryEntry(named).title(named, t)).toBe("Enterprise customer?");
  });

  test("webhook trigger entry has its own title, icon and panel", () => {
    const webhookTrigger = { id: "t", type: "trigger", triggerType: "webhook", config: {} } as const;
    const entry = getNodeRegistryEntry(webhookTrigger);
    expect(entry.icon).toBe("webhook");
    expect(entry.title(webhookTrigger, t)).toBe("workspace.workflows.webhook_trigger");
    expect(entry.summary(webhookTrigger, t)).toBe("workspace.workflows.webhook_trigger_summary");
    expect(entry.ConfigForm).not.toBeNull();
  });

  test("http-request summary says the method and target, or asks for a URL", () => {
    const httpNode = {
      id: "call",
      type: "action",
      actionType: "http_request",
      config: {
        method: "POST",
        url: "https://dl.acme.example/interactions",
        queryParameters: [],
        headers: [],
        responseMode: "wait",
        continueOnError: false,
      },
    } satisfies TWorkflowHttpRequestActionNode as TWorkflowHttpRequestActionNode;
    const entry = getNodeRegistryEntry(httpNode);
    expect(entry.icon).toBe("http");
    expect(entry.summary(httpNode, t)).toBe("POST dl.acme.example/interactions");
    const blank = { ...httpNode, config: { ...httpNode.config, url: "" } };
    expect(entry.summary(blank, t)).toBe("workspace.workflows.http_request_unconfigured");
  });

  test("send-email summary names a payload recipient the way the picker does", () => {
    const toVariable = {
      ...sendEmailNode,
      config: { ...sendEmailNode.config, to: { type: "variable" as const, ref: "payload.customer.email" } },
    };
    expect(getNodeRegistryEntry(toVariable).summary(toVariable, t)).toContain("@customer.email");
  });

  test("send-email summary with a payload recipient and a survey link passes t() a string, not the recipient object", () => {
    const toVariableWithLink: TWorkflowSendEmailActionNode = {
      ...sendEmailNode,
      config: {
        ...sendEmailNode.config,
        to: { type: "variable", ref: "payload.customer.email" },
        surveyLink: { surveyId: "cmw3rc8lv004kj8okxqfkbyvj", embeddedData: [] },
      },
    };
    expect(getNodeRegistryEntry(toVariableWithLink).summary(toVariableWithLink, t)).toBe(
      'workspace.workflows.send_email_summary_with_link:{"to":"@customer.email"}'
    );
  });

  test("if-else summary says its first condition in words and how many more follow", () => {
    const node = {
      ...ifElseNode,
      config: {
        condition: {
          id: "group-1",
          connector: "and",
          conditions: [
            { id: "c1", left: { path: "payload.channel" }, operator: "equals", right: "call" },
            {
              id: "group-2",
              connector: "or",
              conditions: [
                { id: "c2", left: { path: "payload.resolved" }, operator: "equals", right: false },
                { id: "c3", left: { path: "payload.customer.tier" }, operator: "exists" },
              ],
            },
          ],
        },
      },
    } as TWorkflowIfElseNode;

    expect(getNodeRegistryEntry(node).summary(node, t)).toBe(
      'workspace.workflows.if_else_summary_more:{"condition":"workspace.workflows.if_else_operator_equals:{\\"variable\\":\\"channel\\",\\"value\\":\\"call\\"}","count":2}'
    );
  });

  test("if-else summary for a single presence check has no count and no value", () => {
    const node = {
      ...ifElseNode,
      config: {
        condition: {
          id: "group-1",
          connector: "and",
          conditions: [{ id: "c1", left: { path: "steps.http-1.status" }, operator: "notExists" }],
        },
      },
    } as TWorkflowIfElseNode;

    expect(getNodeRegistryEntry(node).summary(node, t)).toBe(
      'workspace.workflows.if_else_operator_not_exists:{"variable":"steps.http-1.status"}'
    );
  });
});
