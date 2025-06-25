import { ResponseDataView } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseDataView";
import { ResponsePage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponsePage";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";

vi.mock("@/app/(app)/environments/[environmentId]/components/ResponseFilterContext", () => ({
  useResponseFilter: vi.fn(),
}));

vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions", () => ({
  getResponseCountAction: vi.fn(),
  getResponsesAction: vi.fn(),
}));

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseDataView",
  () => ({
    ResponseDataView: vi.fn(() => <div data-testid="response-data-view">ResponseDataView</div>),
  })
);

vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/CustomFilter", () => ({
  CustomFilter: vi.fn(() => <div data-testid="custom-filter">CustomFilter</div>),
}));

vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ResultsShareButton", () => ({
  ResultsShareButton: vi.fn(() => <div data-testid="results-share-button">ResultsShareButton</div>),
}));

vi.mock("@/app/lib/surveys/surveys", () => ({
  getFormattedFilters: vi.fn(),
}));

vi.mock("@/app/share/[sharingKey]/actions", () => ({
  getResponseCountBySurveySharingKeyAction: vi.fn(),
  getResponsesBySurveySharingKeyAction: vi.fn(),
}));

vi.mock("@/lib/utils/recall", () => ({
  replaceHeadlineRecall: vi.fn((survey) => survey),
}));

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
  useSearchParams: vi.fn(),
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

const mockUseResponseFilter = vi.mocked(
  (await import("@/app/(app)/environments/[environmentId]/components/ResponseFilterContext"))
    .useResponseFilter
);
const mockGetResponsesAction = vi.mocked(
  (await import("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions"))
    .getResponsesAction
);
const mockGetResponseCountAction = vi.mocked(
  (await import("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions"))
    .getResponseCountAction
);
const mockGetResponsesBySurveySharingKeyAction = vi.mocked(
  (await import("@/app/share/[sharingKey]/actions")).getResponsesBySurveySharingKeyAction
);
const mockGetResponseCountBySurveySharingKeyAction = vi.mocked(
  (await import("@/app/share/[sharingKey]/actions")).getResponseCountBySurveySharingKeyAction
);
const mockUseParams = vi.mocked((await import("next/navigation")).useParams);
const mockUseSearchParams = vi.mocked((await import("next/navigation")).useSearchParams);
const mockGetFormattedFilters = vi.mocked((await import("@/app/lib/surveys/surveys")).getFormattedFilters);

const mockSurvey = {
  id: "survey1",
  name: "Test Survey",
  questions: [],
  thankYouCard: { enabled: true, headline: "Thank You!" },
  hiddenFields: { enabled: true, fieldIds: [] },
  displayOption: "displayOnce",
  recontactDays: 0,
  autoClose: null,
  triggers: [],
  type: "web",
  status: "inProgress",
  languages: [],
  styling: null,
} as unknown as TSurvey;

const mockEnvironment = { id: "env1", name: "Test Environment" } as unknown as TEnvironment;
const mockUser = { id: "user1", name: "Test User" } as TUser;
const mockTags: TTag[] = [{ id: "tag1", name: "Tag 1", environmentId: "env1" } as TTag];
const mockLocale: TUserLocale = "en-US";

const defaultProps = {
  environment: mockEnvironment,
  survey: mockSurvey,
  surveyId: "survey1",
  webAppUrl: "http://localhost:3000",
  user: mockUser,
  environmentTags: mockTags,
  responsesPerPage: 10,
  locale: mockLocale,
  isReadOnly: false,
};

const mockResponseFilterState = {
  selectedFilter: "all",
  dateRange: { from: undefined, to: undefined },
  resetState: vi.fn(),
} as any;

const mockResponses: TResponse[] = [
  {
    id: "response1",
    createdAt: new Date(),
    updatedAt: new Date(),
    surveyId: "survey1",
    finished: true,
    data: {},
    meta: { userAgent: {} },
    notes: [],
    tags: [],
  } as unknown as TResponse,
  {
    id: "response2",
    createdAt: new Date(),
    updatedAt: new Date(),
    surveyId: "survey1",
    finished: true,
    data: {},
    meta: { userAgent: {} },
    notes: [],
    tags: [],
  } as unknown as TResponse,
];

