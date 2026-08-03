/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { type ReactNode, createElement } from "react";
import { describe, expect, test, vi } from "vitest";
import {
  requestWorkflowNodeFieldFocusAtom,
  workflowNodeFieldFocusRequestAtom,
} from "@/modules/ee/workflows/state/editor";
import { useWorkflowNodeFieldFocus } from "./use-workflow-node-field-focus";

const renderWithStore = (
  store: ReturnType<typeof createStore>,
  args: Parameters<typeof useWorkflowNodeFieldFocus>[0]
) =>
  renderHook(() => useWorkflowNodeFieldFocus(args), {
    wrapper: ({ children }: { children: ReactNode }) => createElement(Provider, { store }, children),
  });

/** A focusable stand-in for the control a jump targets. */
const appendInput = (id: string) => {
  const input = document.createElement("input");
  input.id = id;
  input.scrollIntoView = vi.fn();
  document.body.appendChild(input);
  return input;
};

describe("useWorkflowNodeFieldFocus", () => {
  test("focuses the requested field, scrolls it into view, and clears the request", async () => {
    const store = createStore();
    const input = appendInput("subject");
    const onRequest = vi.fn();

    renderWithStore(store, { nodeId: "email-1", resolveElement: () => input, onRequest });
    store.set(requestWorkflowNodeFieldFocusAtom, { nodeId: "email-1", field: "subject" });

    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(input.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(onRequest).toHaveBeenCalledWith("subject");
    // Cleared only after focusing — otherwise the re-render would cancel the pending frame.
    await waitFor(() => expect(store.get(workflowNodeFieldFocusRequestAtom)).toBeNull());
  });

  test("ignores a request aimed at a different node", async () => {
    const store = createStore();
    const input = appendInput("other");
    const resolveElement = vi.fn(() => input);

    renderWithStore(store, { nodeId: "email-1", resolveElement });
    store.set(requestWorkflowNodeFieldFocusAtom, { nodeId: "trigger-1", field: "surveyId" });

    await waitFor(() => expect(store.get(workflowNodeFieldFocusRequestAtom)).not.toBeNull());
    expect(resolveElement).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(input);
  });

  test("still clears the request when the field resolves to no element", async () => {
    const store = createStore();
    renderWithStore(store, { nodeId: "email-1", resolveElement: () => null });

    store.set(requestWorkflowNodeFieldFocusAtom, { nodeId: "email-1", field: "gone" });

    // A field whose control isn't mounted must not leave the request pending forever.
    await waitFor(() => expect(store.get(workflowNodeFieldFocusRequestAtom)).toBeNull());
  });

  test("uses the latest resolver without re-firing on unrelated re-renders", async () => {
    const store = createStore();
    const first = appendInput("first");
    const second = appendInput("second");
    let target = first;

    const { rerender } = renderHook(
      () => useWorkflowNodeFieldFocus({ nodeId: "email-1", resolveElement: () => target }),
      {
        wrapper: ({ children }: { children: ReactNode }) => createElement(Provider, { store }, children),
      }
    );

    // Re-render with a new inline closure: the hook reads callbacks through a ref, so this must
    // not queue a focus of its own.
    target = second;
    rerender();
    expect(document.activeElement).not.toBe(second);

    store.set(requestWorkflowNodeFieldFocusAtom, { nodeId: "email-1", field: "any" });
    await waitFor(() => expect(document.activeElement).toBe(second));
  });
});
