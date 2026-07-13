/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TWorkflowResource } from "@formbricks/workflows";
import { setWorkflowNameAtom } from "@/modules/workflows/state/editor";
import { useWorkflowBuilder } from "./use-workflow-builder";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("react-hot-toast", () => ({
  default: { success: (msg: string) => toastSuccess(msg), error: (msg: string) => toastError(msg) },
}));
vi.mock("react-i18next", () => {
  // Stable across renders: the load effect depends on `t`, and a per-render identity would
  // re-fetch + re-hydrate on every render, wiping the dirty draft the autosave tests rely on.
  const translation = { t: (key: string) => key };
  return { useTranslation: () => translation };
});

const routerRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

const getWorkflow = vi.fn();
const updateWorkflow = vi.fn();
const enableWorkflow = vi.fn();
const disableWorkflow = vi.fn();
const archiveWorkflow = vi.fn();
const unarchiveWorkflow = vi.fn();
vi.mock("@/modules/workflows/lib/api-client", () => ({
  getWorkflow: (...args: unknown[]) => getWorkflow(...args),
  updateWorkflow: (...args: unknown[]) => updateWorkflow(...args),
  enableWorkflow: (...args: unknown[]) => enableWorkflow(...args),
  disableWorkflow: (...args: unknown[]) => disableWorkflow(...args),
  archiveWorkflow: (...args: unknown[]) => archiveWorkflow(...args),
  unarchiveWorkflow: (...args: unknown[]) => unarchiveWorkflow(...args),
}));

vi.mock("@/modules/workflows/lib/definition-to-flow", () => ({
  workflowDefinitionToFlowNodes: () => [],
}));

// safeParse mimics real zod normalization: it returns a REBUILT object (defaults applied, keys in
// schema order), never the input reference. The autosave dirty-tracking must stay immune to that —
// see "a normalizing schema parse..." below.
vi.mock("@formbricks/workflows", () => ({
  ZWorkflowDefinition: {
    safeParse: (value: unknown) => ({
      success: true,
      data: { schemaVersion: 1, ...(value as Record<string, unknown>) },
    }),
  },
}));

const apiWorkflow = {
  id: "wf-api",
  name: "From API",
  description: "Desc",
  status: "draft",
  definition: { trigger: { id: "trigger-1" }, nodes: [], edges: [] },
} as unknown as TWorkflowResource;

const renderBuilder = (args: Parameters<typeof useWorkflowBuilder>[0]) => {
  const store = createStore();
  const wrapper = ({ children }: { children: ReactNode }) => createElement(Provider, { store }, children);
  return { store, ...renderHook(() => useWorkflowBuilder(args), { wrapper }) };
};

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
  routerRefresh.mockClear();
  getWorkflow.mockReset();
  updateWorkflow.mockReset();
  enableWorkflow.mockReset();
  disableWorkflow.mockReset();
  archiveWorkflow.mockReset();
  unarchiveWorkflow.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("load", () => {
  test("fetches via API and hydrates the editor", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });

    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));
    expect(getWorkflow).toHaveBeenCalledWith("wf-api", expect.any(AbortSignal));
  });

  test("surfaces load error via toast and loadError", async () => {
    getWorkflow.mockRejectedValue(new Error("boom"));

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });

    await waitFor(() => expect(result.current.loadError).toBe("boom"));
    expect(toastError).toHaveBeenCalled();
  });

  test("skips load when loadOnMount is false", () => {
    renderBuilder({ workflowId: "wf-api", isReadOnly: false, loadOnMount: false });

    expect(getWorkflow).not.toHaveBeenCalled();
  });
});

describe("canEdit flags", () => {
  test.each([
    ["draft", false, true, true],
    ["disabled", false, true, true],
    ["enabled", false, false, true],
    ["archived", false, false, false],
    ["draft", true, false, false],
  ] as const)(
    "status=%s isReadOnly=%s → canEditDefinition=%s canEditMetadata=%s",
    async (status, isReadOnly, expectedDef, expectedMeta) => {
      getWorkflow.mockResolvedValue({ ...apiWorkflow, status });

      const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly });

      await waitFor(() => expect(result.current.workflow).toBeTruthy());
      expect(result.current.canEditDefinition).toBe(expectedDef);
      expect(result.current.canEditMetadata).toBe(expectedMeta);
    }
  );
});

describe("save", () => {
  test("rejects empty name with a toast", async () => {
    getWorkflow.mockResolvedValue({ ...apiWorkflow, name: "  " });

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow).toBeTruthy());

    await act(async () => {
      await result.current.save();
    });

    expect(toastError).toHaveBeenCalledWith("workspace.workflows.name_required");
    expect(updateWorkflow).not.toHaveBeenCalled();
  });

  test("PATCHes via API", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockResolvedValue(apiWorkflow);

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    await act(async () => {
      await result.current.save();
    });

    expect(updateWorkflow).toHaveBeenCalledWith("wf-api", expect.objectContaining({ name: "From API" }));
    expect(toastSuccess).toHaveBeenCalledWith("workspace.workflows.save_success");
    // Server-resolved props (email authoring context) must catch up with the saved definition.
    expect(routerRefresh).toHaveBeenCalled();
  });

  test("save reports a failure toast", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockRejectedValue(new Error("save kaboom"));

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    await act(async () => {
      await result.current.save();
    });

    expect(toastError).toHaveBeenCalled();
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});

