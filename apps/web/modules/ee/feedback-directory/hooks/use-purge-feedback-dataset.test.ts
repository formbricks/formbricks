/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { usePurgeFeedbackDataset } from "./use-purge-feedback-dataset";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  Wrapper.displayName = "UsePurgeFeedbackDatasetTestWrapper";

  return Wrapper;
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
}

function acceptedResponse() {
  return {
    ok: true,
    status: 202,
    json: async () => ({ data: { datasetId: "dataset_1", status: "accepted" } }),
  } as unknown as Response;
}

describe("usePurgeFeedbackDataset", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("sends one purge request and reports ownership of the outcome", async () => {
    vi.mocked(global.fetch).mockResolvedValue(acceptedResponse());

    const { result } = renderHook(() => usePurgeFeedbackDataset(), {
      wrapper: createWrapper(createQueryClient()),
    });

    await expect(result.current.purgeDatasetOnce("dataset_1")).resolves.toBe(true);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe("/api/internal/feedback-datasets/dataset_1/purge");
    expect(vi.mocked(global.fetch).mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  // ENG-2603: a double-click on Confirm ran the handler twice before React Query's `isPending`
  // reached the disabled button, so one user action started two Hub purge jobs. Both calls are made
  // without awaiting in between, which is what the two clicks do.
  test("skips a second purge while the first is still in flight", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    vi.mocked(global.fetch).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result } = renderHook(() => usePurgeFeedbackDataset(), {
      wrapper: createWrapper(createQueryClient()),
    });

    const first = result.current.purgeDatasetOnce("dataset_1");
    const second = result.current.purgeDatasetOnce("dataset_1");

    // React Query reaches `mutationFn` a few microtasks after `mutateAsync`, so assert only once
    // both calls have had the chance to fetch — while the first request is still unsettled.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    await expect(second).resolves.toBe(false);

    resolveFetch?.(acceptedResponse());

    await expect(first).resolves.toBe(true);
  });

  test("allows a further purge once the first one has settled", async () => {
    vi.mocked(global.fetch).mockResolvedValue(acceptedResponse());

    const { result } = renderHook(() => usePurgeFeedbackDataset(), {
      wrapper: createWrapper(createQueryClient()),
    });

    await expect(result.current.purgeDatasetOnce("dataset_1")).resolves.toBe(true);
    await expect(result.current.purgeDatasetOnce("dataset_1")).resolves.toBe(true);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // A rejected purge must release the guard too, otherwise a failed attempt would silently disable
  // the button's only working retry path for the life of the dialog.
  test("releases the guard when the request fails, so a retry still reaches the route", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: "internal_server_error", message: "boom" } }),
    } as unknown as Response);

    const { result } = renderHook(() => usePurgeFeedbackDataset(), {
      wrapper: createWrapper(createQueryClient()),
    });

    await expect(result.current.purgeDatasetOnce("dataset_1")).rejects.toBeDefined();

    vi.mocked(global.fetch).mockResolvedValue(acceptedResponse());

    await expect(result.current.purgeDatasetOnce("dataset_1")).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("exposes the mutation's pending state", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    vi.mocked(global.fetch).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result } = renderHook(() => usePurgeFeedbackDataset(), {
      wrapper: createWrapper(createQueryClient()),
    });

    expect(result.current.isPending).toBe(false);

    const purge = result.current.purgeDatasetOnce("dataset_1");
    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolveFetch?.(acceptedResponse());
    await purge;

    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});
