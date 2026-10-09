/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { saveBlobAsFile } from "../lib/file-download";
import { useDownloadRetentionExport, useRetentionRuns } from "./use-retention-runs";

vi.mock("../lib/file-download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/file-download")>()),
  saveBlobAsFile: vi.fn(),
}));

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseRetentionRunsTestWrapper";
  return Wrapper;
}

const run = (id: string) => ({
  id,
  policy: "surveys",
  startedAt: "2030-01-01T02:00:00.000Z",
  finishedAt: null,
  notified: 0,
  archived: 1,
  deleted: 0,
  skipped: 0,
});

const page = (ids: string[], nextCursor: string | null): Response =>
  new Response(JSON.stringify({ data: ids.map(run), meta: { limit: 25, nextCursor } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const newQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("useRetentionRuns", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("loads History and appends the next page on Load more", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(page(["run_2"], "cursor_1")).mockResolvedValueOnce(page(["run_1"], null));

    const { result } = renderHook(
      () => useRetentionRuns({ organizationId: "org_1", includeEmpty: false, limit: 25 }),
      { wrapper: createWrapper(newQueryClient()) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.runs.map((r) => r.id)).toEqual(["run_2"]);
    expect(result.current.hasNextPage).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/internal/retention-runs?organizationId=org_1&limit=25&includeEmpty=false",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.runs.map((r) => r.id)).toEqual(["run_2", "run_1"]));
    expect(result.current.hasNextPage).toBe(false);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/internal/retention-runs?organizationId=org_1&limit=25&includeEmpty=false&cursor=cursor_1",
      expect.anything()
    );
  });

  test("starts a fresh walk, without the old cursor, when includeEmpty changes", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(page(["run_2"], "cursor_1")).mockResolvedValueOnce(page(["run_9"], null));

    const { result, rerender } = renderHook(
      ({ includeEmpty }) => useRetentionRuns({ organizationId: "org_1", includeEmpty, limit: 25 }),
      { wrapper: createWrapper(newQueryClient()), initialProps: { includeEmpty: false } }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ includeEmpty: true });

    await waitFor(() => expect(result.current.runs.map((r) => r.id)).toEqual(["run_9"]));
    // The API binds a cursor to includeEmpty, so reusing cursor_1 here would be a 400.
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/internal/retention-runs?organizationId=org_1&limit=25&includeEmpty=true",
      expect.anything()
    );
  });

  test("surfaces the API's problem as an error", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status: 403, title: "Forbidden", detail: "Not allowed", code: "forbidden" }),
        {
          status: 403,
          headers: { "Content-Type": "application/problem+json" },
        }
      )
    );

    const { result } = renderHook(
      () => useRetentionRuns({ organizationId: "org_1", includeEmpty: false, limit: 25 }),
      { wrapper: createWrapper(newQueryClient()) }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 403 });
    expect(result.current.runs).toEqual([]);
  });
});

describe("useDownloadRetentionExport", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(saveBlobAsFile).mockReset();
  });

  const csv = () =>
    new Response("runId,policy\n", {
      status: 200,
      headers: { "Content-Disposition": 'attachment; filename="retention-history-acme.csv"' },
    });

  test("saves the file the server named once it answers 200", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(csv());
    const { result } = renderHook(() => useDownloadRetentionExport({ organizationId: "org_1" }), {
      wrapper: createWrapper(newQueryClient()),
    });

    await act(() => result.current.mutateAsync());

    expect(saveBlobAsFile).toHaveBeenCalledWith(expect.any(Blob), "retention-history-acme.csv");
  });

  test("aborts the download in flight when the page goes away, and saves nothing", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(global.fetch).mockImplementationOnce((_url, init) => {
      signal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) =>
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
      );
    });
    const { result, unmount } = renderHook(() => useDownloadRetentionExport({ organizationId: "org_1" }), {
      wrapper: createWrapper(newQueryClient()),
    });

    act(() => result.current.mutate());
    await waitFor(() => expect(signal).toBeDefined());
    unmount();

    expect(signal?.aborted).toBe(true);
    expect(saveBlobAsFile).not.toHaveBeenCalled();
  });
});
