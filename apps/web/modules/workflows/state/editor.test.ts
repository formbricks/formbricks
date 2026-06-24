import { createStore } from "jotai";
import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition, TWorkflowResource } from "@formbricks/workflows";
import {
  appendSendEmailAfterNodeAtom,
  canEditWorkflowDefinitionAtom,
  canMutateCanvasAtom,
  closeWorkflowNodeConfigModalAtom,
  deleteWorkflowNodeAtom,
  hydrateWorkflowEditorAtom,
  insertSendEmailAfterEdgeAtom,
  isCanvasLockedAtom,
  isWorkflowInspectorCollapsedAtom,
  isWorkflowNodeConfigModalOpenAtom,
  isWorkflowSavingAtom,
  isWorkflowSnapToCanvasEnabledAtom,
  isWorkflowTransitioningAtom,
  openWorkflowNodeConfigModalAtom,
  selectedWorkflowNodeIdAtom,
  setSelectedWorkflowNodeIdAtom,
  setWorkflowAtom,
  setWorkflowDefinitionAtom,
  setWorkflowDescriptionAtom,
  setWorkflowFlowNodesAtom,
  setWorkflowNameAtom,
  setWorkflowSavingAtom,
  setWorkflowSnapToCanvasEnabledAtom,
  setWorkflowTransitioningAtom,
  toggleWorkflowInspectorAtom,
  workflowAtom,
  workflowDefinitionAtom,
  workflowDescriptionAtom,
  workflowFlowNodesAtom,
  workflowNameAtom,
} from "./editor";

const definition = {
  schemaVersion: 1,
  entryNodeId: "trigger-1",
  trigger: { id: "trigger-1", type: "trigger" },
  nodes: [],
  edges: [],
} as unknown as TWorkflowDefinition;

const workflow = {
  id: "wf1",
  name: "Hello",
  description: "Desc",
  status: "draft",
  definition,
} as unknown as TWorkflowResource;

describe("hydrateWorkflowEditorAtom", () => {
  test("seeds name, description, definition, selection from the workflow", () => {
    const store = createStore();
    store.set(hydrateWorkflowEditorAtom, { workflow, flowNodes: [] });

    expect(store.get(workflowAtom)).toBe(workflow);
    expect(store.get(workflowNameAtom)).toBe("Hello");
    expect(store.get(workflowDescriptionAtom)).toBe("Desc");
    expect(store.get(workflowDefinitionAtom)).toBe(definition);
    expect(store.get(selectedWorkflowNodeIdAtom)).toBe("trigger-1");
  });

  test("description falls back to empty string when null", () => {
    const store = createStore();
    store.set(hydrateWorkflowEditorAtom, {
      workflow: { ...workflow, description: null } as unknown as TWorkflowResource,
      flowNodes: [],
    });

    expect(store.get(workflowDescriptionAtom)).toBe("");
  });
});

describe("simple setters", () => {
  test("name / description / saving / transitioning / snap update their slice", () => {
    const store = createStore();
    store.set(setWorkflowNameAtom, "n");
    store.set(setWorkflowDescriptionAtom, "d");
    store.set(setWorkflowSavingAtom, true);
    store.set(setWorkflowTransitioningAtom, true);
    store.set(setWorkflowSnapToCanvasEnabledAtom, false);
    store.set(setSelectedWorkflowNodeIdAtom, "node-x");

    expect(store.get(workflowNameAtom)).toBe("n");
    expect(store.get(workflowDescriptionAtom)).toBe("d");
    expect(store.get(isWorkflowSavingAtom)).toBe(true);
    expect(store.get(isWorkflowTransitioningAtom)).toBe(true);
    expect(store.get(isWorkflowSnapToCanvasEnabledAtom)).toBe(false);
    expect(store.get(selectedWorkflowNodeIdAtom)).toBe("node-x");
  });
});

