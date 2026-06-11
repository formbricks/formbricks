import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import {
  type TWorkflowDefinitionBase,
  ZResponseCompletedTriggerConfig,
  ZWorkflowCondition,
  ZWorkflowDefinition,
  ZWorkflowExecutableDefinition,
  ZWorkflowRunData,
  ZWorkflowRunLog,
  ZWorkflowSendEmailActionConfig,
  ZWorkflowStatus,
  ZWorkflowTriggerPayload,
  ZWorkflowVersion,
} from ".";

const surveyId = "cm9zr4mps000008l8btfy1vtz";
const endingCardId = "cm9zr4q7i000108l84gozfggr";

const loadJsonFixture = async (fixtureName: string): Promise<unknown> => {
  const fixture = await readFile(new URL(`./__fixtures__/${fixtureName}`, import.meta.url), "utf8");
  const parsedFixture: unknown = JSON.parse(fixture);

  return parsedFixture;
};

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
  test("validates the full workflow definition fixture", async () => {
    const fixture = await loadJsonFixture("workflow-definition.full.json");

    expect(ZWorkflowDefinition.parse(fixture).nodes.some((node) => node.type === "if_else")).toBe(true);
  });

  test("validates the full executable workflow definition fixture", async () => {
    const fixture = await loadJsonFixture("workflow-executable-definition.full.json");

    expect(ZWorkflowExecutableDefinition.parse(fixture).nodes).toHaveLength(1);
  });

  test("validates the full workflow version fixture", async () => {
    const fixture = await loadJsonFixture("workflow-version.full.json");

    expect(ZWorkflowVersion.parse(fixture).version).toBe(1);
  });

  test("validates the full workflow run data fixture", async () => {
    const fixture = await loadJsonFixture("workflow-run-data.full.json");

    expect(ZWorkflowRunData.parse(fixture).steps).toHaveLength(1);
  });

  test("validates the full workflow run log fixture", async () => {
    const fixture = await loadJsonFixture("workflow-run-log.full.json");

    expect(ZWorkflowRunLog.parse(fixture).status).toBe("failed");
  });

  test("validates the full workflow trigger payload fixture", async () => {
    const fixture = await loadJsonFixture("workflow-trigger-payload.full.json");

    expect(ZWorkflowTriggerPayload.parse(fixture).type).toBe("response.completed");
  });

  test("rejects response completed trigger payloads without tenant and response context", () => {
    expect(() =>
      ZWorkflowTriggerPayload.parse({
        type: "response.completed",
        surveyId,
        responseId: "cm9zr4rsp000708l8bqccpfrx",
      })
    ).toThrow(/workspaceId/);
  });

  test("rejects run trigger snapshots without the response completed payload context", () => {
    expect(() =>
      ZWorkflowRunData.parse({
        trigger: {
          type: "response.completed",
          triggeredAt: "2026-06-09T12:01:00.000Z",
        },
      })
    ).toThrow(/workspaceId/);
  });

  test("parses a valid executable definition", () => {
    expect(ZWorkflowExecutableDefinition.parse(createDefinition()).nodes[0]?.type).toBe("action");
  });

  test("rejects invalid graph references", () => {
    const definition = createDefinition();
    definition.edges[0] = { id: "broken-edge", source: "trigger", target: "missing-node" };

    expect(() => ZWorkflowDefinition.parse(definition)).toThrow(/Edge target/);
  });

  test("allows persisting a trigger-only draft definition", () => {
    const definition = { ...createDefinition(), nodes: [], edges: [] };

    expect(ZWorkflowDefinition.parse(definition).nodes).toHaveLength(0);
  });

  test("rejects definitions with multiple outgoing trigger edges", () => {
    const definition = createDefinition();
    definition.edges.push({ id: "trigger-send-email-2", source: "trigger", target: "send-email" });

    expect(() => ZWorkflowDefinition.parse(definition)).toThrow(/at most one outgoing trigger edge/);
  });

  test("rejects executable definitions without an outgoing trigger edge", () => {
    const definition = { ...createDefinition(), nodes: [], edges: [] };

    expect(() => ZWorkflowExecutableDefinition.parse(definition)).toThrow(
      /exactly one outgoing trigger edge/
    );
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
            condition: {
              id: "condition-group",
              connector: "and" as const,
              conditions: [
                {
                  id: "email-exists",
                  left: { path: "response.email" },
                  operator: "exists" as const,
                },
                {
                  id: "nested-group",
                  connector: "or" as const,
                  conditions: [
                    {
                      id: "score-high",
                      left: { path: "response.score" },
                      operator: "greaterThan" as const,
                      right: 8,
                    },
                    {
                      id: "plan-match",
                      left: { path: "response.plan" },
                      operator: "equals" as const,
                      right: { path: "contact.plan" },
                    },
                  ],
                },
              ],
            },
          },
        },
        {
          id: "then-email",
          type: "action" as const,
          actionType: "send_email" as const,
          config: sendEmailConfig,
        },
        {
          id: "else-email",
          type: "action" as const,
          actionType: "send_email" as const,
          config: sendEmailConfig,
        },
      ],
      edges: [
        ...createDefinition().edges,
        { id: "send-email-condition", source: "send-email", target: "condition" },
        { id: "condition-then", source: "condition", target: "then-email", sourceHandle: "then" },
        { id: "condition-else", source: "condition", target: "else-email", sourceHandle: "else" },
      ],
    };

    expect(() => ZWorkflowDefinition.parse(definition)).not.toThrow();
    expect(() => ZWorkflowExecutableDefinition.parse(definition)).toThrow(/if_else nodes/);
  });

  test("rejects executable definitions with unreachable nodes", () => {
    const definition = createDefinition();
    definition.nodes.push({
      id: "orphan-email",
      type: "action",
      actionType: "send_email",
      config: sendEmailConfig,
    });

    expect(() => ZWorkflowExecutableDefinition.parse(definition)).toThrow(/unreachable node ids/);
  });

  test("rejects executable definitions with cycles", () => {
    const definition = createDefinition();
    definition.nodes.push({
      id: "second-email",
      type: "action",
      actionType: "send_email",
      config: sendEmailConfig,
    });
    definition.edges = [
      { id: "trigger-send-email", source: "trigger", target: "send-email" },
      { id: "send-email-second-email", source: "send-email", target: "second-email" },
      { id: "second-email-send-email", source: "second-email", target: "send-email" },
    ];

    expect(() => ZWorkflowExecutableDefinition.parse(definition)).toThrow(/acyclic/);
  });

  test("rejects if_else branch edges without then and else source handles", () => {
    const definition = {
      ...createDefinition(),
      nodes: [
        ...createDefinition().nodes,
        {
          id: "condition",
          type: "if_else" as const,
          config: {
            condition: {
              id: "condition-group",
              connector: "and" as const,
              conditions: [
                {
                  id: "email-exists",
                  left: { path: "response.email" },
                  operator: "exists" as const,
                },
              ],
            },
          },
        },
        {
          id: "then-email",
          type: "action" as const,
          actionType: "send_email" as const,
          config: sendEmailConfig,
        },
      ],
      edges: [
        ...createDefinition().edges,
        { id: "send-email-condition", source: "send-email", target: "condition" },
        { id: "condition-then", source: "condition", target: "then-email" },
      ],
    };

    expect(() => ZWorkflowDefinition.parse(definition)).toThrow(/then or else sourceHandle/);
  });

  test("rejects then and else source handles on non-branch nodes", () => {
    const definition = {
      ...createDefinition(),
      edges: [
        {
          id: "trigger-send-email",
          source: "trigger",
          target: "send-email",
          sourceHandle: "then",
        },
      ],
    };

    expect(() => ZWorkflowDefinition.parse(definition)).toThrow(/Only if_else nodes/);
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

  test("validates condition right-hand values based on operator semantics", () => {
    expect(() =>
      ZWorkflowCondition.parse({
        id: "email-exists",
        left: { path: "response.email" },
        operator: "exists",
      })
    ).not.toThrow();

    expect(() =>
      ZWorkflowCondition.parse({
        id: "email-exists",
        left: { path: "response.email" },
        operator: "exists",
        right: "",
      })
    ).toThrow(/must not have/);

    expect(() =>
      ZWorkflowCondition.parse({
        id: "email-equals",
        left: { path: "response.email" },
        operator: "equals",
      })
    ).toThrow(/requires/);
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
