import { createStore } from "jotai";
import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition, TWorkflowResource } from "@formbricks/workflows";
import {
  addWorkflowTriggerAtom,
  appendSendEmailAfterNodeAtom,
  canEditWorkflowDefinitionAtom,
  canMutateCanvasAtom,
  closeWorkflowNodeConfigModalAtom,
  deleteWorkflowNodeAtom,
  deriveTriggerEndingProblems,
  deriveWorkflowValidation,
  hasBoundTriggerSurveyAtom,
  hydrateWorkflowEditorAtom,
  insertSendEmailAfterEdgeAtom,
  isCanvasLockedAtom,
  isWorkflowDirtyAtom,
  isWorkflowInspectorCollapsedAtom,
  isWorkflowNodeConfigModalOpenAtom,
  isWorkflowSavingAtom,
  isWorkflowSnapToCanvasEnabledAtom,
  isWorkflowTransitioningAtom,
  markWorkflowDraftSavedAtom,
  openWorkflowNodeConfigModalAtom,
  selectedWorkflowNodeIdAtom,
  setSelectedWorkflowNodeIdAtom,
  setWorkflowAtom,
  setWorkflowDefinitionAtom,
  setWorkflowDescriptionAtom,
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
  workflowValidationProblemsAtom,
  workflowValidityAtom,
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

  test("workflowFlowNodesAtom resolves SetStateAction", () => {
    const store = createStore();
    store.set(workflowFlowNodesAtom, [{ id: "n1" } as never]);
    expect(store.get(workflowFlowNodesAtom)).toHaveLength(1);

    store.set(workflowFlowNodesAtom, (current) => [...current, { id: "n2" } as never]);
    expect(store.get(workflowFlowNodesAtom).map((n) => n.id)).toEqual(["n1", "n2"]);
  });

  test("flow nodes stay mutable after immer-produced writes (ReactFlow mutates measured dimensions)", () => {
    // Regression: flowNodes used to live inside the immer-produced editor state, so immer's
    // auto-freeze made ReactFlow's applyNodeChanges throw "Cannot assign to read only property
    // 'width'" as soon as it measured a node.
    const store = createStore();
    const node = { id: "n1", measured: { width: 100, height: 40 } };
    store.set(hydrateWorkflowEditorAtom, { workflow, flowNodes: [node as never] });
    store.set(setWorkflowNameAtom, "renamed");

    const [storedNode] = store.get(workflowFlowNodesAtom);
    expect(Object.isFrozen(storedNode)).toBe(false);
    expect(() => {
      (storedNode as unknown as { measured: { width: number } }).measured.width = 120;
    }).not.toThrow();
    expect(node.measured.width).toBe(120);
  });
});

