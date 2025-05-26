// Import the mocked functions
import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getResponseCountAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { getResponseCountBySurveySharingKeyAction } from "@/app/share/[sharingKey]/actions";
import { renderHook, waitFor } from "@testing-library/react";
import { useParams } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { useResponseCount } from "./useResponseCount";

// Mock the dependencies
vi.mock("@/app/(app)/environments/[environmentId]/components/ResponseFilterContext", () => ({
  useResponseFilter: vi.fn(),
}));

vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions", () => ({
  getResponseCountAction: vi.fn(),
}));

vi.mock("@/app/lib/surveys/surveys", () => ({
  getFormattedFilters: vi.fn(),
}));

vi.mock("@/app/share/[sharingKey]/actions", () => ({
  getResponseCountBySurveySharingKeyAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
}));

const mockSurvey: TSurvey = {
  id: "survey-123",
  name: "Test Survey",
  environmentId: "env-123",
  status: "inProgress",
  type: "web",
  questions: [],
  thankYouCard: { enabled: false },
  endings: [],
  languages: [],
  triggers: [],
  recontactDays: null,
  displayOption: "displayOnce",
  autoClose: null,
  styling: null,
} as unknown as TSurvey;

const mockFilters = {
  createdAt: {
    min: new Date(),
    max: new Date(),
  },
};

