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

const getPlaceholderWorkflowResource = vi.fn();
vi.mock("@/modules/workflows/lib/placeholder-data", () => ({
  getPlaceholderWorkflowResource: (...args: unknown[]) => getPlaceholderWorkflowResource(...args),
}));

vi.mock("@/modules/workflows/lib/definition-to-flow", () => ({
  workflowDefinitionToFlowNodes: () => [],
}));

vi.mock("@formbricks/workflows", () => ({
  ZWorkflowDefinition: {
    safeParse: (value: unknown) => ({ success: true, data: value }),
  },
}));

const placeholderWorkflow = {
  id: "wf-placeholder",
  name: "Placeholder",
  description: "Demo",
  status: "draft",
  definition: { trigger: { id: "trigger-1" }, nodes: [], edges: [] },
} as unknown as TWorkflowResource;

const apiWorkflow = {
  ...placeholderWorkflow,
  id: "wf-api",
  name: "From API",
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
  getPlaceholderWorkflowResource.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("load", () => {
  test("hydrates from placeholder data without calling the API", async () => {
    getPlaceholderWorkflowResource.mockReturnValue(placeholderWorkflow);

    const { result } = renderBuilder({ workflowId: "wf-placeholder", isReadOnly: false });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.workflow).toEqual(placeholderWorkflow);
    expect(getWorkflow).not.toHaveBeenCalled();
  });

  test("fetches via API when no placeholder match", async () => {
    getPlaceholderWorkflowResource.mockReturnValue(undefined);
    getWorkflow.mockResolvedValue(apiWorkflow);

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });

    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));
    expect(getWorkflow).toHaveBeenCalledWith("wf-api", expect.any(AbortSignal));
  });

  test("surfaces load error via toast and loadError", async () => {
    getPlaceholderWorkflowResource.mockReturnValue(undefined);
    getWorkflow.mockRejectedValue(new Error("boom"));

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });

    await waitFor(() => expect(result.current.loadError).toBe("boom"));
    expect(toastError).toHaveBeenCalled();
  });

  test("skips load when loadOnMount is false", () => {
    getPlaceholderWorkflowResource.mockReturnValue(placeholderWorkflow);

    renderBuilder({ workflowId: "wf-placeholder", isReadOnly: false, loadOnMount: false });

    expect(getPlaceholderWorkflowResource).not.toHaveBeenCalled();
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
      getPlaceholderWorkflowResource.mockReturnValue({ ...placeholderWorkflow, status });

      const { result } = renderBuilder({ workflowId: "wf-placeholder", isReadOnly });

      await waitFor(() => expect(result.current.workflow).toBeTruthy());
      expect(result.current.canEditDefinition).toBe(expectedDef);
      expect(result.current.canEditMetadata).toBe(expectedMeta);
    }
  );
});

describe("save", () => {
  test("rejects empty name with a toast", async () => {
    getPlaceholderWorkflowResource.mockReturnValue({ ...placeholderWorkflow, name: "  " });

    const { result } = renderBuilder({ workflowId: "wf-placeholder", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow).toBeTruthy());

    await act(async () => {
      await result.current.save();
    });

    expect(toastError).toHaveBeenCalledWith("workspace.workflows.name_required");
    expect(updateWorkflow).not.toHaveBeenCalled();
  });

  test("placeholder save persists locally, no API hit", async () => {
    getPlaceholderWorkflowResource.mockReturnValue(placeholderWorkflow);

    const { result } = renderBuilder({ workflowId: "wf-placeholder", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow).toBeTruthy());

    await act(async () => {
      await result.current.save();
    });

    expect(updateWorkflow).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("workspace.workflows.save_success");
  });

  test("non-placeholder save PATCHes via API", async () => {
    getPlaceholderWorkflowResource.mockImplementation((id: string) =>
      id === "wf-placeholder" ? placeholderWorkflow : undefined
    );
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
});

describe("transition", () => {
  test.each([
    ["enable", "enable_success"],
    ["disable", "disable_success"],
    ["archive", "archive_success"],
    ["unarchive", "unarchive_success"],
  ] as const)("placeholder %s flips local status", async (op, successKey) => {
    getPlaceholderWorkflowResource.mockReturnValue(placeholderWorkflow);

    const { result } = renderBuilder({ workflowId: "wf-placeholder", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow).toBeTruthy());

    await act(async () => {
      await result.current[op]();
    });

    expect(enableWorkflow).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith(`workspace.workflows.${successKey}`);
  });

  test("non-placeholder enable calls the API", async () => {
    getPlaceholderWorkflowResource.mockImplementation((id: string) =>
      id === "wf-placeholder" ? placeholderWorkflow : undefined
    );
    getWorkflow.mockResolvedValue(apiWorkflow);
    enableWorkflow.mockResolvedValue(apiWorkflow);

    const { result } = renderBuilder({ workflowId: "wf-api", isReadOnly: false });
    await waitFor(() => expect(result.current.workflow?.id).toBe("wf-api"));

    await act(() => result.current.enable());

    await waitFor(() => expect(enableWorkflow).toHaveBeenCalledWith("wf-api"));
    expect(toastSuccess).toHaveBeenCalledWith("workspace.workflows.enable_success");
  });

  test("API failure surfaces a failure toast", async () => {
    getPlaceholderWorkflowResource.mockImplementation((id: string) =>
      id === "wf-placeholder" ? placeholderWorkflow : undefined
    );
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
