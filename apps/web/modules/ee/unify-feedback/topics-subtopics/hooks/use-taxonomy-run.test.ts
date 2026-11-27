/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { makeQueryClient } from "@/modules/api/lib/query-client";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { isTaxonomyRunGone, useTaxonomyRun } from "./use-taxonomy-run";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { readonly children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseTaxonomyRunTestWrapper";
  return Wrapper;
}

const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const problemResponse = (status: number) =>
  new Response(JSON.stringify({ title: "Refused", status, detail: "refused" }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });

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
   * Run under both retry policies on purpose: the suite's default is `retry: false`, but the page ships under
   * the house client (`makeQueryClient`), and React Query only commits the error once retries are exhausted —
   * so only the second case proves the poll terminates in the configuration users get.
   *
   * The request count is asserted as an equality rather than an upper bound: "no more than N" would also
   * hold at zero requests, so a hook that never fetched at all — a broken fixture, `enabled` off — would
   * pass while proving nothing.
   */
  test.each([
    { policy: "with retries disabled", createClient: createQueryClient, expected: 1 },
    { policy: "under the house query client", createClient: () => makeQueryClient(), expected: 1 },
  ])("stops polling once the run is gone (404), $policy", async ({ createClient, expected }) => {
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
        wrapper: createWrapper(createClient()),
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

  /**
   * ENG-2254: an expired session (401) or revoked access (403) is not a transient blip — before, the tab
   * kept asking every five seconds for as long as it stayed open. Under the house client, so the request
   * count also proves a 4xx is not retried.
   */
  test.each([401, 403])("stops polling on a %i under the house query client", async (status) => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockResolvedValue(problemResponse(status));

      renderHook(() => useTaxonomyRun({ workspaceId: "w", directoryId: "d", runId: "run-1" }), {
        wrapper: createWrapper(makeQueryClient()),
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * Stopping is not giving up for good: a 401 can clear when the user signs in again in another tab. The
   * next fetch the client makes on its own (here a window refocus) re-evaluates the interval, and a run
   * that is still going resumes polling.
   */
  test("resumes polling after a 401 once a refocus refetch succeeds", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockResolvedValue(problemResponse(401));

      const { result } = renderHook(
        () => useTaxonomyRun({ workspaceId: "w", directoryId: "d", runId: "run-1" }),
        { wrapper: createWrapper(makeQueryClient()) }
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // A fresh Response per call: a body can be read only once, and a reused one would make the later
      // polls fail while still counting as requests.
      fetchMock.mockImplementation(
        async () =>
          new Response(JSON.stringify({ data: { id: "run-1", status: "running" } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
      );
      await act(async () => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.current.data?.status).toBe("running");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(result.current.isError).toBe(false);
      expect(result.current.data?.status).toBe("running");
    } finally {
      focusManager.setFocused(undefined);
      vi.useRealTimers();
    }
  });

  /**
   * The topics page reads through the house client: a 5xx is retried three times with backoff (1 s, 2 s,
   * 4 s) before the error lands, and the poll then keeps its interval so a Hub blip self-recovers.
   */
  test("retries a 5xx three times under the house query client, then keeps polling", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockImplementation(async () => problemResponse(502));

      const { result } = renderHook(
        () => useTaxonomyRun({ workspaceId: "w", directoryId: "d", runId: "run-1" }),
        { wrapper: createWrapper(makeQueryClient()) }
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(7500);
      });
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(result.current.isError).toBe(true);

      // One interval later the poll asks again rather than stopping.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(fetchMock.mock.calls.length).toBeGreaterThan(4);
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

/**
 * Exercised directly because both consumers must agree: the hook stops polling on it, and
 * `topics-subtopics-container` stops treating the run as in-flight. The container is a `.tsx` and so is not
 * unit-tested per CODING_STANDARDS.md, which is precisely why the shared predicate carries the coverage.
 */
describe("isTaxonomyRunGone", () => {
  test.each([
    {
      label: "a 404 from this endpoint",
      error: new V3ApiError({ status: 404, detail: "gone" }),
      expected: true,
    },
    { label: "a 403", error: new V3ApiError({ status: 403, detail: "no" }), expected: false },
    { label: "a 502", error: new V3ApiError({ status: 502, detail: "upstream" }), expected: false },
    { label: "a plain Error (network failure)", error: new Error("fetch failed"), expected: false },
    { label: "no error at all", error: null, expected: false },
  ])("$label -> $expected", ({ error, expected }) => {
    expect(isTaxonomyRunGone(error)).toBe(expected);
  });
});
