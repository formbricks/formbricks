import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { ZWorkflowDefinitionInput, ZWorkflowDefinitionInputStrict } from ".";
import { toStrictSchema } from "./strict";

const surveyId = "cm9zr4mps000008l8btfy1vtz";

/**
 * One of every object the definition can hold: a trigger, each step type, an HTTP query parameter and
 * header, a survey link with Embedded Data, Switch cases, and an If/else group nested in a group.
 */
const definition = {
  schemaVersion: 1,
  trigger: {
    id: "trigger",
    type: "trigger",
    triggerType: "response.completed",
    config: { surveyId, endingCardIds: [] },
    ui: { position: { x: 0, y: 0 }, color: "blue" },
  },
  nodes: [
    {
      id: "email",
      type: "action",
      actionType: "send_email",
      config: {
        to: "support@example.com",
        from: "noreply@example.com",
        replyTo: [],
        subject: "Thanks",
        body: "Answer here: #survey-link#",
        attachResponseData: false,
        surveyLink: { surveyId, embeddedData: [{ key: "source", value: "workflow" }] },
      },
    },
    {
      id: "http",
      type: "action",
      actionType: "http_request",
      config: {
        method: "POST",
        url: "https://example.com/hook",
        queryParameters: [{ name: "source", value: "formbricks" }],
        headers: [{ name: "X-Team", value: "support" }],
        body: "{}",
      },
    },
    {
      id: "filter",
      type: "filter",
      config: {
        condition: {
          id: "filter-group",
          connector: "and",
          conditions: [{ id: "has-email", left: { path: "response.email" }, operator: "isSet" }],
        },
      },
    },
    {
      id: "route",
      type: "switch",
      config: {
        left: { path: "response.plan" },
        cases: [
          { id: "free", name: "Free", operator: "equals", right: "free" },
          { id: "paid", name: "Paid", operator: "equals", right: { path: "response.accountPlan" } },
        ],
      },
    },
    {
      id: "check",
      type: "if_else",
      config: {
        condition: {
          id: "root",
          connector: "or",
          conditions: [
            {
              id: "nested",
              connector: "and",
              conditions: [
                {
                  id: "score",
                  left: { path: "response.score", fallback: "0" },
                  operator: "isGreaterThan",
                  right: 8,
                },
              ],
            },
          ],
        },
      },
      ui: { position: { x: 0, y: 400 }, collapsed: true },
    },
  ],
  edges: [
    { id: "e1", source: "trigger", target: "email" },
    { id: "e2", source: "email", target: "http" },
    { id: "e3", source: "http", target: "filter" },
    { id: "e4", source: "filter", target: "route" },
    { id: "e5", source: "route", target: "check", sourceHandle: "free" },
  ],
  entryNodeId: "trigger",
  ui: { direction: "vertical", zoom: 1 },
};

type TJson = Record<string, unknown>;

/** A copy of the definition with `typo: true` added to the object at `path`. */
const withTypoAt = (path: (string | number)[]): TJson => {
  const copy = structuredClone(definition) as TJson;
  const target = path.reduce<unknown>((node, key) => (node as TJson)[key as string], copy) as TJson;
  target.typo = true;
  return copy;
};

// Every structured object in the definition. `ui` itself is not here: it is builder metadata that
// keeps any key (the builder stores `color`, `zoom` and the like there), on the strict variant too.
const OBJECT_PATHS: (string | number)[][] = [
  [],
  ["trigger"],
  ["trigger", "config"],
  ["trigger", "ui", "position"],
  ["nodes", 0],
  ["nodes", 0, "config"],
  ["nodes", 0, "config", "surveyLink"],
  ["nodes", 0, "config", "surveyLink", "embeddedData", 0],
  ["nodes", 1],
  ["nodes", 1, "config"],
  ["nodes", 1, "config", "queryParameters", 0],
  ["nodes", 1, "config", "headers", 0],
  ["nodes", 2],
  ["nodes", 2, "config"],
  ["nodes", 2, "config", "condition"],
  ["nodes", 2, "config", "condition", "conditions", 0],
  ["nodes", 2, "config", "condition", "conditions", 0, "left"],
  ["nodes", 3],
  ["nodes", 3, "config"],
  ["nodes", 3, "config", "left"],
  ["nodes", 3, "config", "cases", 0],
  ["nodes", 3, "config", "cases", 1, "right"],
  ["nodes", 4],
  ["nodes", 4, "config"],
  ["nodes", 4, "config", "condition"],
  ["nodes", 4, "config", "condition", "conditions", 0],
  ["nodes", 4, "config", "condition", "conditions", 0, "conditions", 0],
  ["nodes", 4, "config", "condition", "conditions", 0, "conditions", 0, "left"],
  ["nodes", 4, "ui", "position"],
  ["edges", 0],
];

