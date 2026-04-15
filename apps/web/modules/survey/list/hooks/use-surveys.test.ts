/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useSurveys } from "./use-surveys";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  Wrapper.displayName = "UseSurveysTestWrapper";

  return Wrapper;
}

describe("useSurveys", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("fetches the initial page and the next cursor page", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "survey_1",
                name: "Survey 1",
                workspaceId: "env_1",
                type: "link",
                status: "draft",
                createdAt: "2026-04-15T10:00:00.000Z",
                updatedAt: "2026-04-15T10:00:00.000Z",
                responseCount: 0,
                creator: { name: "Alice" },
              },
            ],
            meta: {
              limit: 20,
              nextCursor: "cursor_1",
              totalCount: 2,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "survey_2",
                name: "Survey 2",
                workspaceId: "env_1",
                type: "app",
                status: "completed",
                createdAt: "2026-04-15T11:00:00.000Z",
                updatedAt: "2026-04-15T11:00:00.000Z",
                responseCount: 2,
                creator: { name: "Bob" },
              },
            ],
            meta: {
              limit: 20,
              nextCursor: null,
              totalCount: 2,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const { result } = renderHook(
      () =>
        useSurveys({
          workspaceId: "env_1",
          limit: 20,
          filters: {
            name: "",
            status: [],
            type: [],
            sortBy: "relevance",
          },
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.surveys).toHaveLength(1);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.surveys).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v3/surveys?workspaceId=env_1&limit=20&sortBy=relevance&cursor=cursor_1",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      })
    );
  });
});
