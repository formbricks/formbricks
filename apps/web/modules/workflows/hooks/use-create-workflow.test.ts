/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TCreateWorkflowInput } from "@formbricks/workflows";
import { createDefaultWorkflowDefinition } from "../lib/default-workflow";
import { workflowKeys } from "../lib/query";
import { useCreateWorkflow } from "./use-create-workflow";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseCreateWorkflowTestWrapper";
  return Wrapper;
}

const newQueryClient = () =>
  new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });

const input: TCreateWorkflowInput = {
  workspaceId: "ws_1",
  name: "New",
  description: null,
  status: "draft",
  definition: createDefaultWorkflowDefinition(),
};

describe("useCreateWorkflow", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns the created resource and invalidates list queries on success", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "wf_new", name: "New", status: "draft" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );

    const queryClient = newQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateWorkflow(), { wrapper: createWrapper(queryClient) });

    let created: { id: string } | undefined;
    await act(async () => {
      created = await result.current.mutateAsync(input);
    });

    expect(created).toMatchObject({ id: "wf_new" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: workflowKeys.lists() });
  });

  test("rejects with the parsed error and does not invalidate when create fails", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status: 400, detail: "The request payload is invalid.", code: "bad_request" }),
        {
          status: 400,
          headers: { "Content-Type": "application/problem+json" },
        }
      )
    );

    const queryClient = newQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateWorkflow(), { wrapper: createWrapper(queryClient) });

    await expect(
      act(async () => {
        await result.current.mutateAsync(input);
      })
    ).rejects.toThrow("The request payload is invalid.");

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
