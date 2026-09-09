/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { surveyKeys } from "@/modules/survey/list/lib/query";
import { TSurveyListPage } from "@/modules/survey/list/lib/v3-surveys-client";
import type { TSurveyOverviewFilters } from "@/modules/survey/list/types/survey-overview";
import { useArchiveSurvey } from "./use-archive-survey";
import { useSurveys } from "./use-surveys";

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  Wrapper.displayName = "UseArchiveSurveyTestWrapper";

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
            publishOn: null,
            archivedAt: null,
            createdAt: new Date("2026-04-15T10:00:00.000Z"),
            updatedAt: new Date("2026-04-15T10:00:00.000Z"),
            responseCount: 0,
            completedResponseCount: 0,
            creator: { name: "Alice" },
            singleUse: null,
          },
        ],
        meta: {
          limit: 20,
          nextCursor: null,
          totalCount: 1,
          workspaceSurveyCount: 4,
        },
      },
    ],
    pageParams: [null],
  };
}

const listFilters: TSurveyOverviewFilters = { name: "", status: [], type: [], sortBy: "relevance" };

const queryKey = surveyKeys.list({
  workspaceId: "env_1",
  limit: 20,
  filters: listFilters,
});

describe("useArchiveSurvey", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("optimistically removes the survey and invalidates list queries on success", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    vi.mocked(global.fetch).mockReturnValue(fetchPromise as Promise<Response>);

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    queryClient.setQueryData(queryKey, createQueryData());

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useArchiveSurvey({ queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ surveyId: "survey_1" });

    await waitFor(() =>
      expect(queryClient.getQueryData<{ pages: TSurveyListPage[] }>(queryKey)?.pages[0]?.data).toEqual([])
    );

    // Archiving takes the survey out of this view, not out of the workspace: the workspace count must
    // hold, or archiving the last live survey would flip the page to the "create your first survey"
    // onboarding and strand the archived one behind a toolbar that is no longer rendered.
    const meta = queryClient.getQueryData<{ pages: TSurveyListPage[] }>(queryKey)?.pages[0]?.meta;
    expect(meta?.totalCount).toBe(0);
    expect(meta?.workspaceSurveyCount).toBe(4);

    resolveFetch?.(
      new Response(JSON.stringify({ data: { id: "survey_1", status: "paused", archivedAt: "2026-04-16" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: surveyKeys.lists() });
  });

  test("rolls the cache back when archive fails", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          title: "Forbidden",
          status: 403,
          detail: "You are not authorized to access this resource",
          code: "forbidden",
          requestId: "req_1",
        }),
        { status: 403, headers: { "Content-Type": "application/problem+json" } }
      )
    );

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    queryClient.setQueryData(queryKey, createQueryData());

    const { result } = renderHook(() => useArchiveSurvey({ queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ surveyId: "survey_1" });
      })
    ).rejects.toThrow("You are not authorized to access this resource");

    expect(queryClient.getQueryData<{ pages: TSurveyListPage[] }>(queryKey)?.pages[0]?.data).toHaveLength(1);
  });
});

// ENG-2583: the optimistic patch alone lasts only until the next list fetch resolves. These drive the
// list the way the page does — `useSurveys` beside the mutation — because the regression is only
// visible in what the list renders, not in the cache the mutation patched.
describe("useArchiveSurvey with the list mounted", () => {
  const listUrlPattern = "/api/v3/surveys?";
  const archiveUrlPattern = "/archive";

  function createListResponse() {
    return new Response(
      JSON.stringify({
        data: [
          {
            id: "survey_1",
            name: "Survey 1",
            workspaceId: "env_1",
            type: "link",
            status: "inProgress",
            publishOn: null,
            archivedAt: null,
            createdAt: "2026-04-15T10:00:00.000Z",
            updatedAt: "2026-04-15T10:00:00.000Z",
            responseCount: 0,
            completedResponseCount: 0,
            creator: { name: "Alice" },
            singleUse: null,
          },
        ],
        meta: { limit: 20, nextCursor: null, totalCount: 1, workspaceSurveyCount: 4 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  function renderListWithArchive(queryClient: QueryClient) {
    return renderHook(
      () => {
        const list = useSurveys({ workspaceId: "env_1", limit: 20, filters: listFilters });
        const archive = useArchiveSurvey({ queryKey: list.queryKey });

        return { archive, list };
      },
      { wrapper: createWrapper(queryClient) }
    );
  }

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("keeps the survey out of the list when a refetch lands before the archive does", async () => {
    let resolveArchive: ((value: Response) => void) | undefined;
    const archiveResponse = new Promise<Response>((resolve) => {
      resolveArchive = resolve;
    });

    vi.mocked(global.fetch).mockImplementation((input) =>
      String(input).includes(archiveUrlPattern) ? archiveResponse : Promise.resolve(createListResponse())
    );

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });

    const { result } = renderListWithArchive(queryClient);

    await waitFor(() => expect(result.current.list.surveys).toHaveLength(1));

    result.current.archive.mutate({ surveyId: "survey_1" });

    await waitFor(() => expect(result.current.list.surveys).toHaveLength(0));

    // The archive write has not landed, so the server still lists the survey. Anything that starts a
    // list fetch in this window — a remount, a window-focus refetch, the pagination page — writes
    // that stale page over the optimistic patch.
    await queryClient.refetchQueries({ queryKey: surveyKeys.lists() });

    // Wait for the refetched page to reach the render, so the assertion below cannot pass on a render
    // that predates it: the patch set totalCount to 0 and only the server page carries 1 again.
    await waitFor(() => expect(result.current.list.data?.pages[0]?.meta.totalCount).toBe(1));

    expect(result.current.archive.isPending).toBe(true);
    expect(result.current.list.surveys).toHaveLength(0);

    resolveArchive?.(
      new Response(JSON.stringify({ data: { id: "survey_1", status: "paused", archivedAt: "2026-04-16" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await waitFor(() => expect(result.current.archive.isSuccess).toBe(true));
  });

  test("puts the survey back once the archive fails, even after a mid-flight refetch", async () => {
    let rejectArchive: ((reason: Error) => void) | undefined;
    const archiveResponse = new Promise<Response>((_resolve, reject) => {
      rejectArchive = reject;
    });

    vi.mocked(global.fetch).mockImplementation((input) =>
      String(input).includes(archiveUrlPattern) ? archiveResponse : Promise.resolve(createListResponse())
    );

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });

    const { result } = renderListWithArchive(queryClient);

    await waitFor(() => expect(result.current.list.surveys).toHaveLength(1));

    result.current.archive.mutate({ surveyId: "survey_1" });

    await waitFor(() => expect(result.current.list.surveys).toHaveLength(0));

    await queryClient.refetchQueries({ queryKey: surveyKeys.lists() });
    await waitFor(() => expect(result.current.list.data?.pages[0]?.meta.totalCount).toBe(1));
    expect(result.current.list.surveys).toHaveLength(0);

    rejectArchive?.(new Error("network down"));

    // A failed archive has to hand the survey back, and the fetch mock proves the list request the
    // rollback settles on is the one that still carries it.
    await waitFor(() => expect(result.current.archive.isError).toBe(true));
    await waitFor(() => expect(result.current.list.surveys.map((survey) => survey.id)).toEqual(["survey_1"]));
    expect(
      vi.mocked(global.fetch).mock.calls.filter((call) => String(call[0]).includes(listUrlPattern)).length
    ).toBeGreaterThan(1);
  });
});
