import { describe, expect, test } from "vitest";
import { findDroppedKeys, parseWorkflowDocument, toDiffView, toWorkflowDocument } from "./document-schema";

const surveyId = "cm9zr4q7i000108l84gozfggr";

const definition = {
  schemaVersion: 1,
  trigger: {
    id: "trigger",
    type: "trigger",
    triggerType: "response.completed",
    config: { surveyId, endingCardIds: [] },
  },
  nodes: [
    {
      id: "send-email",
      type: "action",
      actionType: "send_email",
      config: {
        from: "noreply@example.com",
        to: "support@example.com",
        replyTo: ["support@example.com"],
        subject: "Thanks",
        body: "Thanks for your response.",
        attachResponseData: true,
      },
    },
  ],
  edges: [{ id: "e1", source: "trigger", target: "send-email" }],
  entryNodeId: "trigger",
};

const parse = (document: Record<string, unknown>) => parseWorkflowDocument(document);

describe("parseWorkflowDocument", () => {
  test("accepts a pulled document and resets an omitted description to none", () => {
    const result = parse({ name: "Notify team", definition });

    expect(result).toMatchObject({ ok: true, state: { name: "Notify team", description: null } });
    expect(parse({ name: "Notify team", description: "x", definition })).toMatchObject({
      ok: true,
      state: { description: "x" },
    });
  });

  test("fills the definition's own defaults for what it omits", () => {
    const { schemaVersion: _version, nodes: _nodes, edges: _edges, ...bare } = definition;
    const result = parse({
      name: "Draft",
      definition: { ...bare, trigger: null, entryNodeId: null },
    });

    expect(result).toMatchObject({
      ok: true,
      state: { definition: { schemaVersion: 1, nodes: [], edges: [] } },
    });
  });

  test("refuses a top-level key that is not a field, naming it", () => {
    const result = parse({ name: "x", definition, status: "enabled", runs: [] });

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? [] : result.invalidParams.map((param) => param.name).sort()).toEqual([
      "runs",
      "status",
    ]);
  });

  test("requires a name and a definition", () => {
    const result = parse({});

    expect(result.ok ? [] : result.invalidParams.map((param) => param.name).sort()).toEqual([
      "definition",
      "name",
    ]);
  });

  test("refuses a key the shared definition schema would silently drop, naming its path", () => {
    const withTypo = {
      ...definition,
      trigger: { ...definition.trigger, config: { surveyId, endingCardIds: [], surveyID: "x" } },
      nodes: [{ ...definition.nodes[0], config: { ...definition.nodes[0].config, bcc: "a@example.com" } }],
      edges: [{ ...definition.edges[0], label: "x" }],
      extra: true,
    };

    const result = parse({ name: "x", definition: withTypo });

    expect(result.ok).toBe(false);
    const params = result.ok ? [] : result.invalidParams;
    expect(params.map((param) => param.name).sort()).toEqual([
      "definition.edges.0.label",
      "definition.extra",
      "definition.nodes.0.config.bcc",
      "definition.trigger.config.surveyID",
    ]);
    expect(params.every((param) => param.code === "unsupported_field")).toBe(true);
  });

  test("reports a schema violation inside the definition by path", () => {
    const result = parse({ name: "x", definition: { ...definition, entryNodeId: "nope" } });

    expect(result.ok ? [] : result.invalidParams.map((param) => param.name)).toContain(
      "definition.entryNodeId"
    );
  });
});

describe("findDroppedKeys", () => {
  test("ignores keys the output gained and compares arrays by position", () => {
    expect(findDroppedKeys({ a: 1, list: [{ b: 1 }] }, { a: 1, c: 2, list: [{ b: 1 }] })).toEqual([]);
    expect(findDroppedKeys({ list: [{ b: 1 }, { b: 1, z: 1 }] }, { list: [{ b: 1 }, { b: 1 }] })).toEqual([
      expect.objectContaining({ name: "list.1.z" }),
    ]);
  });
});

describe("toDiffView", () => {
  test("lifts the definition's members and sorts keys, so key order is not a change", () => {
    const stored = { name: "n", description: null, definition: { b: 1, a: { y: 1, x: 2 } } };
    const pushed = { description: null, name: "n", definition: { a: { x: 2, y: 1 }, b: 1 } };

    expect(JSON.stringify(toDiffView(stored))).toBe(JSON.stringify(toDiffView(pushed)));
    expect(Object.keys(toDiffView(stored))).toEqual(["definition.a", "definition.b", "description", "name"]);
  });

  test("a document is name, description and definition and nothing else", () => {
    expect(
      Object.keys(
        toWorkflowDocument({ name: "n", description: null, definition } as Parameters<
          typeof toWorkflowDocument
        >[0])
      )
    ).toEqual(["name", "description", "definition"]);
  });
});