// The Filter step was strict from the start, on the lenient schema too.
const STRICT_ON_THE_LENIENT_SCHEMA = new Set(["nodes.2", "nodes.2.config"]);

describe("ZWorkflowDefinitionInputStrict (ENG-2437)", () => {
  test("accepts the definition, with the same result as the lenient schema", () => {
    const lenient = ZWorkflowDefinitionInput.safeParse(definition);
    const strict = ZWorkflowDefinitionInputStrict.safeParse(definition);

    expect(lenient.error?.issues ?? []).toEqual([]);
    expect(strict.error?.issues ?? []).toEqual([]);
    expect(strict.data).toEqual(lenient.data);
  });

  test("accepts the full definition fixture, with the same result as the lenient schema", async () => {
    const fixture: unknown = JSON.parse(
      await readFile(new URL("./__fixtures__/workflow-definition.full.json", import.meta.url), "utf8")
    );

    expect(ZWorkflowDefinitionInputStrict.parse(fixture)).toEqual(ZWorkflowDefinitionInput.parse(fixture));
  });

  test.each(OBJECT_PATHS.map((path) => [path.join(".") || "(definition)", path] as const))(
    "rejects an unknown key at %s, in an error that names the key",
    (label, path) => {
      const input = withTypoAt(path);

      const result = ZWorkflowDefinitionInputStrict.safeParse(input);

      expect(result.success).toBe(false);
      expect(z.prettifyError(result.error!)).toContain('Unrecognized key: "typo"');
      // The lenient schema the v3 REST route and the builder use still drops the key, as before.
      expect(ZWorkflowDefinitionInput.safeParse(input).success).toBe(
        !STRICT_ON_THE_LENIENT_SCHEMA.has(label)
      );
    }
  );

  test("keeps builder metadata under ui open", () => {
    // `definition` already carries `ui.zoom` and `trigger.ui.color`; nodes take any `ui` key too.
    const input = withTypoAt(["nodes", 4, "ui"]);

    expect(ZWorkflowDefinitionInputStrict.safeParse(input).success).toBe(true);
  });

  test("still applies the graph and save-time checks", () => {
    const danglingEdge = {
      ...definition,
      edges: [...definition.edges, { id: "e6", source: "check", target: "missing", sourceHandle: "then" }],
    };

    const result = ZWorkflowDefinitionInputStrict.safeParse(danglingEdge);

    expect(result.success).toBe(false);
    expect(z.prettifyError(result.error!)).toContain(
      "Edge target does not reference a workflow node: missing"
    );
  });

  test("keeps the descriptions an MCP client reads", () => {
    const strict = z.toJSONSchema(ZWorkflowDefinitionInputStrict, { io: "input", unrepresentable: "any" });
    const lenient = z.toJSONSchema(ZWorkflowDefinitionInput, { io: "input", unrepresentable: "any" });

    const descriptions = (json: unknown): string[] =>
      JSON.stringify(json).match(/"description":"(?:[^"\\]|\\.)*"/g) ?? [];

    expect(descriptions(strict)).toEqual(descriptions(lenient));
  });
});

describe("toStrictSchema", () => {
  test("refuses a schema kind it can't make strict, instead of leaving it lenient", () => {
    const withTuple = z.object({ pair: z.tuple([z.object({ id: z.string() }), z.string()]) });

    expect(() => toStrictSchema(withTuple)).toThrow('toStrictSchema does not handle Zod "tuple" schemas yet');
  });
});
