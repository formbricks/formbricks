/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ENRICHMENT_POLL_INTERVAL_MS, type TEnrichmentStatusResponse } from "../lib/enrichment";
import { useEnrichmentStatus } from "./use-enrichment-status";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseEnrichmentStatusTestWrapper";
  return Wrapper;
}

const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const jsonResponse = (data: TEnrichmentStatusResponse) =>
  new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("useEnrichmentStatus", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("fetches the enrichment status for the workspace", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      jsonResponse({
        enrichments: [{ kind: "translation", eligible: 500, done: 480, failedTerminal: 0, pending: 20 }],
        unavailable: false,
      })
    );

    const { result } = renderHook(() => useEnrichmentStatus({ workspaceId: "w" }), {
      wrapper: createWrapper(createQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.enrichments).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/unify-feedback/enrichment-status?workspaceId=w",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  test("keeps polling while work is pending", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(async () =>
      jsonResponse({
        enrichments: [{ kind: "sentiment", eligible: 500, done: 100, failedTerminal: 0, pending: 400 }],
        unavailable: false,
      })
    );

    const { result } = renderHook(() => useEnrichmentStatus({ workspaceId: "w" }), {
      wrapper: createWrapper(createQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await vi.advanceTimersByTimeAsync(11_000);

    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  test("stops polling once nothing is pending", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(async () =>
      jsonResponse({
        enrichments: [{ kind: "sentiment", eligible: 500, done: 500, failedTerminal: 0, pending: 0 }],
        unavailable: false,
      })
    );

    const { result } = renderHook(() => useEnrichmentStatus({ workspaceId: "w" }), {
      wrapper: createWrapper(createQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await vi.advanceTimersByTimeAsync(30_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("stops polling once the only remainder is permanently-failed records", async () => {
    // ENG-2375: before failedTerminal was subtracted, this shape (eligible=500, done=480, 20
    // permanently failed) reported pending=20 and polled forever for work that would never complete.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(async () =>
      jsonResponse({
        enrichments: [{ kind: "sentiment", eligible: 500, done: 480, failedTerminal: 20, pending: 0 }],
        unavailable: false,
      })
    );

    const { result } = renderHook(() => useEnrichmentStatus({ workspaceId: "w" }), {
      wrapper: createWrapper(createQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await vi.advanceTimersByTimeAsync(30_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("stops polling when the Hub is unavailable", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementation(async () => jsonResponse({ enrichments: [], unavailable: true }));

    const { result } = renderHook(() => useEnrichmentStatus({ workspaceId: "w" }), {
      wrapper: createWrapper(createQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await vi.advanceTimersByTimeAsync(30_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ENG-2254: the last good answer still says work is pending, so before, a 401 (session expired in a tab
  // left open) or 403 (access revoked) kept the five-second interval going for as long as the tab lived.
  test.each([401, 403])("stops polling on a %i under the page's retry: 1 client", async (status) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          enrichments: [{ kind: "sentiment", eligible: 500, done: 100, failedTerminal: 0, pending: 400 }],
          unavailable: false,
        })
      )
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ title: "Refused", status, detail: "refused" }), {
            status,
            headers: { "Content-Type": "application/problem+json" },
          })
      );

    const { result } = renderHook(() => useEnrichmentStatus({ workspaceId: "w" }), {
      // Mirrors `EnrichmentStatusQueryClientProvider`, the client this hook ships under: one retry, so the
      // refusal is asked twice before the error lands and the interval is re-evaluated.
      wrapper: createWrapper(new QueryClient({ defaultOptions: { queries: { retry: 1 } } })),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await vi.advanceTimersByTimeAsync(ENRICHMENT_POLL_INTERVAL_MS + 2000);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("stays idle (no fetch) when workspaceId is empty", () => {
    const fetchMock = vi.mocked(global.fetch);

    const { result } = renderHook(() => useEnrichmentStatus({ workspaceId: "" }), {
      wrapper: createWrapper(createQueryClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
