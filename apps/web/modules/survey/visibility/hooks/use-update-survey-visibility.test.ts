/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { surveyKeys } from "@/modules/survey/list/lib/query";
import { TSurveyListPage } from "@/modules/survey/list/lib/v3-surveys-client";
import { useUpdateSurveyVisibility } from "./use-update-survey-visibility";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  Wrapper.displayName = "UseUpdateSurveyVisibilityTestWrapper";

  return Wrapper;
}

const baseSurvey = {
  name: "Survey",
  workspaceId: "env_1",
  type: "link" as const,
  status: "inProgress" as const,
  createdAt: new Date("2026-04-15T10:00:00.000Z"),
  updatedAt: new Date("2026-04-15T10:00:00.000Z"),
  publishOn: null,
  archivedAt: null,
  responseCount: 0,
  completedResponseCount: 0,
  creator: { name: "Alice" },
  singleUse: null,
  owner: { name: "Alice" },
  access: { via: "owner" as const, canManageVisibility: true },
};

function createQueryData(): { pages: TSurveyListPage[]; pageParams: (string | null)[] } {
  return {
    pages: [
      {
        data: [
          { ...baseSurvey, id: "survey_1", visibility: "restricted" },
          { ...baseSurvey, id: "survey_2", visibility: "restricted" },
        ],
        meta: { limit: 20, nextCursor: null, totalCount: 2, workspaceSurveyCount: 2 },
      },
    ],
    pageParams: [null],
  };
}

const listQueryKey = surveyKeys.list({
  workspaceId: "env_1",
  limit: 20,
  filters: { name: "", status: [], type: [], visibility: [], sortBy: "relevance" },
});

const changeResult = {
  id: "survey_1",
  visibility: "workspace",
  owner: { name: "Alice" },
  access: { via: "workspace", canManageVisibility: true },
  version: 2,
  pending: null,
  changedAt: "2026-09-29T10:00:00.000Z",
  changedBy: { id: "user_1", name: "Alice", type: "user" },
};

const newQueryClient = () =>
  new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });

const visibilityOf = (queryClient: QueryClient, surveyId: string) =>
  queryClient
    .getQueryData<{ pages: TSurveyListPage[] }>(listQueryKey)
    ?.pages[0]?.data.find((survey) => survey.id === surveyId)?.visibility;

describe("useUpdateSurveyVisibility", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("patches the list row optimistically and invalidates the list and the sub-resource", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    vi.mocked(global.fetch).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );
    const queryClient = newQueryClient();
    queryClient.setQueryData(listQueryKey, createQueryData());
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateSurveyVisibility({ listQueryKey }), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ surveyId: "survey_1", visibility: "workspace" });

    await waitFor(() => expect(visibilityOf(queryClient, "survey_1")).toBe("workspace"));
    expect(visibilityOf(queryClient, "survey_2")).toBe("restricted");

    resolveFetch?.(Response.json({ data: changeResult }, { status: 200 }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(changeResult);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: surveyKeys.lists() });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: surveyKeys.visibility("survey_1") });
    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      "/api/v3/surveys/survey_1/visibility",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ visibility: "workspace" }) })
    );
  });

  test("rolls back a pending grant: the survey stays restricted until it is projected", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json(
        {
          status: 503,
          detail: "The change is stored and will take effect shortly",
          code: "projection_pending",
        },
        { status: 503 }
      )
    );
    const queryClient = newQueryClient();
    queryClient.setQueryData(listQueryKey, createQueryData());

    const { result } = renderHook(() => useUpdateSurveyVisibility({ listQueryKey }), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ surveyId: "survey_1", visibility: "workspace" });
      })
    ).rejects.toMatchObject({ status: 503, code: "projection_pending" });

    expect(visibilityOf(queryClient, "survey_1")).toBe("restricted");
  });

  test("without a list key it touches no list cache and still invalidates", async () => {
    vi.mocked(global.fetch).mockResolvedValue(Response.json({ data: changeResult }, { status: 200 }));
    const queryClient = newQueryClient();
    queryClient.setQueryData(listQueryKey, createQueryData());
    const setQueryDataSpy = vi.spyOn(queryClient, "setQueryData");
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateSurveyVisibility(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ surveyId: "survey_1", visibility: "workspace" });
    });

    expect(setQueryDataSpy).not.toHaveBeenCalled();
    expect(visibilityOf(queryClient, "survey_1")).toBe("restricted");
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: surveyKeys.visibility("survey_1") });
  });
});
