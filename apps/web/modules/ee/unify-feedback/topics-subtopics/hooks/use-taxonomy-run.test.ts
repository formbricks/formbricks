/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useTaxonomyRun } from "./use-taxonomy-run";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseTaxonomyRunTestWrapper";
  return Wrapper;
}

const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("useTaxonomyRun", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("fetches the run and does not keep polling once it is terminal", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "run-1", status: "succeeded" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(
      () => useTaxonomyRun({ workspaceId: "w", directoryId: "d", runId: "run-1" }),
      { wrapper: createWrapper(createQueryClient()) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe("succeeded");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/unify-feedback/taxonomy/runs/run-1?workspaceId=w&directoryId=d",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  test("keeps polling after a failed poll instead of giving up (self-recovery)", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.mocked(global.fetch);
      // First poll errors (no data → unknown status). Prior behaviour stopped polling here; the run
      // would then be stuck. Every subsequent poll succeeds with a terminal status.
      fetchMock.mockResolvedValueOnce(new Response("boom", { status: 502 })).mockResolvedValue(
        new Response(JSON.stringify({ data: { id: "run-1", status: "succeeded" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      renderHook(() => useTaxonomyRun({ workspaceId: "w", directoryId: "d", runId: "run-1" }), {
        wrapper: createWrapper(createQueryClient()),
      });

      // Let the initial (failing) poll settle.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Advancing one interval must trigger another poll despite the earlier error.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * A run reaped by the orphan cleaner, or a stale id after a regenerate. Both were treated as "status
   * unknown" before, so the interval kept firing at ~12 requests a minute while the UI showed "generating".
   *
   * Run under both retry policies on purpose: the suite's default is `retry: false`, but the provider that
   * actually ships (`topics-subtopics/query-client-provider.tsx`) uses `retry: 1`, and React Query only
   * commits the error once retries are exhausted — so only the second case proves the poll terminates in the
   * configuration users get.
   *
   * The request count is asserted as an equality rather than an upper bound: "no more than N" would also
   * hold at zero requests, so a hook that never fetched at all — a broken fixture, `enabled` off — would
   * pass while proving nothing.
   */
  test.each([
    { policy: "with retries disabled", retry: false as const, expected: 1 },
    { policy: "under the app's retry: 1 policy", retry: 1, expected: 2 },
  ])("stops polling once the run is gone (404), $policy", async ({ retry, expected }) => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ title: "Not Found", status: 404, code: "not_found" }), {
          status: 404,
          headers: { "Content-Type": "application/problem+json" },
        })
      );

      renderHook(() => useTaxonomyRun({ workspaceId: "w", directoryId: "d", runId: "run-1" }), {
        wrapper: createWrapper(new QueryClient({ defaultOptions: { queries: { retry } } })),
      });

      // Long enough for any retry to have been made (React Query's first retry delay is 1s).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(expected);

      // Six intervals' worth of time later, still nothing: the poll is stopped, not merely slowed.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(expected);
    } finally {
      vi.useRealTimers();
    }
  });

  test("stays idle (no fetch) when runId is null", () => {
    const fetchMock = vi.mocked(global.fetch);

    const { result } = renderHook(() => useTaxonomyRun({ workspaceId: "w", directoryId: "d", runId: null }), {
      wrapper: createWrapper(createQueryClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
