/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TWorkflowResource } from "@formbricks/workflows";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  hasWorkflowSaveFailedAtom,
  hydrateWorkflowEditorAtom,
  isWorkflowDirtyAtom,
  setWorkflowNameAtom,
  workflowNameAtom,
  workflowSaveErrorAtom,
} from "@/modules/ee/workflows/state/editor";
import { useWorkflowBuilder } from "./use-workflow-builder";

// What a dropped connection actually throws — the string this must never put in front of a user.
const offlineError = () => new TypeError("NetworkError when attempting to fetch resource.");

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
vi.mock("@/modules/ee/workflows/lib/api-client", () => ({
  // Real value, not a stub: the deferred-flush hard stop is derived from it, and an undefined here
  // would make that setTimeout fire immediately and cancel the wait under test.
  MUTATION_TIMEOUT_MS: 15_000,
  getWorkflow: (...args: unknown[]) => getWorkflow(...args),
  updateWorkflow: (...args: unknown[]) => updateWorkflow(...args),
  enableWorkflow: (...args: unknown[]) => enableWorkflow(...args),
  disableWorkflow: (...args: unknown[]) => disableWorkflow(...args),
  archiveWorkflow: (...args: unknown[]) => archiveWorkflow(...args),
  unarchiveWorkflow: (...args: unknown[]) => unarchiveWorkflow(...args),
}));