describe("definition + flow node updaters accept value or callback", () => {
  test("setWorkflowDefinitionAtom resolves SetStateAction", () => {
    const store = createStore();
    store.set(setWorkflowDefinitionAtom, definition);
    expect(store.get(workflowDefinitionAtom)).toBe(definition);

    store.set(setWorkflowDefinitionAtom, (current) => ({ ...current!, entryNodeId: "z" }));
    expect(store.get(workflowDefinitionAtom)?.entryNodeId).toBe("z");
  });

  test("setWorkflowFlowNodesAtom resolves SetStateAction", () => {
    const store = createStore();
    store.set(setWorkflowFlowNodesAtom, [{ id: "n1" } as never]);
    expect(store.get(workflowFlowNodesAtom)).toHaveLength(1);

    store.set(setWorkflowFlowNodesAtom, (current) => [...current, { id: "n2" } as never]);
    expect(store.get(workflowFlowNodesAtom).map((n) => n.id)).toEqual(["n1", "n2"]);
  });
});

describe("inspector + node-config modal", () => {
  test("toggle flips the collapsed flag", () => {
    const store = createStore();
    expect(store.get(isWorkflowInspectorCollapsedAtom)).toBe(false);
    store.set(toggleWorkflowInspectorAtom);
    expect(store.get(isWorkflowInspectorCollapsedAtom)).toBe(true);
  });

  test("open sets the selected node + flag, close just lowers the flag", () => {
    const store = createStore();
    store.set(openWorkflowNodeConfigModalAtom, "node-1");
    expect(store.get(isWorkflowNodeConfigModalOpenAtom)).toBe(true);
    expect(store.get(selectedWorkflowNodeIdAtom)).toBe("node-1");

    store.set(closeWorkflowNodeConfigModalAtom);
    expect(store.get(isWorkflowNodeConfigModalOpenAtom)).toBe(false);
    expect(store.get(selectedWorkflowNodeIdAtom)).toBe("node-1");
  });
});

describe("setWorkflowAtom", () => {
  test("replaces the workflow snapshot without overwriting in-flight edits", () => {
    const store = createStore();
    store.set(setWorkflowNameAtom, "draft name");
    store.set(setWorkflowAtom, workflow);

    expect(store.get(workflowAtom)).toBe(workflow);
    expect(store.get(workflowNameAtom)).toBe("draft name");
  });
});

const workflowWithStatus = (status: string) => ({ ...workflow, status }) as unknown as TWorkflowResource;

describe("canEditWorkflowDefinitionAtom", () => {
  test.each([
    ["draft", true],
    ["disabled", true],
    ["enabled", false],
    ["archived", false],
  ])("status %s -> %s", (status, expected) => {
    const store = createStore();
    store.set(hydrateWorkflowEditorAtom, { workflow: workflowWithStatus(status), flowNodes: [] });
    expect(store.get(canEditWorkflowDefinitionAtom)).toBe(expected);
  });

  test("is false when there is no workflow", () => {
    const store = createStore();
    expect(store.get(canEditWorkflowDefinitionAtom)).toBe(false);
  });
});

describe("canMutateCanvasAtom", () => {
  test("requires an editable status AND an unlocked canvas", () => {
    const store = createStore();
    store.set(hydrateWorkflowEditorAtom, { workflow: workflowWithStatus("draft"), flowNodes: [] });

    // Canvas starts locked.
    expect(store.get(isCanvasLockedAtom)).toBe(true);
    expect(store.get(canMutateCanvasAtom)).toBe(false);

    store.set(isCanvasLockedAtom, false);
    expect(store.get(canMutateCanvasAtom)).toBe(true);

    // Editable status removed -> blocked again even while unlocked.
    store.set(hydrateWorkflowEditorAtom, { workflow: workflowWithStatus("enabled"), flowNodes: [] });
    store.set(isCanvasLockedAtom, false);
    expect(store.get(canMutateCanvasAtom)).toBe(false);
  });
});

