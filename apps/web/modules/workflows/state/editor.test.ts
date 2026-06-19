import { createStore } from "jotai";
import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition, TWorkflowResource } from "@formbricks/workflows";
import {
  closeWorkflowNodeConfigModalAtom,
  hydrateWorkflowEditorAtom,
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