vi.mock("@/modules/ee/workflows/lib/definition-to-flow", () => ({
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

// Pass `injectedStore` to simulate a remount: the real store lives in the (detail) layout, so it
// survives the editor page unmounting on an edit ↔ runs tab switch.
const renderBuilder = (
  args: Parameters<typeof useWorkflowBuilder>[0],
  injectedStore?: ReturnType<typeof createStore>
) => {
  const store = injectedStore ?? createStore();
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

  test("surfaces load error via toast and loadError, without leaking the raw message", async () => {
    getWorkflow.mockRejectedValue(offlineError());

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });

    await waitFor(() => expect(result.current.loadError).toBe("workspace.workflows.load_failed"));
    expect(toastError).toHaveBeenCalledWith("workspace.workflows.load_failed");
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

  test("reports a missing name even while another save is in flight", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    // Never settles, so the first save stays in flight and the overlap guard stays armed.
    updateWorkflow.mockReturnValue(new Promise(() => undefined));

    const { result, store } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    await act(async () => {
      void result.current.save();
    });
    await waitFor(() => expect(result.current.isSaving).toBe(true));
    expect(updateWorkflow).toHaveBeenCalledTimes(1);

    await act(async () => {
      store.set(setWorkflowNameAtom, "   ");
    });
    await act(async () => {
      await expect(result.current.save()).resolves.toBe(false);
    });

    // The overlap guard must not swallow the validation message: the title field commits with
    // Enter, so a silent refusal here reads as "Enter did nothing" all over again.
    expect(toastError).toHaveBeenCalledWith("workspace.workflows.name_required");
    // Still no second PATCH — the guard's actual job is intact.
    expect(updateWorkflow).toHaveBeenCalledTimes(1);
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

  test("reports a transport failure with friendly copy, not the browser's message", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockRejectedValue(offlineError());

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    await act(async () => {
      await result.current.save();
    });

    expect(toastError).toHaveBeenCalledWith("workspace.workflows.save_failed");
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  test("surfaces the server's detail when the API rejects the draft", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockRejectedValue(new V3ApiError({ status: 422, detail: "Definition is invalid." }));

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    await act(async () => {
      await result.current.save();
    });

    expect(toastError).toHaveBeenCalledWith("Definition is invalid.");
  });

  test("does not flag a failed state for a draft that never left the client", async () => {
    getWorkflow.mockResolvedValue({ ...apiWorkflow, name: "  " });

    const { result, store } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow).toBeTruthy());

    await act(async () => {
      await result.current.save({ silent: true });
    });

    // "Save failed" means the server refused it. An unfinished draft is the validation UI's job.
    expect(updateWorkflow).not.toHaveBeenCalled();
    expect(store.get(workflowSaveErrorAtom)).toBeNull();
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

  test("records a silent failure as persistent state instead of a toast", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockRejectedValue(offlineError());

    const { result, store } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    await act(async () => {
      await result.current.save({ silent: true });
    });

    // A toast here would fade before the user noticed it; the header pill reads the state instead
    // and stays failed until a save lands.
    expect(toastError).not.toHaveBeenCalled();
    expect(store.get(workflowSaveErrorAtom)).toEqual(
      expect.objectContaining({ kind: "unreachable", detail: null })
    );
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

  test("collapses a typing burst into one save carrying the final value", { timeout: 15000 }, async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockResolvedValue(apiWorkflow);

    const { result, store } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    // Keystrokes spaced under the debounce window: each one must restart the timer rather than
    // queue its own PATCH.
    for (const name of ["N", "Na", "Nam", "Name"]) {
      act(() => {
        store.set(setWorkflowNameAtom, name);
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(updateWorkflow).not.toHaveBeenCalled();

    await waitFor(() => expect(updateWorkflow).toHaveBeenCalledTimes(1), { timeout: 4000 });
    // The first PATCH carries "Name" either way — save() reads the store, not the timer's closure —
    // so settle past a full debounce window: an uncancelled timer would land its own call here.
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(updateWorkflow).toHaveBeenCalledTimes(1);
    expect(updateWorkflow).toHaveBeenCalledWith("wf-api", expect.objectContaining({ name: "Name" }));
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

  test("retries the failed draft when connectivity returns", { timeout: 15000 }, async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockRejectedValue(offlineError());

    const { result, store } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    act(() => {
      store.set(setWorkflowNameAtom, "Edited while offline");
    });
    await waitFor(() => expect(updateWorkflow).toHaveBeenCalledTimes(1), { timeout: 4000 });
    await waitFor(() => expect(store.get(workflowSaveErrorAtom)?.kind).toBe("unreachable"));

    // The guard holds the identical draft back while nothing has changed…
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(updateWorkflow).toHaveBeenCalledTimes(1);

    // …until the browser reports it is back online, which clears the guard and re-arms the debounce
    // without the user having to touch anything.
    updateWorkflow.mockResolvedValue(apiWorkflow);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(updateWorkflow).toHaveBeenCalledTimes(2), { timeout: 4000 });
    await waitFor(() => expect(store.get(workflowSaveErrorAtom)).toBeNull());
    expect(result.current.isDirty).toBe(false);
  });

  test("does not retry a rejected draft when connectivity returns", { timeout: 15000 }, async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockRejectedValue(new V3ApiError({ status: 422, detail: "Definition is invalid." }));

    const { result, store } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    act(() => {
      store.set(setWorkflowNameAtom, "Rejected edit");
    });
    await waitFor(() => expect(updateWorkflow).toHaveBeenCalledTimes(1), { timeout: 4000 });
    await waitFor(() => expect(store.get(workflowSaveErrorAtom)?.kind).toBe("rejected"));

    // Being back online says nothing about a draft the API actively refused; re-sending it would
    // just fail again on every network flap.
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(updateWorkflow).toHaveBeenCalledTimes(1);
    expect(store.get(workflowSaveErrorAtom)?.detail).toBe("Definition is invalid.");
  });

  test("clears the failed state once a save succeeds", { timeout: 15000 }, async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockRejectedValueOnce(offlineError()).mockResolvedValue(apiWorkflow);

    const { result, store } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    act(() => {
      store.set(setWorkflowNameAtom, "First attempt");
    });
    await waitFor(() => expect(store.get(hasWorkflowSaveFailedAtom)).toBe(true), { timeout: 4000 });

    act(() => {
      store.set(setWorkflowNameAtom, "Second attempt");
    });
    await waitFor(() => expect(updateWorkflow).toHaveBeenCalledTimes(2), { timeout: 4000 });

    await waitFor(() => expect(store.get(workflowSaveErrorAtom)).toBeNull());
    expect(store.get(hasWorkflowSaveFailedAtom)).toBe(false);
    expect(result.current.isDirty).toBe(false);
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

  test("flushes edits typed during an in-flight save instead of dropping them", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    let releaseFirstSave: () => void = () => undefined;
    updateWorkflow
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirstSave = () => resolve(apiWorkflow);
          })
      )
      .mockResolvedValue(apiWorkflow);

    const { result, store, unmount } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    // Autosave fires for the first edit and its PATCH stays open (a slow network, up to the 15s
    // mutation timeout).
    act(() => {
      store.set(setWorkflowNameAtom, "In flight");
    });
    await waitFor(() => expect(updateWorkflow).toHaveBeenCalledTimes(1), { timeout: 4000 });

    // The user keeps typing while that write is open, then navigates away.
    act(() => {
      store.set(setWorkflowNameAtom, "Typed during the save");
    });
    unmount();

    // Still only the open write: save() refuses to overlap it, and this is the window where the
    // newer edits used to be dropped with no error at all, fully online.
    expect(updateWorkflow).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseFirstSave();
    });

    await waitFor(() => expect(updateWorkflow).toHaveBeenCalledTimes(2));
  });

  // Pins the guarantee, not one mechanism: today the deferred flush self-terminates because
  // hydrating another workflow clears isSaving and yields a clean draft. If that ever stops being
  // true, a flush armed for one workflow could PATCH another — this test is the fence.
  test("never lets a deferred flush PATCH a workflow it was not armed for", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    let releaseFirstSave: () => void = () => undefined;
    updateWorkflow
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirstSave = () => resolve(apiWorkflow);
          })
      )
      .mockResolvedValue(apiWorkflow);

    const store = createStore();
    const { result, unmount } = renderBuilder({ workflowId: "wf-api", isReadOnly: false }, store);
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    act(() => {
      store.set(setWorkflowNameAtom, "In flight");
    });
    await waitFor(() => expect(updateWorkflow).toHaveBeenCalledTimes(1), { timeout: 4000 });

    act(() => {
      store.set(setWorkflowNameAtom, "Typed during the save");
    });
    unmount();

    // The layout (and this store) outlive the editor page, so a different workflow can land here
    // before the pending write settles.
    act(() => {
      store.set(hydrateWorkflowEditorAtom, {
        workflow: { ...apiWorkflow, id: "wf-other", name: "Another workflow" },
        flowNodes: [],
      });
      store.set(setWorkflowNameAtom, "Edited on the other workflow");
    });

    await act(async () => {
      releaseFirstSave();
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(updateWorkflow).toHaveBeenCalledTimes(1);
    expect(updateWorkflow).not.toHaveBeenCalledWith("wf-other", expect.anything());
  });

  test("keeps an unsaved draft when the same workflow re-mounts", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockRejectedValue(offlineError());
    const store = createStore();

    const first = renderBuilder({ workflowId: "wf-api", isReadOnly: false }, store);
    await waitFor(() => expect(first.result.current.workflow?.id).toBe("wf-api"));

    act(() => {
      store.set(setWorkflowNameAtom, "Survives the tab switch");
    });
    await waitFor(() => expect(store.get(hasWorkflowSaveFailedAtom)).toBe(true), { timeout: 4000 });
    first.unmount();

    // Coming back to the edit tab: same workflow, same store, a fresh page instance that refetches.
    const second = renderBuilder({ workflowId: "wf-api", isReadOnly: false }, store);

    // No skeleton over work that never left — the editor already holds this workflow.
    expect(second.result.current.isLoading).toBe(false);

    await waitFor(() => expect(getWorkflow).toHaveBeenCalledTimes(2));
    // Hydrating here would rebuild from initialWorkflowEditorState and re-seed lastSavedDraft from
    // the server, destroying the draft AND making it read clean.
    expect(store.get(workflowNameAtom)).toBe("Survives the tab switch");
    expect(store.get(isWorkflowDirtyAtom)).toBe(true);
    second.unmount();
  });

  test("re-hydrates on remount when the draft is clean", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    const store = createStore();

    const first = renderBuilder({ workflowId: "wf-api", isReadOnly: false }, store);
    await waitFor(() => expect(first.result.current.workflow?.id).toBe("wf-api"));
    first.unmount();

    // Nothing local to protect, so a remount must still pick up changes made elsewhere.
    getWorkflow.mockResolvedValue({ ...apiWorkflow, name: "Renamed on the server", status: "enabled" });
    const second = renderBuilder({ workflowId: "wf-api", isReadOnly: false }, store);

    await waitFor(() => expect(store.get(workflowNameAtom)).toBe("Renamed on the server"));
    expect(second.result.current.isEnabled).toBe(true);
    expect(store.get(isWorkflowDirtyAtom)).toBe(false);
    second.unmount();
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
    archiveWorkflow.mockRejectedValue(offlineError());

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    await act(async () => {
      await result.current.archive();
    });

    expect(toastError).toHaveBeenCalledWith("workspace.workflows.archive_failed");
  });

  test("read-only members never fire a lifecycle request", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: true });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    await act(() => result.current.enable());
    await act(() => result.current.disable());
    await act(() => result.current.archive());
    await act(() => result.current.unarchive());

    // The server rejects these with 403; the hook must not even attempt them.
    expect(enableWorkflow).not.toHaveBeenCalled();
    expect(disableWorkflow).not.toHaveBeenCalled();
    expect(archiveWorkflow).not.toHaveBeenCalled();
    expect(unarchiveWorkflow).not.toHaveBeenCalled();
  });

  test("blocks enable with a toast when the pre-flight flush fails", async () => {
    getWorkflow.mockResolvedValue(apiWorkflow);
    updateWorkflow.mockRejectedValue(offlineError());

    const { result, store } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    act(() => {
      store.set(setWorkflowNameAtom, "Renamed but unsaveable");
    });
    await act(() => result.current.enable());

    // Enabling would publish a definition other than the one on screen. The flush is silent, so
    // without this toast the click would look like it did nothing at all.
    expect(enableWorkflow).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("workspace.workflows.enable_blocked_unsaved_changes");
  });
});