describe("openWorkflowNodeConfigModalAtom", () => {
  test("expands a collapsed inspector when a node is opened", () => {
    const store = createStore();
    store.set(toggleWorkflowInspectorAtom); // collapse
    expect(store.get(isWorkflowInspectorCollapsedAtom)).toBe(true);

    store.set(openWorkflowNodeConfigModalAtom, "node-9");
    expect(store.get(isWorkflowInspectorCollapsedAtom)).toBe(false);
    expect(store.get(selectedWorkflowNodeIdAtom)).toBe("node-9");
    expect(store.get(isWorkflowNodeConfigModalOpenAtom)).toBe(true);
  });
});

const graphDefinition = () =>
  ({
    schemaVersion: 1,
    entryNodeId: "trigger-1",
    trigger: { id: "trigger-1", type: "trigger", ui: { position: { x: 0, y: 0 } } },
    nodes: [
      { id: "n1", type: "action", ui: { position: { x: 100, y: 100 } } },
      { id: "n2", type: "action", ui: { position: { x: 200, y: 300 } } },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "n1", sourceHandle: "true" },
      { id: "e2", source: "n1", target: "n2" },
    ],
  }) as unknown as TWorkflowDefinition;

describe("deleteWorkflowNodeAtom", () => {
  test("no-ops when there is no definition", () => {
    const store = createStore();
    store.set(deleteWorkflowNodeAtom, "n1");
    expect(store.get(workflowDefinitionAtom)).toBeNull();
  });

  test("refuses to delete the trigger", () => {
    const store = createStore();
    store.set(setWorkflowDefinitionAtom, graphDefinition());
    store.set(deleteWorkflowNodeAtom, "trigger-1");
    expect(store.get(workflowDefinitionAtom)?.nodes).toHaveLength(2);
  });

  test("bridges incoming to outgoing edges and preserves sourceHandle", () => {
    const store = createStore();
    store.set(setWorkflowDefinitionAtom, graphDefinition());
    store.set(setSelectedWorkflowNodeIdAtom, "n1");
    store.set(openWorkflowNodeConfigModalAtom, "n1");

    store.set(deleteWorkflowNodeAtom, "n1");

    const def = store.get(workflowDefinitionAtom)!;
    expect(def.nodes.map((n) => n.id)).toEqual(["n2"]);
    // e1 + e2 dropped; a bridge trigger-1 -> n2 added, carrying e1's sourceHandle.
    const bridge = def.edges.find((e) => e.source === "trigger-1" && e.target === "n2");
    expect(bridge).toBeDefined();
    expect(bridge?.sourceHandle).toBe("true");
    expect(def.edges).toHaveLength(1);
    // Selection falls back to the trigger and the config modal closes.
    expect(store.get(selectedWorkflowNodeIdAtom)).toBe("trigger-1");
    expect(store.get(isWorkflowNodeConfigModalOpenAtom)).toBe(false);
  });
});

describe("appendSendEmailAfterNodeAtom", () => {
  test("no-ops when there is no definition", () => {
    const store = createStore();
    store.set(appendSendEmailAfterNodeAtom, "trigger-1");
    expect(store.get(workflowDefinitionAtom)).toBeNull();
  });

  test("appends a send_email node below the trigger and selects it", () => {
    const store = createStore();
    store.set(setWorkflowDefinitionAtom, graphDefinition());
    store.set(appendSendEmailAfterNodeAtom, "trigger-1");

    const def = store.get(workflowDefinitionAtom)!;
    expect(def.nodes).toHaveLength(3);
    const added = def.nodes[def.nodes.length - 1];
    expect(added.ui?.position).toEqual({ x: 0, y: 120 });
    expect(def.edges.some((e) => e.source === "trigger-1" && e.target === added.id)).toBe(true);
    expect(store.get(selectedWorkflowNodeIdAtom)).toBe(added.id);
    expect(store.get(isWorkflowNodeConfigModalOpenAtom)).toBe(true);
  });

  test("falls back to a default position when the source node is unknown", () => {
    const store = createStore();
    store.set(setWorkflowDefinitionAtom, graphDefinition());
    store.set(appendSendEmailAfterNodeAtom, "missing");

    const def = store.get(workflowDefinitionAtom)!;
    const added = def.nodes[def.nodes.length - 1];
    expect(added.ui?.position).toEqual({ x: 220, y: 200 });
  });
});

