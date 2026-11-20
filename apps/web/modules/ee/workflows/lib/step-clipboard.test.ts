import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import {
  type TStepClipboard,
  canPasteAt,
  captureStepCopy,
  findStepsReadingUnreachableSteps,
  getStepAndAfter,
  pasteSteps,
} from "./step-clipboard";

type TNode = TWorkflowDefinition["nodes"][number];

const at = (y: number, x = 0) => ({ ui: { position: { x, y } } });

const email = (id: string, y: number, body = "Hi"): TNode =>
  ({
    id,
    type: "action",
    actionType: "send_email",
    config: { to: "team@example.com", from: "noreply@example.com", replyTo: [], subject: "S", body },
    ...at(y),
  }) as unknown as TNode;

const http = (id: string, y: number): TNode =>
  ({
    id,
    type: "action",
    actionType: "http_request",
    label: "Log the visit",
    config: {
      method: "POST",
      url: "https://api.example.com/visits",
      queryParameters: [],
      headers: [
        { name: "Authorization", secret: true, secretId: "sec_1" },
        { name: "X-Source", value: "formbricks" },
      ],
      body: null,
      responseMode: "wait",
      continueOnError: false,
    },
    ...at(y),
  }) as unknown as TNode;

const ifElse = (id: string, y: number): TNode =>
  ({
    id,
    type: "if_else",
    config: {
      condition: {
        id: `${id}-g`,
        connector: "and",
        conditions: [{ id: `${id}-c`, left: { path: "payload.plan" }, operator: "equals", right: "pro" }],
      },
    },
    ...at(y),
  }) as unknown as TNode;

// trigger → crm → branch (If/else): Then → a1 → a2; Else → b1.
const definition = (): TWorkflowDefinition =>
  ({
    schemaVersion: 1,
    entryNodeId: "trigger",
    trigger: { id: "trigger", type: "trigger", triggerType: "webhook", config: {}, ...at(0) },
    nodes: [
      http("crm", 100),
      ifElse("branch", 200),
      email("a1", 300, "Status #recall:steps.crm.status/fallback:#"),
      email("a2", 400),
      email("b1", 300),
    ],
    edges: [
      { id: "e1", source: "trigger", target: "crm" },
      { id: "e2", source: "crm", target: "branch" },
      { id: "e3", source: "branch", target: "a1", sourceHandle: "then" },
      { id: "e4", source: "a1", target: "a2" },
      { id: "e5", source: "branch", target: "b1", sourceHandle: "else" },
    ],
  }) as unknown as TWorkflowDefinition;

const cutOf = (def: TWorkflowDefinition, rootId: string): TStepClipboard => ({
  mode: "cut",
  workflowId: "wf",
  rootId,
  stepIds: getStepAndAfter(def, rootId),
});

const copyOf = (def: TWorkflowDefinition, rootId: string): TStepClipboard => ({
  mode: "copy",
  workflowId: "wf",
  rootId,
  ...captureStepCopy(def, rootId),
});

const copyLabel = (node: TNode) => `${node.label ?? node.id} (copy)`;
const paste = (
  def: TWorkflowDefinition,
  clipboard: TStepClipboard,
  target: Parameters<typeof canPasteAt>[2]
) => pasteSteps({ definition: def, clipboard, target, direction: "vertical", copyLabel });

const edgeBetween = (def: TWorkflowDefinition, source: string, target: string) =>
  def.edges.find((edge) => edge.source === source && edge.target === target);

describe("getStepAndAfter", () => {
  test("is the step and every step after it on its path, an If/else's branches included", () => {
    expect(getStepAndAfter(definition(), "a1")).toEqual(["a1", "a2"]);
    expect(getStepAndAfter(definition(), "branch").sort()).toEqual(["a1", "a2", "b1", "branch"]);
  });
});

