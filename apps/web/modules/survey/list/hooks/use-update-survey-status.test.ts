/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { updateSurveyStatusAction } from "@/modules/survey/list/actions";
import { surveyKeys } from "@/modules/survey/list/lib/query";
import type { TSurveyListPage } from "@/modules/survey/list/lib/v3-surveys-client";
import { useUpdateSurveyStatus } from "./use-update-survey-status";

vi.mock("@/modules/survey/list/actions", () => ({
  updateSurveyStatusAction: vi.fn(),
}));

const queryKey = surveyKeys.list({
  workspaceId: "workspace_1",
  limit: 20,
  filters: {
    name: "",
    status: [],
    type: [],
    sortBy: "relevance",
  },
});

const queryData = {
  pages: [
    {
      data: [
        {
          id: "survey_1",
          name: "Survey 1",
          workspaceId: "workspace_1",
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
} satisfies { pages: TSurveyListPage[]; pageParams: (string | null)[] };

const createWrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  Wrapper.displayName = "UseUpdateSurveyStatusTestWrapper";
  return Wrapper;
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
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

  test("updates cached list data from the status action result", async () => {
    const updatedAt = new Date("2026-04-16T10:00:00.000Z");
    vi.mocked(updateSurveyStatusAction).mockResolvedValue({
      data: {
        id: "survey_1",
        status: "completed",
        publishOn: null,
        updatedAt,
      },
    });

    const queryClient = createQueryClient();
    queryClient.setQueryData(queryKey, queryData);

    const { result } = renderHook(() => useUpdateSurveyStatus({ queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ surveyId: "survey_1", status: "completed" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData<{ pages: TSurveyListPage[] }>(queryKey)?.pages[0]?.data[0]).toEqual(
      expect.objectContaining({
        status: "completed",
        publishOn: null,
        updatedAt,
      })
    );
  });

  test("rolls cached list data back when the action throws", async () => {
    vi.mocked(updateSurveyStatusAction).mockRejectedValue(new Error("Unable to update"));

    const queryClient = createQueryClient();
    queryClient.setQueryData(queryKey, queryData);

    const { result } = renderHook(() => useUpdateSurveyStatus({ queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ surveyId: "survey_1", status: "completed" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(queryKey)).toEqual(queryData);
  });

  test("rolls cached list data back when the action returns no data", async () => {
    vi.mocked(updateSurveyStatusAction).mockResolvedValue({ serverError: "Unable to update" });

    const queryClient = createQueryClient();
    queryClient.setQueryData(queryKey, queryData);

    const { result } = renderHook(() => useUpdateSurveyStatus({ queryKey }), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ surveyId: "survey_1", status: "completed" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(queryKey)).toEqual(queryData);
  });
});
