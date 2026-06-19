/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TWorkflowResource } from "@formbricks/workflows";
import { useWorkflowBuilder } from "./use-workflow-builder";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("react-hot-toast", () => ({
  default: { success: (msg: string) => toastSuccess(msg), error: (msg: string) => toastError(msg) },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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

vi.mock("@formbricks/workflows", () => ({
  ZWorkflowDefinition: {
    safeParse: (value: unknown) => ({ success: true, data: value }),
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
  return renderHook(() => useWorkflowBuilder(args), { wrapper });
};

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
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
  });
});

describe("transition", () => {
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
