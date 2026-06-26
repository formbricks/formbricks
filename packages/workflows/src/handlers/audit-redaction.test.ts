import { describe, expect, test } from "vitest";
import { redactWorkflowDefinitionPII } from "./audit-redaction";

const MARKER = /^\[redacted:[0-9a-f]{12}]$/;

const sendEmailNode = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "send-email",
  type: "action" as const,
  actionType: "send_email" as const,
  config: {
    to: "recipient@example.com",
    from: "noreply@example.com",
    replyTo: ["support@example.com"],
    subject: "Thanks for your response",
    body: "Hi {{name}}, thanks!",
    attachResponseData: true,
    includeVariables: false,
    ...overrides,
  },
});

const definition = (nodes: unknown[]): Record<string, unknown> => ({
  schemaVersion: 1,
  trigger: { id: "trigger", type: "trigger", triggerType: "response.completed", config: { surveyId: "s_1" } },
  nodes,
  edges: [],
  entryNodeId: "trigger",
});

const redactConfig = (nodes: unknown[]): Record<string, unknown> =>
  (redactWorkflowDefinitionPII(definition(nodes)) as { nodes: { config: Record<string, unknown> }[] })
    .nodes[0].config;

describe("redactWorkflowDefinitionPII", () => {
  test("masks every send_email PII field with a value-stable marker", () => {
    const config = redactConfig([sendEmailNode()]);

    expect(config.to).toMatch(MARKER);
    expect(config.from).toMatch(MARKER);
    expect(config.subject).toMatch(MARKER);
    expect(config.body).toMatch(MARKER);
    expect(config.replyTo).toEqual([expect.stringMatching(MARKER)]);
  });

  test("leaves non-PII config fields intact so behavioral changes still diff", () => {
    const config = redactConfig([sendEmailNode()]);

    expect(config.attachResponseData).toBe(true);
    expect(config.includeVariables).toBe(false);
  });

  test("does not contain any raw email after redaction (deep scan)", () => {
    const redacted = redactWorkflowDefinitionPII(definition([sendEmailNode()]));
    expect(JSON.stringify(redacted)).not.toContain("@example.com");
  });

  test("same value → same marker (an unchanged recipient produces no spurious diff)", () => {
    const a = redactConfig([sendEmailNode()]);
    const b = redactConfig([sendEmailNode()]);
    expect(a.to).toBe(b.to);
    expect(a.replyTo).toEqual(b.replyTo);
  });

  test("different value → different marker (a changed recipient surfaces as a change)", () => {
    const before = redactConfig([sendEmailNode({ to: "old@example.com" })]);
    const after = redactConfig([sendEmailNode({ to: "new@example.com" })]);
    expect(before.to).not.toBe(after.to);
  });

  test("replyTo marker changes when any array element changes", () => {
    const before = redactConfig([sendEmailNode({ replyTo: ["a@example.com", "b@example.com"] })]);
    const after = redactConfig([sendEmailNode({ replyTo: ["a@example.com", "c@example.com"] })]);
    expect(before.replyTo).not.toEqual(after.replyTo);
  });

  test("does not mutate the input definition", () => {
    const input = definition([sendEmailNode()]);
    redactWorkflowDefinitionPII(input);
    const node = (input.nodes as { config: { to: string } }[])[0];
    expect(node.config.to).toBe("recipient@example.com");
  });

  test("redacts only send_email action nodes, leaving other node types untouched", () => {
    const ifElse = {
      id: "branch",
      type: "if_else",
      config: { condition: { connector: "and", conditions: [] } },
    };
    const redacted = redactWorkflowDefinitionPII(definition([ifElse, sendEmailNode()])) as {
      nodes: Record<string, unknown>[];
    };

    expect(redacted.nodes[0]).toEqual(ifElse);
    expect((redacted.nodes[1] as { config: { to: string } }).config.to).toMatch(MARKER);
  });

  test("tolerates definitions without nodes and non-object inputs", () => {
    expect(redactWorkflowDefinitionPII({ schemaVersion: 1 })).toEqual({ schemaVersion: 1 });
    expect(redactWorkflowDefinitionPII(null)).toBeNull();
    expect(redactWorkflowDefinitionPII("nope")).toBe("nope");
  });
});