describe("silent save (autosave mode)", () => {
  test("saves without a success toast", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockResolvedValue(apiWorkflow);

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    await act(async () => {
      await result.current.save({ silent: true });
    });

    expect(updateWorkflow).toHaveBeenCalledWith("wf-api", expect.objectContaining({ name: "From API" }));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  test("skips an invalid draft quietly instead of toasting", async () => {
    getWorkflow.mockResolvedValue({ ...apiWorkflow, name: "  " });

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow).toBeTruthy());

    await act(async () => {
      await result.current.save({ silent: true });
    });

    expect(updateWorkflow).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  test("still surfaces API failures with a toast", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockRejectedValue(new Error("save kaboom"));

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    await act(async () => {
      await result.current.save({ silent: true });
    });

    expect(toastError).toHaveBeenCalled();
  });
});

describe("autosave", () => {
  test("persists a dirty draft after the debounce window without toasting", { timeout: 10000 }, async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockResolvedValue(apiWorkflow);

    const { result, store } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    act(() => {
      store.set(setWorkflowNameAtom, "Renamed by autosave");
    });

    // Debounced: nothing is sent synchronously with the edit.
    expect(updateWorkflow).not.toHaveBeenCalled();
    await waitFor(
      () =>
        expect(updateWorkflow).toHaveBeenCalledWith(
          "wf-api",
          expect.objectContaining({ name: "Renamed by autosave" })
        ),
      { timeout: 4000 }
    );
    expect(toastSuccess).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.isDirty).toBe(false));
  });

  test("does not autosave for read-only viewers", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);

    const { result, store } = renderBuilder({ workflowId: "wf-api", isReadOnly: true });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    act(() => {
      store.set(setWorkflowNameAtom, "Renamed");
    });

    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(updateWorkflow).not.toHaveBeenCalled();
  });

  test(
    "a normalizing schema parse does not leave the draft permanently dirty (no autosave loop)",
    { timeout: 15000 },
    async () => {
      getWorkflow.mockResolvedValue(apiWorkflow);
      updateWorkflow.mockResolvedValue(apiWorkflow);

      const { result, store } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
      await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

      act(() => {
        store.set(setWorkflowNameAtom, "Edited once");
      });
      await waitFor(() => expect(updateWorkflow).toHaveBeenCalledTimes(1), { timeout: 4000 });

      // The parsed payload differs structurally from the editor state (schemaVersion default),
      // but the saved snapshot must be the editor state itself — clean, no repeat saves.
      await waitFor(() => expect(result.current.isDirty).toBe(false));
      await new Promise((resolve) => setTimeout(resolve, 2600));
      expect(updateWorkflow).toHaveBeenCalledTimes(1);
    }
  );

  test("does not retry a failed autosave until the draft changes again", { timeout: 15000 }, async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockRejectedValue(new Error("persistent 500"));

    const { result, store } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    act(() => {
      store.set(setWorkflowNameAtom, "Doomed edit");
    });
    await waitFor(() => expect(updateWorkflow).toHaveBeenCalledTimes(1), { timeout: 4000 });

    // The same draft is not retried on the next debounce window (no PATCH/toast loop)…
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(updateWorkflow).toHaveBeenCalledTimes(1);

    // …but a further edit produces a fresh attempt.
    act(() => {
      store.set(setWorkflowNameAtom, "Doomed edit, take two");
    });
    await waitFor(() => expect(updateWorkflow).toHaveBeenCalledTimes(2), { timeout: 4000 });
  });

  test("flushes a dirty draft on unmount instead of dropping the debounce window", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockResolvedValue(apiWorkflow);

    const { result, store, unmount } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    act(() => {
      store.set(setWorkflowNameAtom, "Edited just before leaving");
    });
    expect(updateWorkflow).not.toHaveBeenCalled();

    unmount();

    expect(updateWorkflow).toHaveBeenCalledWith(
      "wf-api",
      expect.objectContaining({ name: "Edited just before leaving" })
    );
  });
});

describe("transition", () => {
  test("flushes a dirty draft before enabling", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockResolvedValue(apiWorkflow);
    enableWorkflow.mockResolvedValue({ ...apiWorkflow, status: "enabled" });

    const { result, store } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    act(() => {
      store.set(setWorkflowNameAtom, "Renamed before enable");
    });
    await act(() => result.current.enable());

    expect(updateWorkflow).toHaveBeenCalledWith(
      "wf-api",
      expect.objectContaining({ name: "Renamed before enable" })
    );
    expect(enableWorkflow).toHaveBeenCalledWith("wf-api");
    expect(updateWorkflow.mock.invocationCallOrder[0]).toBeLessThan(
      enableWorkflow.mock.invocationCallOrder[0]
    );
  });

  test("enable calls the API + success toast", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    enableWorkflow.mockResolvedValue(apiWorkflow);

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    await act(() => result.current.enable());

    await waitFor(() => expect(enableWorkflow).toHaveBeenCalledWith("wf-api"));
    expect(toastSuccess).toHaveBeenCalledWith("workspace.workflows.enable_success");
  });

  test.each([
    ["disable", disableWorkflow, "disable_success"],
    ["archive", archiveWorkflow, "archive_success"],
    ["unarchive", unarchiveWorkflow, "unarchive_success"],
  ] as const)("%s calls the API + success toast", async (op, mock, successKey) => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    mock.mockResolvedValue(apiWorkflow);

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    await act(() => result.current[op]());

    await waitFor(() => expect(mock).toHaveBeenCalledWith("wf-api"));
    expect(toastSuccess).toHaveBeenCalledWith(`workspace.workflows.${successKey}`);
  });

  test("API failure surfaces a failure toast", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    archiveWorkflow.mockRejectedValue(new Error("nope"));

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    await act(async () => {
      await result.current.archive();
    });

    expect(toastError).toHaveBeenCalled();
  });
});
