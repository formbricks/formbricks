/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { updateSurveyStatusAction } from "@/modules/survey/editor/actions";
import { surveyKeys } from "@/modules/survey/list/lib/query";
import type { TSurveyListPage } from "@/modules/survey/list/lib/v3-surveys-client";
import { useUpdateSurveyStatus } from "./use-update-survey-status";

vi.mock("@/modules/survey/editor/actions", () => ({
  updateSurveyStatusAction: vi.fn(),
}));

function createWrapper(queryClient: QueryClient) {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
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
            publishOn: null,
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

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

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

describe("useUpdateSurveyStatus", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("optimistically updates the survey status and stores the action result", async () => {
    const updatedAt = new Date("2026-04-16T10:00:00.000Z");
    let resolveAction: ((value: unknown) => void) | undefined;
    const actionPromise = new Promise((resolve) => {
      resolveAction = resolve;
    });
    vi.mocked(updateSurveyStatusAction).mockReturnValue(
      actionPromise as ReturnType<typeof updateSurveyStatusAction>
    );

    const queryClient = createQueryClient();
    queryClient.setQueryData(queryKey, createQueryData());
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateSurveyStatus({ queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ surveyId: "survey_1", status: "completed" });

    await waitFor(() =>
      expect(queryClient.getQueryData<{ pages: TSurveyListPage[] }>(queryKey)?.pages[0]?.data[0]).toEqual(
        expect.objectContaining({
          status: "completed",
          publishOn: null,
        })
      )
    );

    resolveAction?.({
      data: {
        id: "survey_1",
        status: "completed",
        publishOn: null,
        updatedAt,
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData<{ pages: TSurveyListPage[] }>(queryKey)?.pages[0]?.data[0]).toEqual(
      expect.objectContaining({
        status: "completed",
        updatedAt,
      })
    );
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: surveyKeys.lists() });
  });

  test("rolls the cache back when the action returns an error result", async () => {
    vi.mocked(updateSurveyStatusAction).mockResolvedValue({ serverError: "Not allowed" });

    const queryClient = createQueryClient();
    const previousData = createQueryData();
    queryClient.setQueryData(queryKey, previousData);

    const { result } = renderHook(() => useUpdateSurveyStatus({ queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ surveyId: "survey_1", status: "completed" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(queryKey)).toEqual(previousData);
  });
});