describe("inspector + node-config modal", () => {
  test("toggle flips the collapsed flag", () => {
    const store = createStore();
    expect(store.get(isWorkflowInspectorCollapsedAtom)).toBe(false);
    store.set(toggleWorkflowInspectorAtom);
    expect(store.get(isWorkflowInspectorCollapsedAtom)).toBe(true);

    store.set(toggleWorkflowInspectorAtom);
    expect(store.get(isWorkflowInspectorCollapsedAtom)).toBe(false);
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

    // Canvas starts in pointer mode (unlocked), so a draft is mutable right away.
    expect(store.get(isCanvasLockedAtom)).toBe(false);
    expect(store.get(canMutateCanvasAtom)).toBe(true);

    // Switching to pan mode blocks mutations even on an editable status.
    store.set(isCanvasLockedAtom, true);
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

describe("addWorkflowTriggerAtom", () => {
  const emptyDefinition = () =>
    ({
      schemaVersion: 1,
      trigger: null,
      nodes: [],
      edges: [],
      entryNodeId: null,
    }) as unknown as TWorkflowDefinition;

  test("no-ops when there is no definition", () => {
    const store = createStore();
    store.set(addWorkflowTriggerAtom, "response.completed");
    expect(store.get(workflowDefinitionAtom)).toBeNull();
  });

  test("seeds a response.completed trigger, entry point, selection, and opens config", () => {
    const store = createStore();
    store.set(setWorkflowDefinitionAtom, emptyDefinition());
    store.set(addWorkflowTriggerAtom, "response.completed");

    const def = store.get(workflowDefinitionAtom)!;
    expect(def.trigger?.triggerType).toBe("response.completed");
    expect(def.trigger?.config.endingCardIds).toEqual([]);
    expect(def.entryNodeId).toBe(def.trigger?.id);
    expect(store.get(selectedWorkflowNodeIdAtom)).toBe(def.trigger?.id);
    expect(store.get(isWorkflowNodeConfigModalOpenAtom)).toBe(true);
  });

  test("no-ops when a trigger already exists", () => {
    const store = createStore();
    store.set(setWorkflowDefinitionAtom, graphDefinition());
    store.set(addWorkflowTriggerAtom, "response.completed");

    expect(store.get(workflowDefinitionAtom)?.trigger?.id).toBe("trigger-1");
  });
});

describe("hydrateWorkflowEditorAtom with a trigger-less draft", () => {
  test("leaves the selection empty", () => {
    const store = createStore();
    const triggerlessWorkflow = {
      ...workflow,
      definition: { ...definition, trigger: null, entryNodeId: null },
    } as unknown as TWorkflowResource;
    store.set(hydrateWorkflowEditorAtom, { workflow: triggerlessWorkflow, flowNodes: [] });

    expect(store.get(selectedWorkflowNodeIdAtom)).toBeNull();
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

describe("isWorkflowDirtyAtom + markWorkflowDraftSavedAtom", () => {
  test("is clean right after hydrate and dirty after an edit", () => {
    const store = createStore();
    store.set(hydrateWorkflowEditorAtom, { workflow, flowNodes: [] });

    expect(store.get(isWorkflowDirtyAtom)).toBe(false);

    store.set(setWorkflowNameAtom, "Renamed");
    expect(store.get(isWorkflowDirtyAtom)).toBe(true);
  });

  test("trailing whitespace the save flow trims anyway does not count as dirty", () => {
    const store = createStore();
    store.set(hydrateWorkflowEditorAtom, { workflow, flowNodes: [] });

    store.set(setWorkflowNameAtom, "Hello ");
    expect(store.get(isWorkflowDirtyAtom)).toBe(false);
  });

  test("markWorkflowDraftSavedAtom records the sent draft, so mid-flight edits stay dirty", () => {
    const store = createStore();
    store.set(hydrateWorkflowEditorAtom, { workflow, flowNodes: [] });
    store.set(setWorkflowNameAtom, "Renamed");
    // Simulates an edit landing while the PATCH for "Renamed" was in flight.
    store.set(setWorkflowDescriptionAtom, "Edited during save");

    store.set(markWorkflowDraftSavedAtom, {
      workflowName: "Renamed",
      workflowDescription: "Desc",
      definition,
    });

    expect(store.get(isWorkflowDirtyAtom)).toBe(true);

    store.set(markWorkflowDraftSavedAtom, {
      workflowName: "Renamed",
      workflowDescription: "Edited during save",
      definition,
    });
    expect(store.get(isWorkflowDirtyAtom)).toBe(false);
  });

  test("definition edits count as dirty", () => {
    const store = createStore();
    store.set(hydrateWorkflowEditorAtom, { workflow, flowNodes: [] });

    store.set(setWorkflowDefinitionAtom, (current) =>
      current ? { ...current, edges: [...current.edges] } : current
    );
    // Structurally identical definition stays clean (JSON comparison).
    expect(store.get(isWorkflowDirtyAtom)).toBe(false);

    store.set(setWorkflowDefinitionAtom, (current) =>
      current
        ? { ...current, edges: [{ id: "new-edge", source: "trigger-1", target: "trigger-1" }] }
        : current
    );
    expect(store.get(isWorkflowDirtyAtom)).toBe(true);
  });
});

describe("workflowValidityAtom", () => {
  const executableDefinition = {
    schemaVersion: 1,
    trigger: {
      id: "trigger-1",
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId: "cm9zr4mps000008l8btfy1vtz", endingCardIds: [] },
    },
    nodes: [
      {
        id: "email-1",
        type: "action",
        actionType: "send_email",
        config: {
          to: "jane@example.com",
          from: "noreply@example.com",
          replyTo: [],
          subject: "Thanks",
          body: "Thanks for your response.",
          attachResponseData: false,
        },
      },
    ],
    edges: [{ id: "e1", source: "trigger-1", target: "email-1" }],
    entryNodeId: "trigger-1",
  } as unknown as TWorkflowDefinition;

  const executableWorkflow = {
    ...workflow,
    definition: executableDefinition,
  } as unknown as TWorkflowResource;

  test("is ready when the name is set, the definition is executable, and the survey resolves", () => {
    const store = createStore();
    store.set(hydrateWorkflowEditorAtom, { workflow: executableWorkflow, flowNodes: [] });

    expect(store.get(workflowValidityAtom)).toEqual({
      isNameValid: true,
      isDefinitionExecutable: true,
      hasBoundTriggerSurvey: true,
      isReady: true,
    });
  });

  test("an empty name makes the workflow not ready", () => {
    const store = createStore();
    store.set(hydrateWorkflowEditorAtom, { workflow: executableWorkflow, flowNodes: [] });
    store.set(setWorkflowNameAtom, "   ");

    const validity = store.get(workflowValidityAtom);
    expect(validity.isNameValid).toBe(false);
    expect(validity.isReady).toBe(false);
  });

  test("an incomplete send_email node makes the definition not executable", () => {
    const store = createStore();
    store.set(hydrateWorkflowEditorAtom, { workflow: executableWorkflow, flowNodes: [] });
    store.set(setWorkflowDefinitionAtom, (current) =>
      current
        ? {
            ...current,
            nodes: current.nodes.map((node) =>
              node.type === "action" ? { ...node, config: { ...node.config, to: "" } } : node
            ),
          }
        : current
    );

    const validity = store.get(workflowValidityAtom);
    expect(validity.isDefinitionExecutable).toBe(false);
    expect(validity.isReady).toBe(false);
  });

  test("an unresolved trigger survey makes the workflow not ready", () => {
    const store = createStore();
    store.set(hydrateWorkflowEditorAtom, { workflow: executableWorkflow, flowNodes: [] });
    store.set(hasBoundTriggerSurveyAtom, false);

    const validity = store.get(workflowValidityAtom);
    expect(validity.isDefinitionExecutable).toBe(true);
    expect(validity.hasBoundTriggerSurvey).toBe(false);
    expect(validity.isReady).toBe(false);
  });

  test("a trigger-less draft is not executable", () => {
    const store = createStore();
    const triggerless = {
      ...workflow,
      definition: { ...executableDefinition, trigger: null, nodes: [], edges: [], entryNodeId: null },
    } as unknown as TWorkflowResource;
    store.set(hydrateWorkflowEditorAtom, { workflow: triggerless, flowNodes: [] });

    expect(store.get(workflowValidityAtom).isDefinitionExecutable).toBe(false);
  });
});

describe("workflowValidationProblemsAtom", () => {
  const executableEmailNode = () => ({
    id: "email-1",
    type: "action",
    actionType: "send_email",
    config: {
      to: "jane@example.com",
      from: "noreply@example.com",
      replyTo: [],
      subject: "Thanks",
      body: "Thanks for your response.",
      attachResponseData: false,
    },
  });

  const executableDefinition = (overrides: Partial<TWorkflowDefinition> = {}) =>
    ({
      schemaVersion: 1,
      trigger: {
        id: "trigger-1",
        type: "trigger",
        triggerType: "response.completed",
        config: { surveyId: "cm9zr4mps000008l8btfy1vtz", endingCardIds: [] },
      },
      nodes: [executableEmailNode()],
      edges: [{ id: "e1", source: "trigger-1", target: "email-1" }],
      entryNodeId: "trigger-1",
      ...overrides,
    }) as unknown as TWorkflowDefinition;

  const hydrate = (store: ReturnType<typeof createStore>, definition: TWorkflowDefinition) => {
    store.set(hydrateWorkflowEditorAtom, {
      workflow: { ...workflow, definition } as unknown as TWorkflowResource,
      flowNodes: [],
    });
  };

  test("a ready workflow has no problems (empty exactly when workflowValidityAtom is ready)", () => {
    const store = createStore();
    hydrate(store, executableDefinition());

    expect(store.get(workflowValidationProblemsAtom)).toEqual([]);
    expect(store.get(workflowValidityAtom).isReady).toBe(true);
  });

  test("an empty name yields name_missing", () => {
    const store = createStore();
    hydrate(store, executableDefinition());
    store.set(setWorkflowNameAtom, "   ");

    expect(store.get(workflowValidationProblemsAtom)).toEqual([{ code: "name_missing", field: "name" }]);
    expect(store.get(workflowValidityAtom).isReady).toBe(false);
  });

  test("an unresolved trigger survey yields trigger_survey_unbound", () => {
    const store = createStore();
    hydrate(store, executableDefinition());
    store.set(hasBoundTriggerSurveyAtom, false);

    expect(store.get(workflowValidationProblemsAtom)).toEqual([
      { code: "trigger_survey_unbound", field: "trigger.config.surveyId" },
    ]);
  });

  test("a trigger-less draft collapses into exactly one trigger_missing", () => {
    const store = createStore();
    hydrate(store, executableDefinition({ trigger: null, nodes: [], edges: [], entryNodeId: null }));
    // The builder page reports the survey unbound while there is no trigger; trigger_missing
    // already says everything, so no trigger_survey_unbound problem should pile on.
    store.set(hasBoundTriggerSurveyAtom, false);

    expect(store.get(workflowValidationProblemsAtom)).toEqual([
      { code: "trigger_missing", field: "trigger" },
    ]);
    expect(store.get(workflowValidityAtom).isReady).toBe(false);
  });

  test("a trigger without a next step yields trigger_not_connected", () => {
    const store = createStore();
    hydrate(store, executableDefinition({ nodes: [], edges: [] }));

    expect(store.get(workflowValidationProblemsAtom)).toEqual([
      { code: "trigger_not_connected", field: "edges" },
    ]);
  });

  test("empty send_email content collapses into one step_incomplete per step", () => {
    const store = createStore();
    const emptyEmail = executableEmailNode();
    emptyEmail.config = { ...emptyEmail.config, to: "", subject: "", body: "" };
    hydrate(store, executableDefinition({ nodes: [emptyEmail] } as Partial<TWorkflowDefinition>));

    // Three empty fields (to/subject/body) count as one unfinished step, not three errors.
    expect(store.get(workflowValidationProblemsAtom)).toEqual([
      { code: "step_incomplete", field: "nodes.0.config" },
    ]);
  });

  test("a cycle yields flow_invalid", () => {
    const store = createStore();
    const secondEmail = { ...executableEmailNode(), id: "email-2" };
    hydrate(
      store,
      executableDefinition({
        nodes: [executableEmailNode(), secondEmail],
        edges: [
          { id: "e1", source: "trigger-1", target: "email-1" },
          { id: "e2", source: "email-1", target: "email-2" },
          { id: "e3", source: "email-2", target: "email-1" },
        ],
      } as Partial<TWorkflowDefinition>)
    );

    expect(store.get(workflowValidationProblemsAtom)).toEqual([{ code: "flow_invalid", field: "edges" }]);
  });

  test("an if_else step yields step_not_executable plus one flow_invalid for its missing branches", () => {
    const store = createStore();
    const ifElseNode = {
      id: "ifelse-1",
      type: "if_else",
      config: {
        condition: {
          id: "group-1",
          connector: "and",
          conditions: [{ id: "c1", left: { path: "response.email" }, operator: "exists" }],
        },
      },
    };
    hydrate(
      store,
      executableDefinition({
        nodes: [ifElseNode],
        edges: [{ id: "e1", source: "trigger-1", target: "ifelse-1" }],
      } as Partial<TWorkflowDefinition>)
    );

    const problems = store.get(workflowValidationProblemsAtom);
    expect(problems).toHaveLength(2);
    expect(problems).toContainEqual({ code: "step_not_executable", field: "nodes.0.type" });
    expect(problems).toContainEqual({ code: "flow_invalid", field: "edges" });
    expect(store.get(workflowValidityAtom).isReady).toBe(false);
  });

  test("independent problems accumulate, so the count matches what the user must fix", () => {
    const store = createStore();
    hydrate(store, executableDefinition());
    store.set(setWorkflowNameAtom, "");
    store.set(hasBoundTriggerSurveyAtom, false);

    expect(store.get(workflowValidationProblemsAtom).map((problem) => problem.code)).toEqual([
      "name_missing",
      "trigger_survey_unbound",
    ]);
  });
});

describe("deriveWorkflowValidation", () => {
  test("without a definition (editor not hydrated) only the name is checked and isReady stays false", () => {
    const unnamed = deriveWorkflowValidation({
      workflowName: "",
      definition: null,
      hasBoundTriggerSurvey: true,
    });
    expect(unnamed.problems).toEqual([{ code: "name_missing", field: "name" }]);
    expect(unnamed.validity.isReady).toBe(false);

    // An empty problem list is NOT readiness while unhydrated: isReady is structurally
    // "definition present AND nothing to fix", so the two can never disagree once hydrated.
    const named = deriveWorkflowValidation({
      workflowName: "n",
      definition: null,
      hasBoundTriggerSurvey: false,
    });
    expect(named.problems).toEqual([]);
    expect(named.validity).toEqual({
      isNameValid: true,
      isDefinitionExecutable: false,
      hasBoundTriggerSurvey: false,
      isReady: false,
    });
  });
});

describe("deriveTriggerEndingProblems", () => {
  test("no problem while every configured ending still exists (or none are configured)", () => {
    expect(deriveTriggerEndingProblems(["end-1", "end-2"], ["end-1", "end-2", "end-3"])).toEqual([]);
    // Empty endingCardIds = "all endings" mode; nothing to go stale.
    expect(deriveTriggerEndingProblems([], [])).toEqual([]);
  });

  test("stale endings collapse into one trigger_ending_not_found problem", () => {
    expect(deriveTriggerEndingProblems(["end-1", "gone-1", "gone-2"], ["end-1"])).toEqual([
      { code: "trigger_ending_not_found", field: "trigger.config.endingCardIds" },
    ]);
  });
});
