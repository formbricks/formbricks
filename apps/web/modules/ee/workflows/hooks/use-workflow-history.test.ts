/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { type ReactNode, createElement } from "react";
import { describe, expect, test } from "vitest";
import type { TWorkflowResource } from "@formbricks/workflows";
import {
  hydrateWorkflowEditorAtom,
  setWorkflowDefinitionAtom,
  workflowDefinitionAtom,
} from "@/modules/ee/workflows/state/editor";
import { useWorkflowHistory } from "./use-workflow-history";

const definition = {
  schemaVersion: 1,
  entryNodeId: "trigger-1",
  trigger: { id: "trigger-1", type: "trigger" },
  nodes: [{ id: "email-1", type: "action", actionType: "send_email" }],
  edges: [{ id: "e1", source: "trigger-1", target: "email-1" }],
} as unknown as TWorkflowResource["definition"];

const workflow = {
  id: "wf1",
  name: "Hello",
  description: null,
  status: "draft",
  definition,
} as unknown as TWorkflowResource;

/** Renders the history, then deletes the step, so there is one edit to undo. */
const renderWithOneEdit = (shortcutsEnabled: boolean) => {
  const store = createStore();
  store.set(hydrateWorkflowEditorAtom, { workflow, flowNodes: [], isReadOnly: false });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(Provider, { store }, children);
  renderHook(() => useWorkflowHistory({ shortcutsEnabled }), { wrapper });
  act(() => {
    store.set(setWorkflowDefinitionAtom, { ...definition, nodes: [], edges: [] });
  });
  return store;
};

const pressUndo = () =>
  act(() => {
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true }));
  });

describe("useWorkflowHistory shortcuts", () => {
  test("Cmd+Z undoes the last edit on the Editor tab", () => {
    const store = renderWithOneEdit(true);
    pressUndo();
    expect(store.get(workflowDefinitionAtom)?.nodes).toHaveLength(1);
  });

  test("Cmd+Z leaves the draft alone on the Runs tab, where nothing shows it", () => {
    const store = renderWithOneEdit(false);
    pressUndo();
    expect(store.get(workflowDefinitionAtom)?.nodes).toHaveLength(0);
  });
});