describe("cut and paste", () => {
  test("moves the same steps to another branch; where they were becomes an end", () => {
    const def = definition();
    const result = paste(def, cutOf(def, "a1"), { sourceNodeId: "b1" })!;

    expect(result.definition.nodes.map((node) => node.id).sort()).toEqual(
      def.nodes.map((node) => node.id).sort()
    );
    expect(result.definition.edges.some((edge) => edge.source === "branch" && edge.target === "a1")).toBe(
      false
    );
    expect(edgeBetween(result.definition, "b1", "a1")).toBeDefined();
    expect(edgeBetween(result.definition, "a1", "a2")).toBeDefined();
    expect(result.rootId).toBe("a1");
    expect(result.stepCount).toBe(2);
  });

  test("keeps stored secret values: the moved step is the same step", () => {
    const def = definition();
    const result = paste(def, cutOf(def, "crm"), { edgeId: "e5" });
    // The CRM step can't go into its own path.
    expect(result).toBeNull();
    const moved = paste(def, cutOf(def, "a1"), { edgeId: "e2" })!;
    const crm = moved.definition.nodes.find((node) => node.id === "crm")!;
    expect(crm.type === "action" && crm.actionType === "http_request" && crm.config.headers[0]).toMatchObject(
      {
        secret: true,
        secretId: "sec_1",
      }
    );
  });

  test("can't go inside the piece being moved, nor where it already is", () => {
    const def = definition();
    const clipboard = cutOf(def, "branch");
    expect(canPasteAt(def, clipboard, { sourceNodeId: "a1" })).toBe(false);
    expect(canPasteAt(def, clipboard, { sourceNodeId: "branch", branch: "else" })).toBe(false);
    expect(canPasteAt(def, clipboard, { edgeId: "e4" })).toBe(false);
    expect(canPasteAt(def, clipboard, { edgeId: "e2" })).toBe(false);
    expect(canPasteAt(def, clipboard, { edgeId: "e1" })).toBe(true);
  });

  test("on a line, the step that followed carries on from the end of the pasted steps", () => {
    const def = definition();
    const result = paste(def, cutOf(def, "a1"), { edgeId: "e1" })!;

    expect(edgeBetween(result.definition, "trigger", "a1")).toBeDefined();
    expect(edgeBetween(result.definition, "a2", "crm")).toBeDefined();
    expect(edgeBetween(result.definition, "trigger", "crm")).toBeUndefined();
    const y = (id: string) => result.definition.nodes.find((node) => node.id === id)?.ui?.position?.y ?? 0;
    // a1 takes the CRM step's place, a2 keeps its distance, and the CRM step follows after a2.
    expect(y("a1")).toBe(100);
    expect(y("a2")).toBe(200);
    expect(y("crm")).toBeGreaterThan(y("a2"));
    expect(y("branch")).toBeGreaterThan(y("crm"));
  });

  test("a forking piece pasted on a line carries on through its first branch", () => {
    const def = definition();
    const moving = paste(def, cutOf(def, "branch"), { edgeId: "e1" })!;
    // branch's Then path ends at a2: the CRM step now follows a2.
    expect(edgeBetween(moving.definition, "a2", "crm")).toBeDefined();
    expect(edgeBetween(moving.definition, "trigger", "branch")).toBeDefined();
  });
});

describe("copy and paste", () => {
  test("adds fresh steps with new ids and leaves the originals as they were", () => {
    const def = definition();
    const result = paste(def, copyOf(def, "a1"), { sourceNodeId: "b1" })!;

    expect(result.definition.nodes).toHaveLength(def.nodes.length + 2);
    expect(result.rootId).not.toBe("a1");
    expect(edgeBetween(result.definition, "branch", "a1")).toBeDefined();
    const copy = result.definition.nodes.find((node) => node.id === result.rootId)!;
    expect(copy.label).toBe("a1 (copy)");
    expect(edgeBetween(result.definition, "b1", result.rootId)).toBeDefined();
  });

  test("drops secret header values, as duplicating a workflow does", () => {
    const def = definition();
    const result = paste(def, copyOf(def, "crm"), { sourceNodeId: "b1" })!;
    const copy = result.definition.nodes.find((node) => node.id === result.rootId)!;
    if (copy.type !== "action" || copy.actionType !== "http_request") throw new Error("not an HTTP request");
    expect(copy.config.headers).toEqual([
      { name: "Authorization", secret: true },
      { name: "X-Source", value: "formbricks" },
    ]);
    expect(copy.label).toBe("Log the visit (copy)");
  });

  test("a Variable reading a copied step reads its copy", () => {
    const def = definition();
    // crm → branch → a1 reads steps.crm: copy everything from crm and paste it after b1.
    const result = paste(def, copyOf(def, "crm"), { sourceNodeId: "b1" })!;
    const crmCopy = result.rootId;
    const bodies = result.definition.nodes
      .filter((node) => node.id !== "a1")
      .map((node) => JSON.stringify(node.config))
      .filter((config) => config.includes("steps."));
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toContain(`steps.${crmCopy}.status`);
  });

  test("the copy stays on the clipboard for another paste", () => {
    const def = definition();
    const clipboard = copyOf(def, "a2");
    const once = paste(def, clipboard, { sourceNodeId: "b1" })!;
    const twice = paste(once.definition, clipboard, { sourceNodeId: "b1" })!;
    expect(twice.definition.nodes).toHaveLength(def.nodes.length + 2);
  });
});

describe("findStepsReadingUnreachableSteps", () => {
  test("finds a step that reads a step which no longer runs before it", () => {
    const def = definition();
    expect(findStepsReadingUnreachableSteps(def)).toEqual([]);
    // Move a1 (reads steps.crm) before the CRM step.
    const moved = paste(def, cutOf(def, "a1"), { edgeId: "e1" })!;
    expect(findStepsReadingUnreachableSteps(moved.definition)).toEqual(["a1"]);
  });
});
