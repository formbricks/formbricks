/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TSurveyOverviewFilters } from "@/modules/survey/list/types/survey-overview";
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
                singleUse: null,
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
                singleUse: null,
              },
            ],
            meta: {
              limit: 20,
              nextCursor: null,
              totalCount: null,
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
      "/api/v3/surveys?workspaceId=env_1&limit=20&sortBy=relevance&cursor=cursor_1&includeTotalCount=false",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      })
    );
  });

  test("keeps the previous page data while refetching for new filters", async () => {
    let resolveNextResponse: ((value: Response) => void) | undefined;
    const nextResponsePromise = new Promise<Response>((resolve) => {
      resolveNextResponse = resolve;
    });

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
                singleUse: null,
              },
            ],
            meta: {
              limit: 20,
              nextCursor: null,
              totalCount: 1,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockReturnValueOnce(nextResponsePromise as Promise<Response>);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const initialFilters: TSurveyOverviewFilters = {
      name: "",
      status: [],
      type: [],
      sortBy: "relevance",
    };

    const { result, rerender } = renderHook(
      ({ filters }) =>
        useSurveys({
          workspaceId: "env_1",
          limit: 20,
          filters,
        }),
      {
        initialProps: { filters: initialFilters },
        wrapper: createWrapper(queryClient),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.surveys).toHaveLength(1);

    rerender({
      filters: {
        ...initialFilters,
        name: "new query",
      },
    });

    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.surveys).toHaveLength(1);
    expect(result.current.surveys[0]?.name).toBe("Survey 1");

    resolveNextResponse?.(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "survey_2",
              name: "Survey 2",
              workspaceId: "env_1",
              type: "link",
              status: "paused",
              createdAt: "2026-04-15T11:00:00.000Z",
              updatedAt: "2026-04-15T11:00:00.000Z",
              responseCount: 4,
              creator: { name: "Bob" },
              singleUse: null,
            },
          ],
          meta: {
            limit: 20,
            nextCursor: null,
            totalCount: 1,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await waitFor(() => expect(result.current.surveys[0]?.name).toBe("Survey 2"));
  });
});