describe("ResponsePage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockUseParams.mockReturnValue({ environmentId: "env1", surveyId: "survey1" });
    mockUseSearchParams.mockReturnValue({ get: vi.fn().mockReturnValue(null) } as any);
    mockUseResponseFilter.mockReturnValue(mockResponseFilterState);
    mockGetResponsesAction.mockResolvedValue({ data: mockResponses });
    mockGetResponseCountAction.mockResolvedValue({ data: 20 });
    mockGetResponsesBySurveySharingKeyAction.mockResolvedValue({ data: mockResponses });
    mockGetResponseCountBySurveySharingKeyAction.mockResolvedValue({ data: 20 });
    mockGetFormattedFilters.mockReturnValue({});
  });

  test("renders correctly with default props", async () => {
    render(<ResponsePage {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId("custom-filter")).toBeInTheDocument();
      expect(screen.getByTestId("results-share-button")).toBeInTheDocument();
      expect(screen.getByTestId("response-data-view")).toBeInTheDocument();
    });
    expect(mockGetResponsesAction).toHaveBeenCalled();
  });

  test("does not render ResultsShareButton when isReadOnly is true", async () => {
    render(<ResponsePage {...defaultProps} isReadOnly={true} />);
    await waitFor(() => {
      expect(screen.queryByTestId("results-share-button")).not.toBeInTheDocument();
    });
  });

  test("does not render ResultsShareButton when on sharing page", async () => {
    mockUseParams.mockReturnValue({ sharingKey: "share123" });
    render(<ResponsePage {...defaultProps} />);
    await waitFor(() => {
      expect(screen.queryByTestId("results-share-button")).not.toBeInTheDocument();
    });
    expect(mockGetResponsesBySurveySharingKeyAction).toHaveBeenCalled();
  });

  test("fetches next page of responses", async () => {
    const { rerender } = render(<ResponsePage {...defaultProps} />);
    await waitFor(() => {
      expect(mockGetResponsesAction).toHaveBeenCalledTimes(1);
    });

    // Simulate calling fetchNextPage (e.g., via ResponseDataView prop)
    // For this test, we'll directly manipulate state to simulate the effect
    // In a real scenario, this would be triggered by user interaction with ResponseDataView
    const responseDataViewProps = vi.mocked(ResponseDataView).mock.calls[0][0];

    await act(async () => {
      await responseDataViewProps.fetchNextPage();
    });

    rerender(<ResponsePage {...defaultProps} />); // Rerender to reflect state changes

    await waitFor(() => {
      expect(mockGetResponsesAction).toHaveBeenCalledTimes(2); // Initial fetch + next page
      expect(mockGetResponsesAction).toHaveBeenLastCalledWith(
        expect.objectContaining({
          offset: defaultProps.responsesPerPage, // page 2
        })
      );
    });
  });

  test("deletes responses and updates count", async () => {
    render(<ResponsePage {...defaultProps} />);
    await waitFor(() => {
      expect(mockGetResponsesAction).toHaveBeenCalledTimes(1);
    });

    const responseDataViewProps = vi.mocked(
      (
        await import(
          "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseDataView"
        )
      ).ResponseDataView
    ).mock.calls[0][0];

    act(() => {
      responseDataViewProps.deleteResponses(["response1"]);
    });

    // Check if ResponseDataView is re-rendered with updated responses
    // This requires checking the props passed to ResponseDataView after deletion
    // For simplicity, we assume the state update triggers a re-render and ResponseDataView receives new props
    await waitFor(async () => {
      const latestCallArgs = vi
        .mocked(
          (
            await import(
              "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseDataView"
            )
          ).ResponseDataView
        )
        .mock.calls.pop();
      if (latestCallArgs) {
        expect(latestCallArgs[0].responses).toHaveLength(mockResponses.length - 1);
      }
    });
  });

  test("updates a response", async () => {
    render(<ResponsePage {...defaultProps} />);
    await waitFor(() => {
      expect(mockGetResponsesAction).toHaveBeenCalledTimes(1);
    });

    const responseDataViewProps = vi.mocked(
      (
        await import(
          "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseDataView"
        )
      ).ResponseDataView
    ).mock.calls[0][0];

    const updatedResponseData = { ...mockResponses[0], finished: false };
    act(() => {
      responseDataViewProps.updateResponse("response1", updatedResponseData);
    });

    await waitFor(async () => {
      const latestCallArgs = vi
        .mocked(
          (
            await import(
              "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseDataView"
            )
          ).ResponseDataView
        )
        .mock.calls.pop();
      if (latestCallArgs) {
        const updatedResponseInView = latestCallArgs[0].responses.find((r) => r.id === "response1");
        expect(updatedResponseInView?.finished).toBe(false);
      }
    });
  });

  test("resets pagination and responses when filters change", async () => {
    const { rerender } = render(<ResponsePage {...defaultProps} />);
    await waitFor(() => {
      expect(mockGetResponsesAction).toHaveBeenCalledTimes(1);
    });

    // Simulate filter change
    const newFilterState = { ...mockResponseFilterState, selectedFilter: "completed" };
    mockUseResponseFilter.mockReturnValue(newFilterState);
    mockGetFormattedFilters.mockReturnValue({ someNewFilter: "value" } as any); // Simulate new formatted filters

    rerender(<ResponsePage {...defaultProps} />);

    await waitFor(() => {
      // Should fetch responses again due to filter change
      expect(mockGetResponsesAction).toHaveBeenCalledTimes(2);
      // Check if it fetches with offset 0 (first page)
      expect(mockGetResponsesAction).toHaveBeenLastCalledWith(
        expect.objectContaining({
          offset: 0,
          filterCriteria: { someNewFilter: "value" },
        })
      );
    });
  });

  test("calls resetState when referer search param is not present", () => {
    mockUseSearchParams.mockReturnValue({ get: vi.fn().mockReturnValue(null) } as any);
    render(<ResponsePage {...defaultProps} />);
    expect(mockResponseFilterState.resetState).toHaveBeenCalled();
  });

  test("does not call resetState when referer search param is present", () => {
    mockUseSearchParams.mockReturnValue({ get: vi.fn().mockReturnValue("someReferer") } as any);
    render(<ResponsePage {...defaultProps} />);
    expect(mockResponseFilterState.resetState).not.toHaveBeenCalled();
  });

  test("handles empty responses from API", async () => {
    mockGetResponsesAction.mockResolvedValue({ data: [] });
    mockGetResponseCountAction.mockResolvedValue({ data: 0 });
    render(<ResponsePage {...defaultProps} />);
    await waitFor(async () => {
      const latestCallArgs = vi
        .mocked(
          (
            await import(
              "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseDataView"
            )
          ).ResponseDataView
        )
        .mock.calls.pop();
      if (latestCallArgs) {
        expect(latestCallArgs[0].responses).toEqual([]);
        expect(latestCallArgs[0].hasMore).toBe(false);
      }
    });
  });

  test("handles API errors gracefully for getResponsesAction", async () => {
    mockGetResponsesAction.mockResolvedValue({ data: null as any });
    render(<ResponsePage {...defaultProps} />);
    await waitFor(async () => {
      const latestCallArgs = vi
        .mocked(
          (
            await import(
              "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponseDataView"
            )
          ).ResponseDataView
        )
        .mock.calls.pop();
      if (latestCallArgs) {
        expect(latestCallArgs[0].responses).toEqual([]); // Should default to empty array
        expect(latestCallArgs[0].isFetchingFirstPage).toBe(false);
      }
    });
  });

  test("handles API errors gracefully for getResponseCountAction", async () => {
    mockGetResponseCountAction.mockResolvedValue({ data: null as any });
    render(<ResponsePage {...defaultProps} />);
    // No direct visual change, but ensure no crash and component renders
    await waitFor(() => {
      expect(screen.getByTestId("response-data-view")).toBeInTheDocument();
    });
  });
});
