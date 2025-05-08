import { act, renderHook } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TResponseTtc } from "@formbricks/types/responses";
import { TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { getUpdatedTtc, useTtc } from "./ttc";

describe("getUpdatedTtc", () => {
  it("should add time to an existing questionId", () => {
    const ttc: TResponseTtc = { q1: 1000 };
    const updatedTtc = getUpdatedTtc(ttc, "q1", 500);
    expect(updatedTtc.q1).toBe(1500);
  });

  it("should add a new questionId and time if it does not exist", () => {
    const ttc: TResponseTtc = { q1: 1000 };
    const updatedTtc = getUpdatedTtc(ttc, "q2", 500);
    expect(updatedTtc.q2).toBe(500);
    expect(updatedTtc.q1).toBe(1000); // Ensure existing entries are preserved
  });

  it("should return a new object and not mutate the original", () => {
    const ttc: TResponseTtc = { q1: 1000 };
    const updatedTtc = getUpdatedTtc(ttc, "q1", 500);
    expect(updatedTtc).not.toBe(ttc);
    expect(ttc.q1).toBe(1000); // Original should be unchanged
  });
});

describe("useTtc", () => {
  let mockSetTtc: ReturnType<typeof vi.fn>;
  let mockSetStartTime: ReturnType<typeof vi.fn>;
  let mockPerformanceNow: ReturnType<typeof vi.spyOn>;
  let currentTime = 0;
  let initialProps: {
    questionId: TSurveyQuestionId;
    ttc: TResponseTtc;
    setTtc: ReturnType<typeof vi.fn>;
    startTime: number;
    setStartTime: ReturnType<typeof vi.fn>;
    isCurrentQuestion: boolean;
  };

  beforeEach(() => {
    mockSetTtc = vi.fn();
    mockSetStartTime = vi.fn();
    currentTime = 1000; // Initial mock time
    mockPerformanceNow = vi.spyOn(performance, "now").mockImplementation(() => currentTime);
    vi.spyOn(document, "addEventListener");
    vi.spyOn(document, "removeEventListener");

    initialProps = {
      questionId: "q1" as TSurveyQuestionId,
      ttc: {} as TResponseTtc,
      setTtc: mockSetTtc,
      startTime: 0,
      setStartTime: mockSetStartTime,
      isCurrentQuestion: true,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Reset visibilityState for other tests if changed
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("should set initial start time if isCurrentQuestion is true", () => {
    renderHook(() =>
      useTtc(
        initialProps.questionId,
        initialProps.ttc,
        initialProps.setTtc,
        initialProps.startTime,
        initialProps.setStartTime,
        true
      )
    );
    expect(mockSetStartTime).toHaveBeenCalledWith(currentTime);
  });

  it("should not set initial start time if isCurrentQuestion is false", () => {
    renderHook(() =>
      useTtc(
        initialProps.questionId,
        initialProps.ttc,
        initialProps.setTtc,
        initialProps.startTime,
        initialProps.setStartTime,
        false
      )
    );
    expect(mockSetStartTime).not.toHaveBeenCalled();
  });

  it("should add event listener if isCurrentQuestion is true", () => {
    renderHook(() =>
      useTtc(
        initialProps.questionId,
        initialProps.ttc,
        initialProps.setTtc,
        initialProps.startTime,
        initialProps.setStartTime,
        initialProps.isCurrentQuestion
      )
    );
    expect(document.addEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });

  it("should not add event listener if isCurrentQuestion is false", () => {
    renderHook(() =>
      useTtc(
        initialProps.questionId,
        initialProps.ttc,
        initialProps.setTtc,
        initialProps.startTime,
        initialProps.setStartTime,
        false
      )
    );
    expect(document.addEventListener).not.toHaveBeenCalled();
  });

  it("should update ttc when visibility changes to hidden and isCurrentQuestion is true", () => {
    const currentTtc = { q1: 50 };
    const currentStartTime = 1000;
    currentTime = 1500; // 500ms passed

    renderHook(() =>
      useTtc(initialProps.questionId, currentTtc, mockSetTtc, currentStartTime, mockSetStartTime, true)
    );

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mockSetTtc).toHaveBeenCalledWith({ q1: 550 }); // 50 (existing) + 500 (passed)
  });

  it("should restart startTime when visibility changes to visible and isCurrentQuestion is true", () => {
    renderHook(() =>
      useTtc(
        initialProps.questionId,
        initialProps.ttc,
        initialProps.setTtc,
        initialProps.startTime,
        initialProps.setStartTime,
        initialProps.isCurrentQuestion
      )
    );

    currentTime = 2000;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mockSetStartTime).toHaveBeenCalledWith(2000);
  });

  it("should not update ttc or startTime if visibility changes but isCurrentQuestion is false", () => {
    renderHook(() =>
      useTtc(
        initialProps.questionId,
        initialProps.ttc,
        mockSetTtc,
        initialProps.startTime,
        mockSetStartTime,
        false
      )
    );

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(mockSetTtc).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(mockSetStartTime).not.toHaveBeenCalled(); // It was not called initially either
  });

  it("should remove event listener on unmount if it was added", () => {
    const { unmount } = renderHook(() =>
      useTtc(
        initialProps.questionId,
        initialProps.ttc,
        initialProps.setTtc,
        initialProps.startTime,
        initialProps.setStartTime,
        initialProps.isCurrentQuestion
      )
    );
    unmount();
    expect(document.removeEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });

  it("should not attempt to remove event listener on unmount if not added", () => {
    const { unmount } = renderHook(() =>
      useTtc(
        initialProps.questionId,
        initialProps.ttc,
        mockSetTtc,
        initialProps.startTime,
        mockSetStartTime,
        false
      )
    );
    unmount();
    expect(document.removeEventListener).not.toHaveBeenCalled();
  });

  it("should set startTime when isCurrentQuestion becomes true", () => {
    const { rerender } = renderHook(
      (props) =>
        useTtc(
          props.questionId,
          props.ttc,
          props.setTtc,
          props.startTime,
          props.setStartTime,
          props.isCurrentQuestion
        ),
      { initialProps: { ...initialProps, isCurrentQuestion: false } }
    );
    expect(mockSetStartTime).not.toHaveBeenCalled(); // Initially false

    currentTime = 3000;
    rerender({ ...initialProps, isCurrentQuestion: true });
    expect(mockSetStartTime).toHaveBeenCalledWith(3000);
  });
});
