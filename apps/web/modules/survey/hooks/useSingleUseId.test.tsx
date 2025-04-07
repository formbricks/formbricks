import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { generateSingleUseIdAction } from "@/modules/survey/list/actions";
import { act, renderHook } from "@testing-library/react";
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

    // Wait for the effect to run
    await new Promise((r) => setTimeout(r, 0));

    expect(generateSingleUseIdAction).toHaveBeenCalledWith({
      surveyId: "survey123",
      isEncrypted: true,
    });
    expect(result.current.singleUseId).toBe("mockSingleUseId");

    // Re-render with the same props to ensure it doesn't break
    rerender(mockSurvey);

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

    await new Promise((r) => setTimeout(r, 0));

    expect(generateSingleUseIdAction).not.toHaveBeenCalled();
    expect(result.current.singleUseId).toBeUndefined();
  });

  it("should show toast error if the API call fails", async () => {
    vi.mocked(generateSingleUseIdAction).mockResolvedValueOnce({ serverError: "Something went wrong" });

    const { result } = renderHook(() => useSingleUseId(mockSurvey));

    await new Promise((r) => setTimeout(r, 0));

    expect(getFormattedErrorMessage).toHaveBeenCalledWith({ serverError: "Something went wrong" });
    expect(toast.error).toHaveBeenCalledWith("Formatted error");
    expect(result.current.singleUseId).toBeUndefined();
  });

  it("should refreshSingleUseId on demand", async () => {
    vi.mocked(generateSingleUseIdAction).mockResolvedValueOnce({ data: "initialId" });
    const { result } = renderHook(() => useSingleUseId(mockSurvey));

    // Wait for initial value to be set
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.singleUseId).toBe("initialId");

    vi.mocked(generateSingleUseIdAction).mockResolvedValueOnce({ data: "refreshedId" });

    await act(async () => {
      const val = await result.current.refreshSingleUseId();
      expect(val).toBe("refreshedId");
    });

    expect(result.current.singleUseId).toBe("refreshedId");
  });
});
