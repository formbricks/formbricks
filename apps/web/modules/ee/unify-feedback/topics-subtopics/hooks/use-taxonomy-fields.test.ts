/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { makeQueryClient } from "@/modules/api/lib/query-client";
import { EMBEDDING_POLL_INTERVAL_MS } from "../lib/gate";
import { useTaxonomyFields } from "./use-taxonomy-fields";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { readonly children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseTaxonomyFieldsTestWrapper";
  return Wrapper;
}

const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("useTaxonomyFields", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("fetches the taxonomy fields for the directory", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            fields: [
              {
                tenant_id: "d",
                source_type: "survey",
                source_id: "",
                field_id: "q1",
                record_count: 800,
                embedding_count: 800,
              },
            ],
            unavailable: false,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const { result } = renderHook(() => useTaxonomyFields({ workspaceId: "w", directoryId: "d" }), {
      wrapper: createWrapper(createQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.fields).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/unify-feedback/taxonomy/fields?workspaceId=w&directoryId=d",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  // ENG-2254: the last good answer still shows records waiting for embeddings, so before, a 401 or 403 kept
  // the interval going for as long as the tab stayed open.
  test.each([401, 403])("stops polling on a %i under the house query client", async (status) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                fields: [
                  {
                    tenant_id: "d",
                    source_type: "survey",
                    source_id: "",
                    field_id: "q1",
                    record_count: 800,
                    embedding_count: 200,
                  },
                ],
                unavailable: false,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
        .mockImplementation(
          async () =>
            new Response(JSON.stringify({ title: "Refused", status, detail: "refused" }), {
              status,
              headers: { "Content-Type": "application/problem+json" },
            })
        );

      const { result } = renderHook(() => useTaxonomyFields({ workspaceId: "w", directoryId: "d" }), {
        wrapper: createWrapper(makeQueryClient()),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      await vi.advanceTimersByTimeAsync(EMBEDDING_POLL_INTERVAL_MS + 1000);
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test("stays idle (no fetch) when directoryId is empty", () => {
    const fetchMock = vi.mocked(global.fetch);

    const { result } = renderHook(() => useTaxonomyFields({ workspaceId: "w", directoryId: "" }), {
      wrapper: createWrapper(createQueryClient()),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
