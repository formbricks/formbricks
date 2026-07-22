/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { workflowKeys } from "../lib/query";
import { createWrapper, newQueryClient } from "./test-utils";
import { useUnarchiveWorkflow } from "./use-unarchive-workflow";

describe("useUnarchiveWorkflow", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("posts to the unarchive endpoint and invalidates the lists on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "wf_1", status: "disabled" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const queryClient = newQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUnarchiveWorkflow(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ workflowId: "wf_1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v3/workflows/wf_1/unarchive",
      expect.objectContaining({ method: "POST", cache: "no-store" })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: workflowKeys.lists() });
  });
});
