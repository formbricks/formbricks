/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { surveyKeys } from "@/modules/survey/list/lib/query";
import { TSurveyListPage } from "@/modules/survey/list/lib/v3-surveys-client";
import { useUpdateSurveyStatus } from "./use-update-survey-status";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  Wrapper.displayName = "UseUpdateSurveyStatusTestWrapper";

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
            status: "inProgress",
            createdAt: new Date("2026-04-15T10:00:00.000Z"),
            updatedAt: new Date("2026-04-15T10:00:00.000Z"),
            publishOn: null,
            responseCount: 5,
            creator: { name: "Alice" },
            singleUse: null,
          },
          {
            id: "survey_2",
            name: "Survey 2",
            workspaceId: "env_1",
            type: "link",
            status: "completed",
            createdAt: new Date("2026-04-16T10:00:00.000Z"),
            updatedAt: new Date("2026-04-16T10:00:00.000Z"),
            publishOn: null,
            responseCount: 0,
            creator: { name: "Bob" },
            singleUse: null,
          },
        ],
        meta: {
          limit: 20,
          nextCursor: null,
          totalCount: 2,
        },
      },
    ],
    pageParams: [null],
  };
}

const queryKeyInput = {
  workspaceId: "env_1",
  limit: 20,
  filters: {
    name: "",
    status: [] as never[],
    type: [] as never[],
    sortBy: "relevance" as const,
  },
};

describe("useUpdateSurveyStatus", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("optimistically updates the survey status in cache and resolves on success", async () => {
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
    const queryKey = surveyKeys.list(queryKeyInput);
    queryClient.setQueryData(queryKey, createQueryData());

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateSurveyStatus({ queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ surveyId: "survey_1", status: "paused" });

    // Optimistic update: survey_1 should already show "paused" before the fetch resolves
    await waitFor(() => {
      const cached = queryClient.getQueryData<{ pages: TSurveyListPage[] }>(queryKey);
      expect(cached?.pages[0]?.data.find((s) => s.id === "survey_1")?.status).toBe("paused");
    });

    // survey_2 must remain untouched (seeded as "completed", differs from mutation target).
    const cached = queryClient.getQueryData<{ pages: TSurveyListPage[] }>(queryKey);
    expect(cached?.pages[0]?.data.find((s) => s.id === "survey_2")?.status).toBe("completed");

    resolveFetch?.(
      new Response(JSON.stringify({ data: { id: "survey_1", status: "paused" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: surveyKeys.lists() });
  });

  test("rolls back to previous cache data when the mutation fails", async () => {
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
    const queryKey = surveyKeys.list(queryKeyInput);
    queryClient.setQueryData(queryKey, createQueryData());

    const { result } = renderHook(() => useUpdateSurveyStatus({ queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ surveyId: "survey_1", status: "completed" });
      })
    ).rejects.toThrow("You are not authorized to access this resource");

    // Cache must be rolled back to the original status
    const cached = queryClient.getQueryData<{ pages: TSurveyListPage[] }>(queryKey);
    expect(cached?.pages[0]?.data.find((s) => s.id === "survey_1")?.status).toBe("inProgress");
  });

  test("passes the correct surveyId and status to the client function", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "survey_2", status: "completed" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    const queryKey = surveyKeys.list(queryKeyInput);
    queryClient.setQueryData(queryKey, createQueryData());

    const { result } = renderHook(() => useUpdateSurveyStatus({ queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ surveyId: "survey_2", status: "completed" });
    });

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      "/api/v3/surveys/survey_2",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      })
    );
  });
});