describe("insertSendEmailAfterEdgeAtom", () => {
  test("no-ops when there is no definition", () => {
    const store = createStore();
    store.set(insertSendEmailAfterEdgeAtom, "e1");
    expect(store.get(workflowDefinitionAtom)).toBeNull();
  });

  test("no-ops when the edge id is unknown", () => {
    const store = createStore();
    store.set(setWorkflowDefinitionAtom, graphDefinition());
    store.set(insertSendEmailAfterEdgeAtom, "missing-edge");
    expect(store.get(workflowDefinitionAtom)?.edges).toHaveLength(2);
  });

  test("splits the edge at the midpoint, preserving sourceHandle", () => {
    const store = createStore();
    store.set(setWorkflowDefinitionAtom, graphDefinition());
    store.set(insertSendEmailAfterEdgeAtom, "e1");

    const def = store.get(workflowDefinitionAtom)!;
    expect(def.nodes).toHaveLength(3);
    const added = def.nodes[def.nodes.length - 1];
    // midpoint of trigger (0,0) and n1 (100,100)
    expect(added.ui?.position).toEqual({ x: 50, y: 50 });
    // e1 replaced by two edges; the first carries the original sourceHandle.
    expect(def.edges.some((e) => e.id === "e1")).toBe(false);
    const intoNew = def.edges.find((e) => e.source === "trigger-1" && e.target === added.id);
    expect(intoNew?.sourceHandle).toBe("true");
    expect(def.edges.some((e) => e.source === added.id && e.target === "n1")).toBe(true);
    expect(store.get(selectedWorkflowNodeIdAtom)).toBe(added.id);
    expect(store.get(isWorkflowNodeConfigModalOpenAtom)).toBe(true);
  });

  test("splits an edge with no sourceHandle (omits the handle on the first segment)", () => {
    const store = createStore();
    store.set(setWorkflowDefinitionAtom, graphDefinition());
    store.set(insertSendEmailAfterEdgeAtom, "e2"); // n1 -> n2, no sourceHandle

    const def = store.get(workflowDefinitionAtom)!;
    const added = def.nodes[def.nodes.length - 1];
    const intoNew = def.edges.find((e) => e.source === "n1" && e.target === added.id);
    expect(intoNew).toBeDefined();
    expect(intoNew?.sourceHandle).toBeUndefined();
  });

  test("falls back to a default midpoint when an endpoint lacks a position", () => {
    const store = createStore();
    const def = graphDefinition();
    // Drop n2's position so positionOf(target) returns undefined.
    (def.nodes[1] as { ui?: unknown }).ui = undefined;
    store.set(setWorkflowDefinitionAtom, def);
    store.set(insertSendEmailAfterEdgeAtom, "e2");

    const next = store.get(workflowDefinitionAtom)!;
    const added = next.nodes[next.nodes.length - 1];
    expect(added.ui?.position).toEqual({ x: 220, y: 200 });
  });
});

describe("deleteWorkflowNodeAtom bridge without sourceHandle", () => {
  test("omits the handle when the incoming edge has none", () => {
    const store = createStore();
    const def = graphDefinition();
    // trigger-1 -> n1 (handle "true"), n1 -> n2 (no handle), add n2 -> n3.
    def.nodes.push({ id: "n3", type: "action", ui: { position: { x: 300, y: 400 } } } as never);
    def.edges.push({ id: "e3", source: "n2", target: "n3" } as never);
    store.set(setWorkflowDefinitionAtom, def);

    store.set(deleteWorkflowNodeAtom, "n2");

    const next = store.get(workflowDefinitionAtom)!;
    // incoming e2 (no handle) bridges to outgoing e3 -> n1 -> n3 without a sourceHandle.
    const bridge = next.edges.find((e) => e.source === "n1" && e.target === "n3");
    expect(bridge).toBeDefined();
    expect(bridge?.sourceHandle).toBeUndefined();
  });
});