describe("useResponseCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(useParams).mockReturnValue({
      environmentId: "env-123",
      surveyId: "survey-123",
    });

    vi.mocked(useResponseFilter).mockReturnValue({
      selectedFilter: {
        filter: [],
        onlyComplete: false,
      },
      setSelectedFilter: vi.fn(),
      selectedOptions: {
        questionOptions: [],
        questionFilterOptions: [],
      },
      setSelectedOptions: vi.fn(),
      dateRange: { from: new Date(), to: new Date() },
      setDateRange: vi.fn(),
      resetState: vi.fn(),
    });

    vi.mocked(getFormattedFilters).mockReturnValue(mockFilters);

    vi.mocked(getResponseCountAction).mockResolvedValue({
      data: 42,
    });

    vi.mocked(getResponseCountBySurveySharingKeyAction).mockResolvedValue({
      data: 24,
    });
  });

  test("initializes with initial count", async () => {
    const { result } = renderHook(() => useResponseCount({ survey: mockSurvey, initialCount: 10 }));

    expect(result.current.responseCount).toBe(10);
    expect(result.current.isLoading).toBe(true);
    expect(typeof result.current.refetch).toBe("function");

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.responseCount).toBe(42);
  });

  test("initializes with default count of 0", () => {
    const { result } = renderHook(() => useResponseCount({ survey: mockSurvey }));

    expect(result.current.responseCount).toBe(0);
  });

  test("fetches response count on mount for regular survey", async () => {
    const { result } = renderHook(() => useResponseCount({ survey: mockSurvey }));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.responseCount).toBe(42);
    expect(vi.mocked(getResponseCountAction)).toHaveBeenCalledWith({
      surveyId: "survey-123",
      filterCriteria: mockFilters,
    });
    expect(vi.mocked(getResponseCountBySurveySharingKeyAction)).not.toHaveBeenCalled();
  });

  test("fetches response count for sharing page", async () => {
    vi.mocked(useParams).mockReturnValue({
      environmentId: "env-123",
      surveyId: "survey-123",
      sharingKey: "share-key-123",
    });

    const { result } = renderHook(() => useResponseCount({ survey: mockSurvey }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.responseCount).toBe(24);
    expect(vi.mocked(getResponseCountBySurveySharingKeyAction)).toHaveBeenCalledWith({
      sharingKey: "share-key-123",
      filterCriteria: mockFilters,
    });
    expect(vi.mocked(getResponseCountAction)).not.toHaveBeenCalled();
  });

  test("refetches when filters change", async () => {
    const mockUseResponseFilter = vi.mocked(useResponseFilter);
    const mockGetFormattedFilters = vi.mocked(getFormattedFilters);

    let filterState = {
      selectedFilter: {
        filter: [],
        onlyComplete: false,
      },
      setSelectedFilter: vi.fn(),
      selectedOptions: {
        questionOptions: [],
        questionFilterOptions: [],
      },
      setSelectedOptions: vi.fn(),
      dateRange: { from: new Date(), to: new Date() },
      setDateRange: vi.fn(),
      resetState: vi.fn(),
    };

    mockUseResponseFilter.mockReturnValue(filterState);
    mockGetFormattedFilters.mockReturnValue(mockFilters);

    const { rerender } = renderHook(() => useResponseCount({ survey: mockSurvey }));

    await waitFor(() => {
      expect(vi.mocked(getResponseCountAction)).toHaveBeenCalledTimes(1);
    });

    const newMockFilters = {
      createdAt: {
        min: new Date(),
        max: new Date(),
      },
      finished: true,
    };

    filterState = {
      ...filterState,
      selectedFilter: {
        filter: [],
        onlyComplete: true,
      },
    };
    mockUseResponseFilter.mockReturnValue(filterState);
    mockGetFormattedFilters.mockReturnValue(newMockFilters);

    rerender();

    await waitFor(() => {
      expect(vi.mocked(getResponseCountAction)).toHaveBeenCalledTimes(2);
    });
  });

  test("refetches when survey ID changes", async () => {
    const { rerender } = renderHook(({ survey }) => useResponseCount({ survey }), {
      initialProps: { survey: mockSurvey },
    });

    await waitFor(() => {
      expect(vi.mocked(getResponseCountAction)).toHaveBeenCalledTimes(1);
    });

    const newSurvey = { ...mockSurvey, id: "survey-456" };
    rerender({ survey: newSurvey });

    await waitFor(() => {
      expect(vi.mocked(getResponseCountAction)).toHaveBeenCalledTimes(2);
    });

    expect(vi.mocked(getResponseCountAction)).toHaveBeenLastCalledWith({
      surveyId: "survey-456",
      filterCriteria: mockFilters,
    });
  });

  test("handles API errors gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getResponseCountAction).mockRejectedValue(new Error("API Error"));

    const { result } = renderHook(() => useResponseCount({ survey: mockSurvey }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(consoleSpy).toHaveBeenCalledWith("Error fetching response count:", expect.any(Error));
    expect(result.current.responseCount).toBe(0); // Should remain at initial value

    consoleSpy.mockRestore();
  });

  test("manual refetch works correctly", async () => {
    const { result } = renderHook(() => useResponseCount({ survey: mockSurvey }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(vi.mocked(getResponseCountAction)).toHaveBeenCalledTimes(1);

    // Manual refetch
    result.current.refetch();

    await waitFor(() => {
      expect(vi.mocked(getResponseCountAction)).toHaveBeenCalledTimes(2);
    });
  });

  test("cancels previous request when new request is made", async () => {
    let resolveFirst: (value: any) => void;
    let resolveSecond: (value: any) => void;

    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise((resolve) => {
      resolveSecond = resolve;
    });

    vi.mocked(getResponseCountAction)
      .mockReturnValueOnce(firstPromise as any)
      .mockReturnValueOnce(secondPromise as any);

    const { result } = renderHook(() => useResponseCount({ survey: mockSurvey }));

    expect(result.current.isLoading).toBe(true);

    // Trigger a second request by calling refetch
    result.current.refetch();

    // Resolve the first request (should be cancelled)
    resolveFirst!({ data: 100 });

    // Resolve the second request
    resolveSecond!({ data: 200 });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have the result from the second request, not the first
    expect(result.current.responseCount).toBe(200);
  });

  test("does not update state for cancelled requests", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    let rejectFirst: (error: any) => void;
    const firstPromise = new Promise((_, reject) => {
      rejectFirst = reject;
    });

    vi.mocked(getResponseCountAction)
      .mockReturnValueOnce(firstPromise as any)
      .mockResolvedValueOnce({ data: 42 });

    const { result } = renderHook(() => useResponseCount({ survey: mockSurvey }));

    // Trigger a second request
    result.current.refetch();

    // Simulate the first request being cancelled
    const abortError = new Error("Request cancelled");
    rejectFirst!(abortError);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should not log error for cancelled request
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(result.current.responseCount).toBe(42);

    consoleSpy.mockRestore();
  });

  test("cleans up abort controller on unmount", () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");

    const { unmount } = renderHook(() => useResponseCount({ survey: mockSurvey }));

    unmount();

    expect(abortSpy).toHaveBeenCalled();

    abortSpy.mockRestore();
  });

  test("switches between sharing and non-sharing modes", async () => {
    const mockUseParams = vi.mocked(useParams);

    // Start without sharing key
    mockUseParams.mockReturnValue({
      environmentId: "env-123",
      surveyId: "survey-123",
    });

    const { rerender } = renderHook(() => useResponseCount({ survey: mockSurvey }));

    await waitFor(() => {
      expect(vi.mocked(getResponseCountAction)).toHaveBeenCalledTimes(1);
    });

    // Switch to sharing mode
    mockUseParams.mockReturnValue({
      environmentId: "env-123",
      surveyId: "survey-123",
      sharingKey: "share-key-123",
    });

    rerender();

    await waitFor(() => {
      expect(vi.mocked(getResponseCountBySurveySharingKeyAction)).toHaveBeenCalledTimes(1);
    });
  });

  test("handles null response data", async () => {
    vi.mocked(getResponseCountAction).mockResolvedValue({
      data: null as any,
    });

    const { result } = renderHook(() => useResponseCount({ survey: mockSurvey }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.responseCount).toBe(0);
  });

  test("handles undefined response data", async () => {
    vi.mocked(getResponseCountAction).mockResolvedValue({
      data: undefined as any,
    });

    const { result } = renderHook(() => useResponseCount({ survey: mockSurvey }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.responseCount).toBe(0);
  });
});
