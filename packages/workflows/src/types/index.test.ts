import { describe, expect, test } from "vitest";
import {
  type TWorkflowDefinitionBase,
  ZResponseCompletedTriggerConfig,
  ZWorkflowDefinition,
  ZWorkflowExecutableDefinition,
  ZWorkflowSendEmailActionConfig,
  ZWorkflowStatus,
} from ".";

const surveyId = "cm9zr4mps000008l8btfy1vtz";
const endingCardId = "cm9zr4q7i000108l84gozfggr";

const sendEmailConfig = {
  from: "noreply@example.com",
  to: "jane@example.com",
  replyTo: ["support@example.com"],
  subject: "Thanks for your response",
  body: "We received your response.",
  attachResponseData: true,
  includeVariables: false,
  includeHiddenFields: false,
};

const createDefinition = (): TWorkflowDefinitionBase => ({
  schemaVersion: 1 as const,
  trigger: {
    id: "trigger",
    type: "trigger" as const,
    triggerType: "response.completed" as const,
    config: {
      surveyId,
      endingCardIds: [endingCardId],
    },
  },
  nodes: [
    {
      id: "send-email",
      type: "action" as const,
      actionType: "send_email" as const,
      label: "Send thank you email",
      ui: {
        position: { x: 100, y: 100 },
        collapsed: false,
      },
      config: sendEmailConfig,
    },
  ],
  edges: [{ id: "trigger-send-email", source: "trigger", target: "send-email" }],
  entryNodeId: "trigger",
});

describe("@formbricks/workflows", () => {
  test("parses a valid Scope 1 executable definition", () => {
    expect(ZWorkflowExecutableDefinition.parse(createDefinition()).nodes[0]?.type).toBe("action");
  });

  test("rejects invalid graph references", () => {
    const definition = createDefinition();
    definition.edges[0] = { id: "broken-edge", source: "trigger", target: "missing-node" };

    expect(() => ZWorkflowDefinition.parse(definition)).toThrow(/Edge target/);
  });

  test("allows if_else in generic definitions but rejects it for executable definitions", () => {
    const definition = {
      ...createDefinition(),
      nodes: [
        ...createDefinition().nodes,
        {
          id: "condition",
          type: "if_else" as const,
          config: {
            conditions: [
              {
                left: { path: "response.email" },
                operator: "exists" as const,
              },
            ],
            combinator: "and" as const,
          },
        },
      ],
      edges: [
        ...createDefinition().edges,
        { id: "send-email-condition", source: "send-email", target: "condition" },
      ],
    };

    expect(() => ZWorkflowDefinition.parse(definition)).not.toThrow();
    expect(() => ZWorkflowExecutableDefinition.parse(definition)).toThrow(/if_else nodes/);
  });

  test("rejects sendWebhookPreview actions", () => {
    const definition = {
      ...createDefinition(),
      nodes: [
        {
          id: "webhook",
          type: "action",
          actionType: "sendWebhookPreview",
          config: { url: "https://example.com" },
        },
      ],
    };

    expect(() => ZWorkflowDefinition.parse(definition)).toThrow();
  });

  test("uses the Survey Follow-up sendEmail fields", () => {
    const parsed = ZWorkflowSendEmailActionConfig.parse(sendEmailConfig);

    expect(Object.keys(parsed).sort()).toEqual([
      "attachResponseData",
      "body",
      "from",
      "includeHiddenFields",
      "includeVariables",
      "replyTo",
      "subject",
      "to",
    ]);
  });

  test("supports empty and specific response completed ending card ids", () => {
    expect(
      ZResponseCompletedTriggerConfig.parse({
        surveyId,
      }).endingCardIds
    ).toEqual([]);

    expect(
      ZResponseCompletedTriggerConfig.parse({
        surveyId,
        endingCardIds: [endingCardId],
      }).endingCardIds
    ).toEqual([endingCardId]);
  });

  test("includes archived workflow status", () => {
    expect(ZWorkflowStatus.parse("archived")).toBe("archived");
  });
});
