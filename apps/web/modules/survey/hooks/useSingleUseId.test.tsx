import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { generateSingleUseIdAction } from "@/modules/survey/list/actions";
import { act, renderHook, waitFor } from "@testing-library/react";
import toast from "react-hot-toast";
import { describe, expect, it, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { useSingleUseId } from "./useSingleUseId";

// Mock external functions
vi.mock("@/modules/survey/list/actions", () => ({
  generateSingleUseIdAction: vi.fn().mockResolvedValue({ data: "initialId" }),
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

  it("should initialize singleUseId to undefined", () => {
    vi.mocked(generateSingleUseIdAction).mockResolvedValueOnce({ data: "mockSingleUseId" });

    const { result } = renderHook(() => useSingleUseId(mockSurvey));

    // Right after mount, before the async effect resolves, singleUseId should be undefined
    expect(result.current.singleUseId).toBeUndefined();
  });

  it("should fetch and set singleUseId if singleUse is enabled", async () => {
    vi.mocked(generateSingleUseIdAction).mockResolvedValueOnce({ data: "mockSingleUseId" });

    const { result, rerender } = renderHook((props) => useSingleUseId(props), {
      initialProps: mockSurvey,
    });

    // Wait for the state to update after the async operation
    await waitFor(() => {
      expect(result.current.singleUseId).toBe("mockSingleUseId");
    });

    expect(generateSingleUseIdAction).toHaveBeenCalledWith({
      surveyId: "survey123",
      isEncrypted: true,
    });

    // Re-render with the same props to ensure it doesn't break
    act(() => {
      rerender(mockSurvey);
    });

    // The singleUseId remains the same unless we explicitly refresh
    expect(result.current.singleUseId).toBe("mockSingleUseId");
  });

  it("should return undefined and not call the API if singleUse is disabled", async () => {
    const disabledSurvey = {
      ...mockSurvey,
      singleUse: {
        enabled: false,
      },
    } as TSurvey;

    const { result } = renderHook(() => useSingleUseId(disabledSurvey));

    await waitFor(() => {
      expect(result.current.singleUseId).toBeUndefined();
    });

    expect(generateSingleUseIdAction).not.toHaveBeenCalled();
  });

  it("should show toast error if the API call fails", async () => {
    vi.mocked(generateSingleUseIdAction).mockResolvedValueOnce({ serverError: "Something went wrong" });

    const { result } = renderHook(() => useSingleUseId(mockSurvey));

    await waitFor(() => {
      expect(result.current.singleUseId).toBeUndefined();
    });

    expect(getFormattedErrorMessage).toHaveBeenCalledWith({ serverError: "Something went wrong" });
    expect(toast.error).toHaveBeenCalledWith("Formatted error");
  });

  it("should refreshSingleUseId on demand", async () => {
    // Set up the initial mock response
    vi.mocked(generateSingleUseIdAction).mockResolvedValueOnce({ data: "initialId" });

    const { result } = renderHook(() => useSingleUseId(mockSurvey));

    // We need to wait for the initial async effect to complete
    // This ensures the hook has time to update state with the first mock value
    await waitFor(() => {
      expect(generateSingleUseIdAction).toHaveBeenCalledTimes(1);
    });

    // Reset the mock and set up the next response for refreshSingleUseId call
    vi.mocked(generateSingleUseIdAction).mockClear();
    vi.mocked(generateSingleUseIdAction).mockResolvedValueOnce({ data: "refreshedId" });

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
    expect(generateSingleUseIdAction).toHaveBeenCalledWith({
      surveyId: "survey123",
      isEncrypted: true,
    });
  });
});
