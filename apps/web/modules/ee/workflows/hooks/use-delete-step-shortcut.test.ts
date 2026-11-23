/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { type ReactNode, createElement } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TWorkflowResource } from "@formbricks/workflows";
import { showUndoToast } from "@/modules/ee/workflows/components/canvas/undo-toast";
import {
  hydrateWorkflowEditorAtom,
  stepDeleteRequestAtom,
  workflowDefinitionAtom,
} from "@/modules/ee/workflows/state/editor";
import { useDeleteStepShortcut } from "./use-delete-step-shortcut";

vi.mock("@/modules/ee/workflows/lib/analytics", () => ({ trackWorkflowEvent: vi.fn() }));
vi.mock("@/modules/ee/workflows/components/canvas/undo-toast", () => ({ showUndoToast: vi.fn() }));

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

// The canvas, and a card on it; and the step panel beside it.
const setUpPage = () => {
  const canvas = document.body.appendChild(document.createElement("div"));
  const card = canvas.appendChild(document.createElement("div"));
  card.tabIndex = 0;
  const panel = document.body.appendChild(document.createElement("div"));
  return { canvas, card, panel };
};

const pointerDown = (target: EventTarget) =>
  target.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));

/** Renders the shortcut with `selectedId` highlighted, after a click on a card (the canvas has focus). */
const render = (selectedId: string, { isReadOnly = false } = {}) => {
  const store = createStore();
  store.set(hydrateWorkflowEditorAtom, {
    workflow,
    flowNodes: ["trigger-1", "email-1", "branch", "email-2"].map(
      (id) => ({ id, position: { x: 0, y: 0 }, selected: id === selectedId, data: {} }) as never
    ),
    isReadOnly,
  });
  const page = setUpPage();
  const wrapper = ({ children }: { children: ReactNode }) => createElement(Provider, { store }, children);
  renderHook(() => useDeleteStepShortcut({ current: page.canvas }), { wrapper });
  pointerDown(page.card);
  return { store, ...page };
};

const press = (key: string, target: EventTarget = document.body) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

afterEach(() => {
  document.body.innerHTML = "";
  vi.mocked(showUndoToast).mockClear();
});

const stepIds = (store: ReturnType<typeof createStore>) =>
  store.get(workflowDefinitionAtom)?.nodes.map((node) => node.id);

describe("useDeleteStepShortcut", () => {
  test("Backspace deletes the highlighted step from the workflow and joins its neighbours", () => {
    const { store } = render("email-1");
    press("Backspace");
    expect(stepIds(store)).toEqual(["branch", "email-2"]);
    expect(store.get(workflowDefinitionAtom)?.edges).toContainEqual(
      expect.objectContaining({ source: "trigger-1", target: "branch" })
    );
  });

  test("Delete does the same", () => {
    const { store } = render("email-2");
    press("Delete");
    expect(stepIds(store)).toEqual(["email-1", "branch"]);
  });

  test("an If/else asks its card to confirm first and deletes nothing yet", () => {
    const { store } = render("branch");
    press("Backspace");
    expect(stepIds(store)).toEqual(["email-1", "branch", "email-2"]);
    expect(store.get(stepDeleteRequestAtom)).toBe("branch");
  });

  test("leaves the trigger, a field being typed in, and a read-only workflow alone", () => {
    const { store: trigger } = render("trigger-1");
    press("Backspace");
    expect(stepIds(trigger)).toHaveLength(3);

    const { store: typing } = render("email-1");
    const input = document.body.appendChild(document.createElement("input"));
    press("Backspace", input);
    expect(stepIds(typing)).toHaveLength(3);
    input.remove();

    const { store: readOnly } = render("email-1", { isReadOnly: true });
    press("Backspace");
    expect(stepIds(readOnly)).toHaveLength(3);
  });

  test("says what it deleted, with an Undo back to the workflow as it was", () => {
    const { store } = render("email-1");
    const before = store.get(workflowDefinitionAtom);
    press("Backspace");
    expect(showUndoToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "workspace.workflows.step_deleted", previous: before })
    );
  });

  test("does nothing after a click outside the canvas, such as in the step panel", () => {
    const { store, panel } = render("email-1");
    pointerDown(panel);
    press("Backspace");
    expect(stepIds(store)).toHaveLength(3);
    expect(showUndoToast).not.toHaveBeenCalled();
  });

  test("leaves a panel control alone when it is tabbed to from the canvas", () => {
    const { store, panel } = render("email-1");
    const methodSelect = panel.appendChild(document.createElement("button"));
    methodSelect.focus();
    press("Backspace", methodSelect);
    expect(stepIds(store)).toHaveLength(3);
    expect(showUndoToast).not.toHaveBeenCalled();
  });

  test("works again once a card on the canvas is clicked or tabbed to", () => {
    const { store, panel, card } = render("email-1");
    pointerDown(panel);
    card.focus();
    press("Backspace");
    expect(stepIds(store)).toEqual(["branch", "email-2"]);
  });
});
