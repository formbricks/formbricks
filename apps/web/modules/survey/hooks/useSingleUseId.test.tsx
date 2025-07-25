import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { generateSingleUseIdsAction } from "@/modules/survey/list/actions";
import { act, renderHook, waitFor } from "@testing-library/react";
import toast from "react-hot-toast";
import { describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { useSingleUseId } from "./useSingleUseId";

// Mock external functions
vi.mock("@/modules/survey/list/actions", () => ({
  generateSingleUseIdsAction: vi.fn().mockResolvedValue({ data: ["initialId"] }),
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(() => "Formatted error"),
}));

// Mock toast
vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
  },
}));

describe("useSingleUseId", () => {
  const mockSurvey = {
    id: "survey123",
    singleUse: {
      enabled: true,
      isEncrypted: true,
    },
  } as TSurvey;

  test("should return early with undefined values when isReadOnly is true", async () => {
    const { result } = renderHook(() => useSingleUseId(mockSurvey, true));

    // Should immediately return undefined for singleUseId
    expect(result.current.singleUseId).toBeUndefined();

    // Should return a dummy function that resolves to undefined
    const refreshResult = await result.current.refreshSingleUseId();
    expect(refreshResult).toBeUndefined();

    // Should not call the API when in read-only mode
    expect(generateSingleUseIdsAction).not.toHaveBeenCalled();
  });

  test("should initialize singleUseId to undefined", () => {
    vi.mocked(generateSingleUseIdsAction).mockResolvedValueOnce({ data: ["mockSingleUseId"] });

    const { result } = renderHook(() => useSingleUseId(mockSurvey, false));

    // Right after mount, before the async effect resolves, singleUseId should be undefined
    expect(result.current.singleUseId).toBeUndefined();
  });

  test("should fetch and set singleUseId if singleUse is enabled", async () => {
    vi.mocked(generateSingleUseIdsAction).mockResolvedValueOnce({ data: ["mockSingleUseId"] });

    const { result, rerender } = renderHook((props) => useSingleUseId(props, false), {
      initialProps: mockSurvey,
    });

    // Wait for the state to update after the async operation
    await waitFor(() => {
      expect(result.current.singleUseId).toBe("mockSingleUseId");
    });

    expect(generateSingleUseIdsAction).toHaveBeenCalledWith({
      surveyId: "survey123",
      isEncrypted: true,
      count: 1,
    });

    // Re-render with the same props to ensure it doesn't break
    act(() => {
      rerender(mockSurvey);
    });

    // The singleUseId remains the same unless we explicitly refresh
    expect(result.current.singleUseId).toBe("mockSingleUseId");
  });

  test("should return undefined and not call the API if singleUse is disabled", async () => {
    const disabledSurvey = {
      ...mockSurvey,
      singleUse: {
        enabled: false,
      },
    } as TSurvey;

    const { result } = renderHook(() => useSingleUseId(disabledSurvey, false));

    await waitFor(() => {
      expect(result.current.singleUseId).toBeUndefined();
    });

    expect(generateSingleUseIdsAction).not.toHaveBeenCalled();
  });

  test("should show toast error if the API call fails", async () => {
    vi.mocked(generateSingleUseIdsAction).mockResolvedValueOnce({ serverError: "Something went wrong" });

    const { result } = renderHook(() => useSingleUseId(mockSurvey, false));

    await waitFor(() => {
      expect(result.current.singleUseId).toBeUndefined();
    });

    expect(getFormattedErrorMessage).toHaveBeenCalledWith({ serverError: "Something went wrong" });
    expect(toast.error).toHaveBeenCalledWith("Formatted error");
  });

  test("should refreshSingleUseId on demand", async () => {
    // Set up the initial mock response
    vi.mocked(generateSingleUseIdsAction).mockResolvedValueOnce({ data: ["initialId"] });

    const { result } = renderHook(() => useSingleUseId(mockSurvey, false));

    // We need to wait for the initial async effect to complete
    // This ensures the hook has time to update state with the first mock value
    await waitFor(() => {
      expect(generateSingleUseIdsAction).toHaveBeenCalledTimes(1);
    });

    // Reset the mock and set up the next response for refreshSingleUseId call
    vi.mocked(generateSingleUseIdsAction).mockClear();
    vi.mocked(generateSingleUseIdsAction).mockResolvedValueOnce({ data: ["refreshedId"] });

    // Call refreshSingleUseId and wait for it to complete
    let refreshedValue;
    await act(async () => {
      refreshedValue = await result.current.refreshSingleUseId();
    });

    // Verify the return value from refreshSingleUseId
    expect(refreshedValue).toBe("refreshedId");

    // Verify the state was updated
    expect(result.current.singleUseId).toBe("refreshedId");

    // Verify the API was called with correct parameters
    expect(generateSingleUseIdsAction).toHaveBeenCalledWith({
      surveyId: "survey123",
      isEncrypted: true,
      count: 1,
    });
  });
});
