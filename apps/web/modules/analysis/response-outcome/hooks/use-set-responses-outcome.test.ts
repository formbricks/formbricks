/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { OutcomeBatchError } from "../lib/client";
import { useSetResponsesOutcome } from "./use-set-responses-outcome";

const client = vi.hoisted(() => ({
  setResponsesOutcomeBatch: vi.fn(),
}));

vi.mock("../lib/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/client")>()),
  ...client,
}));

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    QueryClientProvider,
    { client: new QueryClient({ defaultOptions: { mutations: { retry: false } } }) },
    children
  );

describe("useSetResponsesOutcome", () => {
  const applyOutcomes = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("one response goes through the batch route, applied to the list before the server answers", async () => {
    let resolve: (value: { updated: number }) => void = () => undefined;
    client.setResponsesOutcomeBatch.mockReturnValue(new Promise((done) => (resolve = done)));
    const { result } = renderHook(() => useSetResponsesOutcome({ workspaceId: "ws", applyOutcomes }), {
      wrapper,
    });

    act(() => result.current.mutate({ ids: ["r1"], outcome: "lowQuality", previous: { r1: null } }));

    await waitFor(() => expect(applyOutcomes).toHaveBeenCalledWith({ r1: "lowQuality" }));
    expect(client.setResponsesOutcomeBatch).toHaveBeenCalledWith("ws", ["r1"], "lowQuality");
    resolve({ updated: 1 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(applyOutcomes).toHaveBeenCalledTimes(1);
  });

  test("a refused single mark puts the previous outcome back", async () => {
    client.setResponsesOutcomeBatch.mockRejectedValue(new Error("Forbidden"));
    const { result } = renderHook(() => useSetResponsesOutcome({ workspaceId: "ws", applyOutcomes }), {
      wrapper,
    });

    act(() => result.current.mutate({ ids: ["r1"], outcome: "lowQuality", previous: { r1: null } }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(applyOutcomes).toHaveBeenLastCalledWith({ r1: null });
  });

  test("many responses go through the batch route, 100 per call", async () => {
    client.setResponsesOutcomeBatch.mockImplementation(async (_ws: string, ids: string[]) => ({
      updated: ids.length,
    }));
    const ids = Array.from({ length: 150 }, (_, index) => `r${index}`);
    const { result } = renderHook(() => useSetResponsesOutcome({ workspaceId: "ws", applyOutcomes }), {
      wrapper,
    });

    act(() => result.current.mutate({ ids, outcome: null, previous: {} }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.setResponsesOutcomeBatch.mock.calls.map(([, chunk]) => chunk.length)).toEqual([100, 50]);
    expect(result.current.data).toEqual({ updated: 150 });
  });

  test("a batch that fails part-way rolls back only the responses that were not saved", async () => {
    client.setResponsesOutcomeBatch
      .mockResolvedValueOnce({ updated: 100 })
      .mockRejectedValueOnce(new Error("boom"));
    const ids = Array.from({ length: 150 }, (_, index) => `r${index}`);
    const previous = Object.fromEntries(ids.map((id) => [id, null]));
    const { result } = renderHook(() => useSetResponsesOutcome({ workspaceId: "ws", applyOutcomes }), {
      wrapper,
    });

    act(() => result.current.mutate({ ids, outcome: "lowQuality", previous }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    const rolledBack = applyOutcomes.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(Object.keys(rolledBack)).toEqual(ids.slice(100));
    expect(result.current.error).toBeInstanceOf(OutcomeBatchError);
  });

  test("reports the result and the failure through the hook-level callbacks", async () => {
    const onSaved = vi.fn();
    const onFailed = vi.fn();
    client.setResponsesOutcomeBatch
      .mockResolvedValueOnce({ updated: 1 })
      .mockRejectedValueOnce(new Error("nope"));
    const { result } = renderHook(
      () => useSetResponsesOutcome({ workspaceId: "ws", applyOutcomes, onSaved, onFailed }),
      { wrapper }
    );

    act(() => result.current.mutate({ ids: ["r1"], outcome: "lowQuality", previous: { r1: null } }));
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith({ updated: 1 }, expect.objectContaining({ ids: ["r1"] }))
    );

    act(() => result.current.mutate({ ids: ["r2"], outcome: null, previous: { r2: "lowQuality" } }));
    await waitFor(() =>
      expect(onFailed).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ ids: ["r2"] }))
    );
  });
});
