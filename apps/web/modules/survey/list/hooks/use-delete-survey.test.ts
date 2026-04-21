/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { surveyKeys } from "@/modules/survey/list/lib/query";
import { TSurveyListPage } from "@/modules/survey/list/lib/v3-surveys-client";
import { useDeleteSurvey } from "./use-delete-survey";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  Wrapper.displayName = "UseDeleteSurveyTestWrapper";

  return Wrapper;
}

function createQueryData(): { pages: TSurveyListPage[]; pageParams: (string | null)[] } {
  return {
    pages: [
      {
        data: [
          {
            id: "survey_1",
            name: "Survey 1",
            workspaceId: "env_1",
            type: "link",
            status: "draft",
            createdAt: new Date("2026-04-15T10:00:00.000Z"),
            updatedAt: new Date("2026-04-15T10:00:00.000Z"),
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
      },
    ],
    pageParams: [null],
  };
}

describe("useDeleteSurvey", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("optimistically removes a survey and invalidates list queries on success", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    vi.mocked(global.fetch).mockReturnValue(fetchPromise as Promise<Response>);

    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    const queryKey = surveyKeys.list({
      workspaceId: "env_1",
      limit: 20,
      filters: {
        name: "",
        status: [],
        type: [],
        sortBy: "relevance",
      },
    });
    queryClient.setQueryData(queryKey, createQueryData());

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteSurvey({ queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ surveyId: "survey_1" });

    await waitFor(() =>
      expect(queryClient.getQueryData<{ pages: TSurveyListPage[] }>(queryKey)?.pages[0]?.data).toEqual([])
    );
    expect(queryClient.getQueryData<{ pages: TSurveyListPage[] }>(queryKey)?.pages[0]?.meta.totalCount).toBe(
      0
    );

    resolveFetch?.(
      new Response(JSON.stringify({ data: { id: "survey_1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: surveyKeys.lists() });
  });

  test("rolls the cache back when delete fails", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          title: "Forbidden",
          status: 403,
          detail: "You are not authorized to access this resource",
          code: "forbidden",
          requestId: "req_1",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/problem+json" },
        }
      )
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    const queryKey = surveyKeys.list({
      workspaceId: "env_1",
      limit: 20,
      filters: {
        name: "",
        status: [],
        type: [],
        sortBy: "relevance",
      },
    });
    queryClient.setQueryData(queryKey, createQueryData());

    const { result } = renderHook(() => useDeleteSurvey({ queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ surveyId: "survey_1" });
      })
    ).rejects.toThrow("You are not authorized to access this resource");

    expect(queryClient.getQueryData<{ pages: TSurveyListPage[] }>(queryKey)?.pages[0]?.data).toHaveLength(1);
    expect(queryClient.getQueryData<{ pages: TSurveyListPage[] }>(queryKey)?.pages[0]?.meta.totalCount).toBe(
      1
    );
  });
});
