/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { type ReactNode, createElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TWorkflowResource } from "@formbricks/workflows";
import {
  closeWorkflowNodeConfigModalAtom,
  hydrateWorkflowEditorAtom,
  isWorkflowNodeConfigModalOpenAtom,
  openWorkflowNodeConfigModalAtom,
  selectedWorkflowNodeIdAtom,
  workflowFlowNodesAtom,
} from "@/modules/workflows/state/editor";
import { useWorkflowNodeUrlSync } from "./use-workflow-node-url-sync";

let mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

const definition = {
  schemaVersion: 1,
  entryNodeId: "trigger-1",
  trigger: { id: "trigger-1", type: "trigger" },
  nodes: [{ id: "email-1", type: "action", actionType: "send_email" }],
  edges: [],
} as unknown as TWorkflowResource["definition"];

const workflow = {
  id: "wf1",
  name: "Hello",
  description: null,
  status: "draft",
  definition,
} as unknown as TWorkflowResource;

const flowNode = (id: string) => ({ id, position: { x: 0, y: 0 }, data: {} }) as never;

const renderSync = (isEnabled = true) => {
  const store = createStore();
  store.set(hydrateWorkflowEditorAtom, {
    workflow,
    flowNodes: [flowNode("trigger-1"), flowNode("email-1")],
  });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(Provider, { store }, children);
  return { store, ...renderHook(() => useWorkflowNodeUrlSync({ isEnabled }), { wrapper }) };
};

beforeEach(() => {
  mockSearchParams = new URLSearchParams();
  window.history.replaceState(null, "", "/workspaces/ws1/workflows/wf1");
});

describe("useWorkflowNodeUrlSync", () => {
  test("opens the node config for a valid ?node= on mount and marks the canvas node selected", async () => {
    mockSearchParams = new URLSearchParams("node=email-1");
    window.history.replaceState(null, "", "/workspaces/ws1/workflows/wf1?node=email-1");

    const { store } = renderSync();

    await waitFor(() => expect(store.get(isWorkflowNodeConfigModalOpenAtom)).toBe(true));
    expect(store.get(selectedWorkflowNodeIdAtom)).toBe("email-1");
    expect(store.get(workflowFlowNodesAtom).map((node) => [node.id, node.selected])).toEqual([
      ["trigger-1", false],
      ["email-1", true],
    ]);
    // The param survives the initial sync round-trip.
    expect(new URL(window.location.href).searchParams.get("node")).toBe("email-1");
  });

  test("ignores an unknown ?node= id and removes it from the URL", async () => {
    mockSearchParams = new URLSearchParams("node=deleted-node");
    window.history.replaceState(null, "", "/workspaces/ws1/workflows/wf1?node=deleted-node");

    const { store } = renderSync();

    await waitFor(() => expect(new URL(window.location.href).searchParams.get("node")).toBeNull());
    expect(store.get(isWorkflowNodeConfigModalOpenAtom)).toBe(false);
    // The default selection from hydrate is untouched.
    expect(store.get(selectedWorkflowNodeIdAtom)).toBe("trigger-1");
  });

  test("mirrors opening and closing a node into the URL without touching other params", async () => {
    window.history.replaceState(null, "", "/workspaces/ws1/workflows/wf1?new=1");

    const { store } = renderSync();

    act(() => {
      store.set(openWorkflowNodeConfigModalAtom, "email-1");
    });
    await waitFor(() => expect(new URL(window.location.href).searchParams.get("node")).toBe("email-1"));
    expect(new URL(window.location.href).searchParams.get("new")).toBe("1");

    // Closing the config view (e.g. via the canvas Settings cog) clears the param.
    act(() => {
      store.set(closeWorkflowNodeConfigModalAtom);
    });
    await waitFor(() => expect(new URL(window.location.href).searchParams.get("node")).toBeNull());
    expect(new URL(window.location.href).searchParams.get("new")).toBe("1");
  });

  test("does nothing while disabled", () => {
    mockSearchParams = new URLSearchParams("node=email-1");
    window.history.replaceState(null, "", "/workspaces/ws1/workflows/wf1?node=email-1");

    const { store } = renderSync(false);

    expect(store.get(isWorkflowNodeConfigModalOpenAtom)).toBe(false);
    expect(new URL(window.location.href).searchParams.get("node")).toBe("email-1");
  });
});
