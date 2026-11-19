/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { type ReactNode, createElement } from "react";
import { describe, expect, test, vi } from "vitest";
import type { TWorkflowResource } from "@formbricks/workflows";
import {
  hydrateWorkflowEditorAtom,
  stepDeleteRequestAtom,
  workflowDefinitionAtom,
} from "@/modules/ee/workflows/state/editor";
import { useDeleteStepShortcut } from "./use-delete-step-shortcut";

vi.mock("@/modules/ee/workflows/lib/analytics", () => ({ trackWorkflowEvent: vi.fn() }));

// trigger → email-1 → branch (If/else) → Then: email-2
const definition = {
  schemaVersion: 1,
  entryNodeId: "trigger-1",
  trigger: { id: "trigger-1", type: "trigger" },
  nodes: [
    { id: "email-1", type: "action", actionType: "send_email" },
    { id: "branch", type: "if_else" },
    { id: "email-2", type: "action", actionType: "send_email" },
  ],
  edges: [
    { id: "e1", source: "trigger-1", target: "email-1" },
    { id: "e2", source: "email-1", target: "branch" },
    { id: "e3", source: "branch", target: "email-2", sourceHandle: "then" },
  ],
} as unknown as TWorkflowResource["definition"];

const workflow = {
  id: "wf1",
  name: "Hello",
  description: null,
  status: "draft",
  definition,
} as unknown as TWorkflowResource;

const render = (selectedId: string, { isReadOnly = false } = {}) => {
  const store = createStore();
  store.set(hydrateWorkflowEditorAtom, {
    workflow,
    flowNodes: ["trigger-1", "email-1", "branch", "email-2"].map(
      (id) => ({ id, position: { x: 0, y: 0 }, selected: id === selectedId, data: {} }) as never
    ),
    isReadOnly,
  });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(Provider, { store }, children);
  renderHook(() => useDeleteStepShortcut(), { wrapper });
  return store;
};

const press = (key: string, target: EventTarget = document.body) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

const stepIds = (store: ReturnType<typeof createStore>) =>
  store.get(workflowDefinitionAtom)?.nodes.map((node) => node.id);

describe("useDeleteStepShortcut", () => {
  test("Backspace deletes the highlighted step from the workflow and joins its neighbours", () => {
    const store = render("email-1");
    press("Backspace");
    expect(stepIds(store)).toEqual(["branch", "email-2"]);
    expect(store.get(workflowDefinitionAtom)?.edges).toContainEqual(
      expect.objectContaining({ source: "trigger-1", target: "branch" })
    );
  });

  test("Delete does the same", () => {
    const store = render("email-2");
    press("Delete");
    expect(stepIds(store)).toEqual(["email-1", "branch"]);
  });

  test("an If/else asks its card to confirm first and deletes nothing yet", () => {
    const store = render("branch");
    press("Backspace");
    expect(stepIds(store)).toEqual(["email-1", "branch", "email-2"]);
    expect(store.get(stepDeleteRequestAtom)).toBe("branch");
  });

  test("leaves the trigger, a field being typed in, and a read-only workflow alone", () => {
    const trigger = render("trigger-1");
    press("Backspace");
    expect(stepIds(trigger)).toHaveLength(3);

    const typing = render("email-1");
    const input = document.body.appendChild(document.createElement("input"));
    press("Backspace", input);
    expect(stepIds(typing)).toHaveLength(3);
    input.remove();

    const readOnly = render("email-1", { isReadOnly: true });
    press("Backspace");
    expect(stepIds(readOnly)).toHaveLength(3);
  });
});
