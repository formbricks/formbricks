import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { ZWorkflowDefinition } from "../types/document";
import {
  getWorkflowNodeConcreteType,
  joinWorkflowActionTypes,
  summarizeWorkflowDefinition,
  summarizeWorkflowDefinitionOptions,
} from "./definition-summary";

describe("summarizeWorkflowDefinition", () => {
  test("summarizes a full parsed definition by concrete node type", async () => {
    const fixture = await readFile(
      new URL("../types/__fixtures__/workflow-definition.full.json", import.meta.url),
      "utf8"
    );
    const definition = ZWorkflowDefinition.parse(JSON.parse(fixture));

    expect(summarizeWorkflowDefinition(definition)).toEqual({
      triggerType: "response.completed",
      actionTypes: ["if_else", "send_email"],
      actionCount: 4,
      nodeCount: 5,
    });
  });

  test("reports an empty draft as having no trigger and no steps", () => {
    const emptyDraft = ZWorkflowDefinition.parse({
      schemaVersion: 1,
      trigger: null,
      nodes: [],
      edges: [],
      entryNodeId: null,
    });

    expect(summarizeWorkflowDefinition(emptyDraft)).toEqual({
      triggerType: null,
      actionTypes: [],
      actionCount: 0,
      nodeCount: 0,
    });
  });

  // The whole reason this module exists: a node kind that did not exist when it was written must
  // still report itself. Nothing here may enumerate the known triggers or actions.
  test("passes node types it has never seen straight through", () => {
    const summary = summarizeWorkflowDefinition({
      trigger: { type: "trigger", triggerType: "contact.attribute_changed" },
      nodes: [
        { type: "action", actionType: "send_email" },
        { type: "action", actionType: "call_webhook" },
        { type: "delay" },
        { type: "action", actionType: "send_email" },
      ],
    });

    expect(summary).toEqual({
      triggerType: "contact.attribute_changed",
      actionTypes: ["call_webhook", "delay", "send_email"],
      actionCount: 4,
      nodeCount: 5,
    });
  });

  test("tolerates raw JSON that is not a well-formed definition", () => {
    const zero = { triggerType: null, actionTypes: [], actionCount: 0, nodeCount: 0 };

    expect(summarizeWorkflowDefinition(null)).toEqual(zero);
    expect(summarizeWorkflowDefinition(undefined)).toEqual(zero);
    expect(summarizeWorkflowDefinition({})).toEqual(zero);
    expect(summarizeWorkflowDefinition({ trigger: "not-a-node", nodes: "not-an-array" })).toEqual(zero);
    expect(summarizeWorkflowDefinition({ nodes: [null, 42, { type: "" }, { type: "action" }] })).toEqual({
      ...zero,
      actionTypes: ["action"],
      actionCount: 1,
      nodeCount: 1,
    });
  });
});

describe("getWorkflowNodeConcreteType", () => {
  test("prefers the sub-type over the node kind", () => {
    expect(getWorkflowNodeConcreteType({ type: "trigger", triggerType: "response.completed" })).toBe(
      "response.completed"
    );
    expect(getWorkflowNodeConcreteType({ type: "action", actionType: "send_email" })).toBe("send_email");
    expect(getWorkflowNodeConcreteType({ type: "if_else" })).toBe("if_else");
    expect(getWorkflowNodeConcreteType(null)).toBeNull();
  });
});

describe("joinWorkflowActionTypes", () => {
  test("joins sorted types into one stable bucket key", () => {
    expect(joinWorkflowActionTypes(["if_else", "send_email"])).toBe("if_else,send_email");
    expect(joinWorkflowActionTypes([])).toBe("");
  });
});

describe("summarizeWorkflowDefinitionOptions", () => {
  const emailNode = (config: Record<string, unknown>) => ({
    type: "action",
    actionType: "send_email",
    config,
  });

  test("reports ending scope and email options without any recipient, subject or body", async () => {
    const fixture = await readFile(
      new URL("../types/__fixtures__/workflow-definition.full.json", import.meta.url),
      "utf8"
    );
    const options = summarizeWorkflowDefinitionOptions(ZWorkflowDefinition.parse(JSON.parse(fixture)));

    // The fixture mixes an element-id recipient with a literal address across its three emails.
    expect(options).toEqual({
      endingScope: "specific",
      emailRecipientKind: "mixed",
      attachResponseData: true,
      includeVariables: true,
      includeHiddenFields: true,
    });
    expect(JSON.stringify(options)).not.toContain("@example.com");
  });

  test("distinguishes all-endings from specific endings and literal from element recipients", () => {
    expect(
      summarizeWorkflowDefinitionOptions({
        trigger: {
          type: "trigger",
          triggerType: "response.completed",
          config: { surveyId: "s", endingCardIds: [] },
        },
        nodes: [emailNode({ to: "team@example.com", attachResponseData: false })],
      })
    ).toEqual({
      endingScope: "all",
      emailRecipientKind: "literal",
      attachResponseData: false,
      includeVariables: false,
      includeHiddenFields: false,
    });

    expect(
      summarizeWorkflowDefinitionOptions({
        trigger: null,
        nodes: [emailNode({ to: "cm9zr4mps000008l8email", includeVariables: true })],
      }).emailRecipientKind
    ).toBe("element");
  });

  test("yields nulls for a draft without a trigger or email action, and for unknown node types", () => {
    const nulls = {
      endingScope: null,
      emailRecipientKind: null,
      attachResponseData: null,
      includeVariables: null,
      includeHiddenFields: null,
    };
    expect(summarizeWorkflowDefinitionOptions({ trigger: null, nodes: [] })).toEqual(nulls);
    expect(summarizeWorkflowDefinitionOptions(null)).toEqual(nulls);
    expect(
      summarizeWorkflowDefinitionOptions({
        trigger: { type: "trigger", triggerType: "contact.attribute_changed", config: {} },
        nodes: [{ type: "action", actionType: "call_webhook", config: { url: "https://x" } }],
      })
    ).toEqual(nulls);
  });
});
